import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { timerFrame } from './nativeGymCore';

export const TIMER_SOUND = 'gym_timer_finished.wav';
export const TIMER_CHANNEL = 'workout-timer-alerts-v1';
const queues = new Map();
export const timerAlertId = accountKey => 'gym-timer-' + accountKey;

// Serialize changes across screen mounts, pause/reset and logout so stale work
// cannot leave an alarm behind after a later cancellation.
export function createTimerAlerts(api, platform, now = Date.now) {
  const enqueue = (key, action) => {
    const task = (queues.get(key) || Promise.resolve()).catch(() => {}).then(action);
    queues.set(key, task);
    task.finally(() => { if (queues.get(key) === task) queues.delete(key); }).catch(() => {});
    return task;
  };
  const channel = async () => {
    if (platform === 'android') await api.setNotificationChannelAsync(TIMER_CHANNEL, {
      name: 'Workout timer', importance: api.AndroidImportance.MAX,
      sound: TIMER_SOUND, enableVibrate: true, vibrationPattern: [0, 400, 200, 400],
      audioAttributes: {usage: api.AndroidAudioUsage.ALARM},
    });
  };
  return {
    async permission() {
      await channel();
      let result = await api.getPermissionsAsync();
      if (!result.granted && result.canAskAgain) result = await api.requestPermissionsAsync({
        ios: {allowAlert: true, allowBadge: false, allowSound: true},
      });
      return !!result.granted && result.ios?.allowsSound !== false;
    },
    cancel(key) {
      return enqueue(key, () => api.cancelScheduledNotificationAsync(timerAlertId(key)));
    },
    finish(key, title, body) {
      return enqueue(key, async () => {
        const identifier = timerAlertId(key);
        await api.cancelScheduledNotificationAsync(identifier);
        // The OS may already have delivered the deadline alert. Avoid a second
        // sound when the foreground clock reaches the same deadline.
        const shown = await api.getPresentedNotificationsAsync();
        if (shown.some(item => item.request.identifier === identifier)) return;
        await api.scheduleNotificationAsync({identifier,
          content: {title, body, sound: TIMER_SOUND, vibrate: [0, 400, 200, 400],
            data: {type: 'workout-timer'}, priority: api.AndroidNotificationPriority.HIGH},
          trigger: platform === 'android' ? {channelId: TIMER_CHANNEL} : null,
        });
      });
    },
    sync(key, timer, title, body) {
      return enqueue(key, async () => {
        // Natural completion must not cancel a background notification that
        // Android is still delivering. Manual Finish cancels explicitly.
        if (timer.status === 'completed') return;
        await api.cancelScheduledNotificationAsync(timerAlertId(key));
        if (timer.status !== 'running' || timer.mode === 'stopwatch') return;
        const deadline = timer.startedAt + (timerFrame(timer, now()).planned - timer.elapsed) * 1000;
        // An elapsed timer restored on launch has already had its scheduled alert.
        if (deadline <= now()) return;
        const permission = await api.getPermissionsAsync();
        if (!permission.granted || permission.ios?.allowsSound === false) throw Error('timerSoundDisabled');
        await channel();
        await api.dismissNotificationAsync(timerAlertId(key));
        await api.scheduleNotificationAsync({identifier: timerAlertId(key),
          content: {title, body, sound: TIMER_SOUND, vibrate: [0, 400, 200, 400],
            data: {type: 'workout-timer'}, priority: api.AndroidNotificationPriority.HIGH},
          trigger: {type: api.SchedulableTriggerInputTypes.DATE, date: new Date(deadline), channelId: TIMER_CHANNEL},
        });
      });
    },
  };
}
const alerts = createTimerAlerts(Notifications, Platform.OS);
export const cancelTimerAlert = key => alerts.cancel(key);
export default alerts;
