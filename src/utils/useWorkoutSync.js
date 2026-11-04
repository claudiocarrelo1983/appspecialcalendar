import {useCallback,useEffect,useRef} from 'react';
import {AppState} from 'react-native';
import history from './workoutHistory';
import * as SecureStore from 'expo-secure-store';
import {sameGymOrigin,validTimer,timerFrame} from './nativeGymCore';
import {updateWorkoutActivity} from './workoutNative';
import workoutHealth from './workoutHealthAuto';
// Literal source is safe in Hermes release bundles.
const WORKOUT_SYNC_SOURCE=String.raw`async function(c){
    if(location.origin!==c.origin||!window.ReactNativeWebView)return;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try{
      const security=await fetch('/api/v1/csrf',{credentials:'same-origin',redirect:'error',cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}});
      const csrf=await security.json();if(!security.ok||!csrf.success||!csrf.data.token)throw Error('csrf');
      const response=await fetch('/native-workouts/sync',{method:'POST',credentials:'same-origin',redirect:'error',signal:controller.signal,headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded','X-CSRF-Token':csrf.data.token},body:new URLSearchParams({ownerKey:c.ownerKey,rows:JSON.stringify(c.rows)}).toString()});
      const result=await response.json();if(!response.ok||!result.success)throw Error('sync');
      const pull=await fetch('/native-workouts',{credentials:'same-origin',redirect:'error',cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}});
      const history=await pull.json();
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'sc.workouts.sync',id:c.id,success:pull.ok&&history.success&&history.ownerKey===c.ownerKey,ids:result.ids||[],rows:history.rows||[]}));
    }catch{window.ReactNativeWebView.postMessage(JSON.stringify({type:'sc.workouts.sync',id:c.id,success:false}));}finally{clearTimeout(timer);}
  }`;

export function workoutSyncScript(base,id,ownerKey,rows){
  return '('+WORKOUT_SYNC_SOURCE+')('+JSON.stringify({origin:new URL(base).origin,id,ownerKey,rows})+');true;';
}
export default function useWorkoutSync(ref,base,accountKey){
  const pending=useRef(null),sequence=useRef(0),preparing=useRef(false);
  const owner=useRef(accountKey);owner.current=accountKey;
  const sync=useCallback(async()=>{
    if(!accountKey||pending.current||preparing.current||!ref.current)return;
    preparing.current=true;try{
    const saved=JSON.parse(await SecureStore.getItemAsync('native-gym-timer-'+accountKey)||'{}');
    if(validTimer(saved.timer)&&saved.timer.status==='running'&&saved.timer.runId){
      const frame=timerFrame(saved.timer);
      if(frame.finished){
        await history.add(accountKey,{id:saved.timer.runId,mode:saved.timer.mode,seconds:frame.planned,at:saved.timer.startedAt+Math.max(0,frame.planned-saved.timer.elapsed)*1000,healthAuto:saved.timer.healthAuto===true});
        // Do not overwrite an actively mounted timer's persistence; UUID deduplication
        // lets its own completion transition safely record the same workout.
        await updateWorkoutActivity(accountKey,{status:'completed'}).catch(()=>{});
      }
    }
    await workoutHealth.flush(accountKey);
    const rows=(await history.list(accountKey)).filter(row=>!row.synced).slice(0,20);
    if(owner.current!==accountKey)return;
    const id=String(++sequence.current),timer=setTimeout(()=>{if(pending.current?.id===id)pending.current=null;},15000);
    pending.current={id,accountKey,ids:rows.map(row=>row.id),timer};
    ref.current.injectJavaScript(workoutSyncScript(base,id,accountKey,rows));
    }finally{preparing.current=false;}
  },[accountKey,base,ref]);
  useEffect(()=>{
    sync().catch(()=>{});const timer=setInterval(()=>sync().catch(()=>{}),30000);
    const app=AppState.addEventListener('change',state=>{if(state==='active')sync().catch(()=>{});});
    return()=>{clearInterval(timer);app.remove();clearTimeout(pending.current?.timer);pending.current=null;};
  },[sync]);
  const onMessage=useCallback(event=>{
    let value;try{value=JSON.parse(event.data);}catch{return false;}
    if(value?.type!=='sc.workouts.sync')return false;
    if(!sameGymOrigin(event.url,base)||value.id!==pending.current?.id)return true;
    const request=pending.current;clearTimeout(request.timer);pending.current=null;
    if(value.success&&Array.isArray(value.ids))for(const id of value.ids)if(request.ids.includes(id))history.mark(request.accountKey,id,{synced:true}).catch(()=>{});
    if(value.success&&Array.isArray(value.rows)&&value.rows.length<=200)history.merge(request.accountKey,value.rows).catch(()=>{});
    return true;
  },[base]);
  return {onMessage,sync};
}
