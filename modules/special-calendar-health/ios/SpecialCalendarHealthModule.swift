import ExpoModulesCore
import HealthKit

public class SpecialCalendarHealthModule: Module {
  private let store = HKHealthStore()

  public func definition() -> ModuleDefinition {
    Name("SpecialCalendarHealth")
    AsyncFunction("status") { () -> [String: Any] in
      return ["available": HKHealthStore.isHealthDataAvailable()]
    }
    AsyncFunction("connect") { (promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable(), let steps = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
        promise.reject("native_unavailable", "native_unavailable"); return
      }
      // No write permissions and no access to heart rate, routes or clinical data.
      let readTypes: Set<HKObjectType> = [HKObjectType.workoutType(), steps]
      self.store.requestAuthorization(toShare: [], read: readTypes) { requested, error in
        guard error == nil && requested else { promise.reject("permission", "permission"); return }
        // HealthKit does not expose whether an individual read grant was denied.
        promise.resolve(["permission_requested": true, "read_authorization": "unknown"])
      }
    }
    AsyncFunction("disconnect") { () -> [String: Any] in
      // iOS does not let an app revoke HealthKit read access programmatically.
      return ["disconnected": true, "device_revoke_required": true]
    }
    AsyncFunction("sync") { (days: Int, promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable(), [7, 30, 90].contains(days), let steps = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
        promise.reject("native_unavailable", "native_unavailable"); return
      }
      var calendar = Calendar(identifier: .gregorian)
      calendar.timeZone = TimeZone(secondsFromGMT: 0)!
      let end = Date()
      let start = calendar.startOfDay(for: end.addingTimeInterval(-Double(days - 1) * 86400))
      let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
      let group = DispatchGroup(), lock = NSLock()
      var records: [[String: Any]] = []
      var failure: String? = nil
      group.enter()
      let workouts = HKSampleQuery(sampleType: HKObjectType.workoutType(), predicate: predicate, limit: 1001, sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]) { _, samples, error in
        lock.lock(); defer { lock.unlock(); group.leave() }
        if error != nil { failure = "permission"; return }
        let list = (samples as? [HKWorkout]) ?? []
        if list.count > 900 { failure = "sync_limit"; return }
        for workout in list {
          guard workout.duration.isFinite && workout.duration >= 0 && workout.duration <= 604800 else { failure = "invalid_data"; return }
          var row: [String: Any] = ["external_id": workout.uuid.uuidString, "kind": "workout", "name": "Apple Health workout", "sport": String(workout.workoutActivityType.rawValue), "started_at": Int(workout.startDate.timeIntervalSince1970), "duration_seconds": Int(workout.duration)]
          if let distance = workout.totalDistance {
            let metres = distance.doubleValue(for: .meter())
            guard metres.isFinite && metres >= 0 && metres <= 10000000 else { failure = "invalid_data"; return }
            row["distance_metres"] = metres
          }
          records.append(row)
        }
      }
      self.store.execute(workouts)
      group.enter()
      let statistics = HKStatisticsCollectionQuery(quantityType: steps, quantitySamplePredicate: predicate, options: .cumulativeSum, anchorDate: start, intervalComponents: DateComponents(day: 1))
      statistics.initialResultsHandler = { _, collection, error in
        lock.lock(); defer { lock.unlock(); group.leave() }
        if error != nil { failure = "permission"; return }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        collection?.enumerateStatistics(from: start, to: end) { item, _ in
          guard let quantity = item.sumQuantity() else { return }
          let count = quantity.doubleValue(for: .count())
          guard count.isFinite && count >= 0 && count <= 1000000 else { failure = "invalid_data"; return }
          records.append(["external_id": "steps-" + formatter.string(from: item.startDate), "kind": "steps", "name": "Steps", "sport": "", "started_at": Int(item.startDate.timeIntervalSince1970), "duration_seconds": 0, "steps": Int(count)])
        }
      }
      self.store.execute(statistics)
      group.notify(queue: .main) {
        lock.lock(); let result = records; let error = failure; lock.unlock()
        if let error = error { promise.reject(error, error) } else { promise.resolve(["activities": result]) }
      }
    }
  }
}
