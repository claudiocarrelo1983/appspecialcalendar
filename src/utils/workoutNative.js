import {Platform} from 'react-native';
import {requireOptionalNativeModule} from 'expo-modules-core';
const native=requireOptionalNativeModule('SpecialCalendarHealth');
export const canSaveWorkout=Platform.OS==='ios'&&typeof native?.saveWorkout==='function';
export async function saveWorkoutToHealth(row){if(!canSaveWorkout)throw Error('native_unavailable');return native.saveWorkout(row);}
export async function updateWorkoutActivity(accountKey,timer){
  if(Platform.OS!=='ios'||typeof native?.updateWorkoutActivity!=='function')return;
  return native.updateWorkoutActivity({accountKey,...timer});
}
export async function timerAlarmAllowed(){return Platform.OS!=='android'||!native?.timerAlarmAllowed||await native.timerAlarmAllowed();}
export async function openTimerAlarmSettings(){return native?.openTimerAlarmSettings?.();}
