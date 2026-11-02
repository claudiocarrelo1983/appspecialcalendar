import ActivityKit
import Foundation

@available(iOS 16.2, *)
public struct WorkoutActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    public var mode: String
    public var status: String
    public var elapsed: Double
    public var start: Double
    public var end: Double
    public var label: String
    public var pausedLabel: String
    public var completedLabel: String
  }
  public var account: String
  public var title: String
}
