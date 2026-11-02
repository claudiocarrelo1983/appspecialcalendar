import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { createWebViewRecovery } from './webViewRecovery';

export default function useWebViewRecovery(ref,base,setUrl) {
  const [state,setState]=useState({status:'ready',reference:'',revision:0});
  const recovery=useRef(null);
  if(!recovery.current)recovery.current=createWebViewRecovery({base,active:AppState.currentState==='active',
    inject:script=>ref.current?.injectJavaScript(script),remount:target=>setUrl(target),change:setState});
  useEffect(()=>{
    recovery.current.activate();
    const listener=AppState.addEventListener('change',recovery.current.appState);
    return()=>{listener.remove();recovery.current.dispose();};
  },[]);
  return {...state,...recovery.current};
}
