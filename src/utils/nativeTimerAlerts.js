import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { timerFrame } from './nativeGymCore';
import {updateWorkoutActivity} from './workoutNative';

export const TIMER_SOUND = 'gym_timer_finished.wav';
export const TIMER_CHANNEL = 'workout-timer-finish-v2';
export const TIMER_CUES={work:{sound:'gym_timer_work.wav',channel:'workout-timer-work-v1',vibrate:[0,120,80,120]},rest:{sound:'gym_timer_rest.wav',channel:'workout-timer-rest-v1',vibrate:[0,220]},finish:{sound:TIMER_SOUND,channel:TIMER_CHANNEL,vibrate:[0,400,200,400]}};
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
    if (platform === 'android') for(const [phase,cue] of Object.entries(TIMER_CUES))await api.setNotificationChannelAsync(cue.channel, {
      name: 'Workout timer · '+phase, importance: api.AndroidImportance.MAX,
      sound: cue.sound, enableVibrate: true, vibrationPattern: cue.vibrate,
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
      return enqueue(key, async()=>{await api.cancelScheduledNotificationAsync(timerAlertId(key));await api.cancelScheduledNotificationAsync(timerAlertId(key)+'-cue');await cancelSets(key);});
    },
    cue(key,phase,title){
      return enqueue(key,async()=>{
        const cue=TIMER_CUES[phase];if(!cue)return;
        const permission=await api.getPermissionsAsync();if(!permission.granted||permission.ios?.allowsSound===false)return;
        await channel();
        await api.scheduleNotificationAsync({identifier:timerAlertId(key)+'-cue',content:{title,sound:cue.sound,vibrate:cue.vibrate,data:{type:'workout-set',phase},priority:api.AndroidNotificationPriority.HIGH},trigger:platform==='android'?{channelId:cue.channel}:null});
      });
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
    sync(key, timer, title, body, setTitle='Set complete',labels={}) {
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
        // The final alarm has priority. Respect iOS's 64-pending limit, including
        // other reminders. Thirty rounds need at most 58 transitions + the final.
        let budget=platform==='ios'&&api.getAllScheduledNotificationsAsync?Math.max(0,64-(await api.getAllScheduledNotificationsAsync()).length):Infinity,limited=false;
        if(timer.mode==='interval')for(let round=1;round<Math.min(timer.rounds,31);round++){
          const workEnd=round*timer.work+(round-1)*timer.rest;
          const transitions=timer.rest>0?[{phase:'rest',seconds:workEnd,round},{phase:'work',seconds:workEnd+timer.rest,round:round+1}]:[{phase:'work',seconds:workEnd,round:round+1}];
          for(const transition of transitions){
            const date=timer.startedAt+(transition.seconds-timer.elapsed)*1000;
            if(date<=now()||date>=deadline)continue;
            if(budget<=0){limited=true;continue;}
            const cue=TIMER_CUES[transition.phase];
            await api.scheduleNotificationAsync({identifier:timerAlertId(key)+'-set-'+round+(transition.phase==='work'?'-work':''),
              content:{title:labels[transition.phase]||(transition.phase==='work'?'Work':setTitle),body:(labels.round||'Round')+' '+transition.round+' / '+timer.rounds,sound:cue.sound,vibrate:cue.vibrate,data:{type:'workout-set',phase:transition.phase},priority:api.AndroidNotificationPriority.HIGH},
              trigger:{type:api.SchedulableTriggerInputTypes.DATE,date:new Date(date),channelId:cue.channel}});
            budget--;
          }
        }
        if(limited)throw Error('timerPhaseLimit');
      });
    },
  };
}
const alerts = createTimerAlerts(Notifications, Platform.OS);
export const cancelTimerAlert = async key => {await alerts.cancel(key);await updateWorkoutActivity(key,{status:'idle'}).catch(()=>{});};
export default alerts;
