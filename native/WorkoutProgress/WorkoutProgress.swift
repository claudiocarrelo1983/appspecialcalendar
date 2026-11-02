import ActivityKit
import SwiftUI
import WidgetKit
import Foundation

@main
struct WorkoutProgressBundle: WidgetBundle {
  var body: some Widget { WorkoutProgress() }
}

struct WorkoutProgress: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: WorkoutActivityAttributes.self) { context in
      VStack(alignment: .leading, spacing: 12) {
        HStack { Image(systemName: "figure.strengthtraining.traditional"); Text(context.attributes.title).bold(); Spacer(); Text(context.state.label) }
        if context.isStale {
          Text(context.state.completedLabel).font(.title2.bold())
        } else if context.state.status == "paused" {
          Text(context.state.pausedLabel).font(.headline)
          Text(String(format: "%02d:%02d:%02d", Int(context.state.elapsed) / 3600, Int(context.state.elapsed) % 3600 / 60, Int(context.state.elapsed) % 60)).font(.system(size: 32, weight: .bold, design: .rounded))
        } else {
          Text(timerInterval: Date(timeIntervalSince1970: context.state.start)...Date(timeIntervalSince1970: context.state.end), countsDown: context.state.mode != "stopwatch")
            .font(.system(size: 36, weight: .bold, design: .rounded)).monospacedDigit()
          ProgressView(timerInterval: Date(timeIntervalSince1970: context.state.start)...Date(timeIntervalSince1970: context.state.end), countsDown: false).tint(.green)
        }
      }.padding().activityBackgroundTint(Color(.secondarySystemBackground)).activitySystemActionForegroundColor(.primary)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) { Image(systemName: "figure.strengthtraining.traditional").foregroundStyle(.green) }
        DynamicIslandExpandedRegion(.trailing) { Text(context.state.status == "paused" ? context.state.pausedLabel : context.state.label) }
        DynamicIslandExpandedRegion(.bottom) { progress(context) }
      } compactLeading: { Image(systemName: "timer").foregroundStyle(.green) }
        compactTrailing: { progress(context).frame(maxWidth: 64) }
        minimal: { Image(systemName: "timer").foregroundStyle(.green) }
    }
  }
  @ViewBuilder
  private func progress(_ context: ActivityViewContext<WorkoutActivityAttributes>) -> some View {
    if context.isStale { Image(systemName: "checkmark.circle.fill").foregroundStyle(.green) }
    else if context.state.status == "paused" { Image(systemName: "pause.fill") }
    else { Text(timerInterval: Date(timeIntervalSince1970: context.state.start)...Date(timeIntervalSince1970: context.state.end), countsDown: context.state.mode != "stopwatch").monospacedDigit() }
  }
}
