import {useCallback,useEffect,useRef,useState} from 'react';
import {AppState,Linking} from 'react-native';
import {sameGymOrigin,isClientDashboard} from './nativeGymCore';
import {CLIENT_BOOKINGS_MESSAGE,clientBookingsScript,validClientBookings} from './clientBookingsCore';

export default function useClientBookings(ref,base,accountKey,showing,language){
  const [page,setPage]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[reference,setReference]=useState(''),[notice,setNotice]=useState(''),[focused,setFocused]=useState(null);
  const source=useRef(base),query=useRef({}),pending=useRef(new Map()),sequence=useRef(0),revision=useRef(0),active=useRef(true),pageRef=useRef(null),mutating=useRef(false),identity=useRef(accountKey);
  identity.current=accountKey;
  const visible=useRef(showing),previousIdentity=useRef(null),owner=useRef(null);visible.current=showing;
  const scheduleLoad=useRef(null),currentLanguage=useRef(language);currentLanguage.current=language;
  const request=useCallback((action,params={})=>new Promise((resolve,reject)=>{
    if(!identity.current||!sameGymOrigin(source.current,base)||!ref.current){reject(Error('offline'));return;}
    const id=String(++sequence.current),timer=setTimeout(()=>{pending.current.delete(id);reject(Error('connection'));},action==='schedule'?27000:15000);
    pending.current.set(id,{resolve,reject,timer});
    try{ref.current.injectJavaScript(clientBookingsScript(base,id,action,params));}catch(failure){clearTimeout(timer);pending.current.delete(id);reject(failure);}
  }),[base,ref]);
  const load=useCallback(async (params,reusePending=false)=>{
    query.current={...query.current,...params};
    const requestIdentity=identity.current,key=JSON.stringify([requestIdentity,currentLanguage.current,Object.entries(query.current).sort(([a],[b])=>a.localeCompare(b))]);
    if(reusePending&&scheduleLoad.current?.key===key)return scheduleLoad.current.promise;
    const current=++revision.current;setBusy(true);setError('');setReference('');
    const operation=(async()=>{
    try{
      const result=await request('schedule',query.current);
      if(!active.current||current!==revision.current||requestIdentity!==identity.current)return;
      if(!validClientBookings(result.data))throw Error('invalid_response');
      owner.current=requestIdentity;pageRef.current=result.data;setPage(result.data);
      // A resume refresh may supersede the first request opened by a push.
      // Use the retained occurrence query, not only the latest call's params.
      if(query.current.schedule_id)setFocused(String(query.current.schedule_id));
      query.current={date:result.data.date,client_guid:result.data.clientGuid,company_code:result.data.companyCode};
    }catch(failure){if(active.current&&current===revision.current){setError(failure.message);setReference(failure.reference||failure.message);}}
    finally{if(active.current&&current===revision.current)setBusy(false);if(scheduleLoad.current?.revision===current)scheduleLoad.current=null;}
    })();
    scheduleLoad.current={key,promise:operation,revision:current};return operation;
  },[request]);
  const reset=useCallback(()=>{
    revision.current++;scheduleLoad.current=null;pending.current.forEach(item=>{clearTimeout(item.timer);item.reject(Error('navigating'));});pending.current.clear();query.current={};pageRef.current=null;setPage(null);setFocused(null);setError('');setNotice('');setBusy(false);mutating.current=false;
  },[]);
  useEffect(()=>{
    let params;
    if(previousIdentity.current!==accountKey){
      previousIdentity.current=accountKey;reset();owner.current=null;
      if(isClientDashboard(source.current,base)){const target=new URL(source.current);params={};for(const key of ['date','company_code','client_guid','schedule_id'])if(target.searchParams.has(key))params[key]=target.searchParams.get(key);}
    }
    if(accountKey&&showing)load(params,true);
  },[accountKey,showing,language,base,load,reset]);
  useEffect(()=>{active.current=true;const listener=AppState.addEventListener('change',state=>{if(state==='active'&&identity.current&&visible.current)load(undefined,true);});return()=>{active.current=false;revision.current++;scheduleLoad.current=null;listener.remove();pending.current.forEach(item=>{clearTimeout(item.timer);item.reject(Error('navigating'));});pending.current.clear();};},[base,load]);
  const onNavigation=useCallback(url=>{source.current=url||base;revision.current++;scheduleLoad.current=null;pending.current.forEach(item=>{clearTimeout(item.timer);item.reject(Error('navigating'));});pending.current.clear();setBusy(false);if(!sameGymOrigin(url,base)||/\/(?:site\/)?(?:login|logout)(?:\/|$)/.test(new URL(url||base,base).pathname))reset();},[base,reset]);
  const onLoadEnd=useCallback(url=>{
    source.current=url||source.current;if(!isClientDashboard(source.current,base))return;
    const target=new URL(source.current),params={};for(const key of ['date','company_code','client_guid','schedule_id'])if(target.searchParams.has(key))params[key]=target.searchParams.get(key);
    if(identity.current)load(params,true);else query.current=params;
  },[base,load]);
  const onMessage=useCallback(event=>{
    if(typeof event.data!=='string'||event.data.length>2000000)return false;let message;try{message=JSON.parse(event.data);}catch{return false;}
    if(message.type!==CLIENT_BOOKINGS_MESSAGE)return false;if(!sameGymOrigin(event.url||source.current,base))return true;
    const item=pending.current.get(message.id);if(!item)return true;clearTimeout(item.timer);pending.current.delete(message.id);
    if(message.status===401||message.status===403){reset();setError('forbidden');setReference('HTTP_'+message.status);const failure=Error('forbidden');failure.reference='HTTP_'+message.status;item.reject(failure);return true;}
    if(message.status>=200&&message.status<300&&message.result?.success===true)item.resolve(message.result);
    else{const failure=Error(message.status>=500?'server':(message.reason||(['401','403'].includes(String(message.status))?'forbidden':(typeof message.result?.message==='string'?message.result.message.slice(0,500):'request_failed'))));failure.reference=message.status?'HTTP_'+message.status+(message.reason==='invalid_response'?'_invalid_response':''):message.reason||'connection';item.reject(failure);}
    return true;
  },[base,reset]);
  const perform=useCallback(async action=>{
    if(mutating.current||action.enabled===false)return;mutating.current=true;setBusy(true);setError('');setNotice('');const currentIdentity=identity.current;
    try{
      const result=await request(action.kind,action.params);
      if(!active.current||identity.current!==currentIdentity)return;
      if(result.checkout_url){const checkout=new URL(result.checkout_url);if(checkout.protocol!=='https:'||checkout.hostname!=='checkout.stripe.com')throw Error('invalid_response');await Linking.openURL(checkout.href);}
      setNotice(typeof result.message==='string'?result.message.slice(0,500):'');await load();return true;
    }catch(failure){if(active.current&&identity.current===currentIdentity){setError(failure.message);setReference(failure.reference||failure.message);}return false;}
    finally{mutating.current=false;if(active.current&&identity.current===currentIdentity)setBusy(false);}
  },[request,load]);
  return {page:owner.current===accountKey?page:null,busy,error,reference,notice,focused,closeFocused:()=>setFocused(null),load,perform,request,onNavigation,onLoadEnd,onMessage};
}
