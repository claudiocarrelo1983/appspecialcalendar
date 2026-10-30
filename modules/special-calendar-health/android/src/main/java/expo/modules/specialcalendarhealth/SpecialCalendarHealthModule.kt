package expo.modules.specialcalendarhealth

import android.os.Build
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.request.AggregateGroupByDurationRequest
import androidx.health.connect.client.time.TimeRangeFilter
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset

class SpecialCalendarHealthModule : Module() {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private val requested = setOf(HealthPermission.getReadPermission(ExerciseSessionRecord::class), HealthPermission.getReadPermission(StepsRecord::class))
  private var permissionPromise: Promise? = null
  private val permissionRequestCode = 7314
  private fun client(): HealthConnectClient = HealthConnectClient.getOrCreate(requireNotNull(appContext.reactContext))
  private fun available(): Boolean = Build.VERSION.SDK_INT >= 28 && appContext.reactContext?.let { HealthConnectClient.getSdkStatus(it) == HealthConnectClient.SDK_AVAILABLE } == true

  override fun definition() = ModuleDefinition {
    Name("SpecialCalendarHealth")
    AsyncFunction("status") { -> mapOf("available" to available(), "reason" to if (Build.VERSION.SDK_INT < 28) "android_version" else "health_connect_unavailable") }
    AsyncFunction("connect") { promise: Promise ->
      val activity = appContext.currentActivity
      if (!available() || activity == null) { promise.reject("native_unavailable", "native_unavailable", null) }
      else if (permissionPromise != null) { promise.reject("busy", "busy", null) }
      else {
        permissionPromise = promise
        activity.runOnUiThread {
          try {
            val intent = PermissionController.createRequestPermissionResultContract().createIntent(activity, requested)
            activity.startActivityForResult(intent, permissionRequestCode)
          } catch (error: Exception) { permissionPromise = null; promise.reject("permission", "permission", error) }
        }
      }
    }
    OnActivityResult { _, result ->
      if (result.requestCode == permissionRequestCode) {
        val promise = permissionPromise
        permissionPromise = null
        scope.launch {
          try {
            val granted = client().permissionController.getGrantedPermissions().intersect(requested)
            if (granted.isEmpty()) promise?.reject("permission", "permission", null)
            else promise?.resolve(mapOf("permission_requested" to true))
          } catch (error: Exception) { promise?.reject("permission", "permission", error) }
        }
      }
    }
    AsyncFunction("disconnect") { promise: Promise ->
      // Permissions are app-wide. Unlink only the selected company; a user may
      // still have a connection in another company. OS revocation is explicit.
      promise.resolve(mapOf("disconnected" to true, "device_revoke_required" to true))
    }
    AsyncFunction("sync") { days: Int, promise: Promise ->
      scope.launch {
        try {
          if (!available() || days !in listOf(7, 30)) { promise.reject("native_unavailable", "native_unavailable", null); return@launch }
          val client = client()
          val granted = client.permissionController.getGrantedPermissions()
          if (granted.intersect(requested).isEmpty()) { promise.reject("permission", "permission", null); return@launch }
          val end = Instant.now()
          // Stay inside Health Connect's standard 30-day read window. Reading
          // older history would require an additional history permission.
          val start = end.minus(Duration.ofDays((days - 1).toLong())).atZone(ZoneOffset.UTC).toLocalDate().atStartOfDay(ZoneOffset.UTC).toInstant()
          val filter = TimeRangeFilter.between(start, end)
          val rows = mutableListOf<Map<String, Any>>()
          if (HealthPermission.getReadPermission(ExerciseSessionRecord::class) in granted) {
            var page: String? = null
            do {
              val response = client.readRecords(ReadRecordsRequest(ExerciseSessionRecord::class, filter, pageSize = 500, pageToken = page))
              response.records.forEach { item -> rows.add(mapOf("external_id" to item.metadata.id, "kind" to "workout", "name" to (item.title ?: "Health Connect workout"), "sport" to item.exerciseType.toString(), "started_at" to item.startTime.epochSecond, "duration_seconds" to Duration.between(item.startTime, item.endTime).seconds)) }
              page = response.pageToken
              if (rows.size > 900) { promise.reject("sync_limit", "sync_limit", null); return@launch }
            } while (page != null)
          }
          if (HealthPermission.getReadPermission(StepsRecord::class) in granted) {
            val groups = client.aggregateGroupByDuration(AggregateGroupByDurationRequest(setOf(StepsRecord.COUNT_TOTAL), filter, Duration.ofDays(1)))
            groups.forEach { group ->
              group.result[StepsRecord.COUNT_TOTAL]?.let { count -> rows.add(mapOf("external_id" to ("steps-" + group.startTime.atZone(ZoneOffset.UTC).toLocalDate().toString()), "kind" to "steps", "name" to "Steps", "sport" to "", "started_at" to group.startTime.epochSecond, "duration_seconds" to 0, "steps" to count)) }
            }
          }
          promise.resolve(mapOf("activities" to rows))
        } catch (error: SecurityException) { promise.reject("permission", "permission", error) }
        catch (error: Exception) { promise.reject("native_unavailable", "native_unavailable", error) }
      }
    }
    OnDestroy { permissionPromise?.reject("native_unavailable", "native_unavailable", null); permissionPromise = null; scope.cancel() }
  }
}
