import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { timerFrame } from './nativeGymCore';
import {updateWorkoutActivity} from './workoutNative';

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
  const cancelSets=async key=>{
    if(!api.getAllScheduledNotificationsAsync)return;
    const prefix=timerAlertId(key)+'-set-';
    for(const item of await api.getAllScheduledNotificationsAsync())if(item.identifier.startsWith(prefix))await api.cancelScheduledNotificationAsync(item.identifier);
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
      return enqueue(key, async()=>{await api.cancelScheduledNotificationAsync(timerAlertId(key));await cancelSets(key);});
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
    sync(key, timer, title, body, setTitle='Set complete') {
      return enqueue(key, async () => {
        // Natural completion must not cancel a background notification that
        // Android is still delivering. Manual Finish cancels explicitly.
        if (timer.status === 'completed') return;
        await api.cancelScheduledNotificationAsync(timerAlertId(key));
        await cancelSets(key);
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
        // Reserve the final alert and keep interval sets within iOS's pending
        // notification limit. New interval workouts are limited to 30 sets.
        if(timer.mode==='interval')for(let round=1;round<Math.min(timer.rounds,31);round++){
          const seconds=round*timer.work+(round-1)*timer.rest;
          const date=timer.startedAt+(seconds-timer.elapsed)*1000;
          if(date<=now()||date>=deadline)continue;
          await api.scheduleNotificationAsync({identifier:timerAlertId(key)+'-set-'+round,
            content:{title:setTitle,body:round+' / '+timer.rounds,sound:TIMER_SOUND,vibrate:[0,180],data:{type:'workout-set'},priority:api.AndroidNotificationPriority.HIGH},
            trigger:{type:api.SchedulableTriggerInputTypes.DATE,date:new Date(date),channelId:TIMER_CHANNEL}});
        }
      });
    },
  };
}
const alerts = createTimerAlerts(Notifications, Platform.OS);
export const cancelTimerAlert = async key => {await alerts.cancel(key);await updateWorkoutActivity(key,{status:'idle'}).catch(()=>{});};
export default alerts;
