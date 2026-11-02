import ActivityKit
import Foundation

@available(iOS 16.2, *)
enum WorkoutLiveActivity {
  static func update(_ record: [String: Any]) async throws {
    guard let account = record["accountKey"] as? String, account.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil,
          let status = record["status"] as? String else { return }
    let activities = Activity<WorkoutActivityAttributes>.activities
    if status == "idle" || status == "completed" {
      for activity in activities where activity.attributes.account == account {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
      return
    }
    guard ["running", "paused"].contains(status), ActivityAuthorizationInfo().areActivitiesEnabled,
          let mode = record["mode"] as? String, ["stopwatch", "countdown", "interval"].contains(mode),
          let elapsed = record["elapsed"] as? Double, elapsed.isFinite, elapsed >= 0, elapsed <= 86400,
          let startedAt = record["startedAt"] as? Double, startedAt.isFinite else { return }
    let work = record["work"] as? Double ?? 40
    let rest = record["rest"] as? Double ?? 20
    let rounds = record["rounds"] as? Double ?? 1
    let planned = mode == "stopwatch" ? 86400 : work * rounds + rest * max(0, rounds - 1)
    guard planned.isFinite, planned >= 1, planned <= 86400 else { return }
    let start = status == "running" ? startedAt / 1000 - elapsed : Date().timeIntervalSince1970 - elapsed
    let labels = record["labels"] as? [String: String] ?? [:]
    let state = WorkoutActivityAttributes.ContentState(mode: mode, status: status, elapsed: elapsed, start: start, end: start + planned,
      label: String((labels["workout"] ?? "Workout").prefix(100)), pausedLabel: String((labels["paused"] ?? "Paused").prefix(100)), completedLabel: String((labels["completed"] ?? "Workout complete").prefix(100)))
    let content = ActivityContent(state: state, staleDate: status == "running" ? Date(timeIntervalSince1970: state.end) : nil)
    if let activity = activities.first(where: { $0.attributes.account == account }) {
      await activity.update(content)
    } else if status == "running" {
      // ActivityKit only starts activities while the app is in the foreground.
      for activity in activities { await activity.end(nil, dismissalPolicy: .immediate) }
      let title = Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String ?? "Workout"
      _ = try Activity.request(attributes: WorkoutActivityAttributes(account: account, title: title), content: content, pushType: nil)
    }
  }
}
