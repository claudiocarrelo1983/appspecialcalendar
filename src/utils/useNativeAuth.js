import {useCallback,useEffect,useRef,useState} from 'react';
import {authPageKind,nativeAuthScript,authSubmitScript,authLanguageScript,AUTH_MESSAGE,AUTH_LANGUAGE_MESSAGE} from './nativeAuthCore';
import {deviceAuthLanguage} from './nativeAuthTranslations';
const normUrl=url=>{
  try{
    const p=new URL(url);
    return `${p.origin}${p.pathname.replace(/\/index\/?$/,'').replace(/\/$/, '')}${p.search}`;
  }catch{return url;}
};
export default function useNativeAuth(ref,base,navigate){
  const [active,setActive]=useState(true),[document,setDocument]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [checkingSession,setCheckingSession]=useState(true);
  const [language,setLanguageState]=useState(deviceAuthLanguage());
  const languageRequest=useRef(null);
  const current=useRef(base),snapshot=useRef(null),timer=useRef(null),submitting=useRef(false);
  const awaitingDestination=useRef(true);
  const retired=useRef(new Set());
  const retire=()=>{if(snapshot.current?.revision)retired.current.add(snapshot.current.revision);if(retired.current.size>50)retired.current.delete(retired.current.values().next().value);};
  const stop=()=>{clearTimeout(timer.current);timer.current=null;};
  const deadline=()=>{stop();timer.current=setTimeout(()=>{setCheckingSession(false);setBusy(false);submitting.current=false;awaitingDestination.current=false;languageRequest.current=null;setError('connection');},20000);};
  useEffect(()=>{deadline();return stop;},[]);
  const onNavigation=useCallback(url=>{
    const kind=authPageKind(url,base);current.current=url;languageRequest.current=null;
    if(kind){retire();snapshot.current=null;setDocument(null);submitting.current=false;setActive(true);setError('');setBusy(true);deadline();}
  },[base]);
  const onLocation=useCallback(url=>{if(url&&url!==current.current)onNavigation(url);},[onNavigation]);
  const onLoadEnd=useCallback(url=>{
    onLocation(url);
    // Redirects may not emit another onLoadStart. Replay the final document's
    // snapshot only after committing its URL, including the guest login redirect.
    try{if(new URL(url).origin===new URL(base).origin)ref.current?.injectJavaScript(nativeAuthScript(base));}catch{}
  },[base,ref,onLocation]);
  const onMessage=useCallback(event=>{
    let value;try{value=JSON.parse(event.data);}catch{return false;}
    if(![AUTH_MESSAGE,AUTH_LANGUAGE_MESSAGE,'sc.auth.exit'].includes(value?.type))return false;
    let same=false;try{
      const sender=new URL(event.url),page=new URL(value.url),site=new URL(base);
      const originOnly=sender.pathname==='/'&&!sender.search&&!sender.hash;
      same=sender.origin===site.origin&&page.origin===site.origin&&!sender.username&&!sender.password&&!page.username&&!page.password&&(originOnly||value.url===event.url||normUrl(value.url)===normUrl(event.url));
    }catch{}
    if(!same)return true;
    // WKWebView can publish the completed redirect before its native URL event.
    // Permit this only while checking a session or submitting login, never after
    // an explicit logout or from a foreign document.
    const completedRedirect=value.type==='sc.auth.exit'&&awaitingDestination.current&&authPageKind(current.current,base)&&!authPageKind(value.url,base);
    if(current.current!==value.url&&!completedRedirect&&normUrl(current.current)!==normUrl(value.url))return true;
    if(value.type===AUTH_LANGUAGE_MESSAGE){
      if(!languageRequest.current||value.revision!==snapshot.current?.revision||value.language!==languageRequest.current)return true;
      if(value.success===true){setLanguageState(value.language);}else{stop();languageRequest.current=null;setBusy(false);setError('connection');}
      return true;
    }
    if(value.type==='sc.auth.exit'){
      if(authPageKind(value.url,base))return true;
      stop();current.current=value.url;snapshot.current=null;setDocument(null);setCheckingSession(false);setActive(false);setBusy(false);setError('');submitting.current=false;awaitingDestination.current=false;return true;
    }
    if(!authPageKind(value.url,base)||!Array.isArray(value.fields)||value.fields.length>80||!Array.isArray(value.links)||!Array.isArray(value.messages)||typeof value.revision!=='string')return true;
    const next=value;
    if(retired.current.has(next.revision))return true;
    if(languageRequest.current&&snapshot.current?.revision===next.revision)return true;
    const validation=next.fields.some(field=>field.error)||next.messages.some(message=>!(snapshot.current?.messages||[]).includes(message));
    if(submitting.current&&snapshot.current?.revision===next.revision&&!validation)return true;
    stop();submitting.current=false;awaitingDestination.current=false;current.current=next.url;snapshot.current=next;setDocument(next);setCheckingSession(false);if(['pt','en'].includes(next.language))setLanguageState(next.language);setActive(true);setBusy(false);setError('');return true;
  },[base]);
  const open=useCallback(url=>{
    if(!authPageKind(url,base))return;
    stop();retire();snapshot.current=null;setDocument(null);setCheckingSession(false);setActive(true);setBusy(true);setError('');submitting.current=false;awaitingDestination.current=false;current.current=url;deadline();navigate(url);
  },[base,navigate]);
  const submit=useCallback(values=>{
    if(submitting.current||!snapshot.current?.canSubmit||!ref.current)return;
    submitting.current=true;awaitingDestination.current=true;setBusy(true);setError('');deadline();
    ref.current.injectJavaScript(authSubmitScript(base,snapshot.current.url,snapshot.current.revision,values));
  },[base,ref]);
  const setLanguage=useCallback(value=>{
    if(!['pt','en'].includes(value)||value===language||busy||languageRequest.current||!snapshot.current||!ref.current)return;
    languageRequest.current=value;setBusy(true);setError('');deadline();
    ref.current.injectJavaScript(authLanguageScript(base,snapshot.current.url,snapshot.current.revision,value));
  },[base,ref,language,busy]);
  const fail=useCallback(event=>{
    if(Number(event?.code)===-999||event?.isTopFrame===false)return;
    if(event?.statusCode&&snapshot.current?.url===event.url&&(!snapshot.current.canSubmit&&snapshot.current.messages.length||snapshot.current.fields.some(field=>field.error)))return;
    if(authPageKind(event?.url||current.current,base)){stop();setCheckingSession(false);setBusy(false);submitting.current=false;awaitingDestination.current=false;setError('connection');}
  },[base]);
  return {active,document,busy,error,checkingSession,language,setLanguage,open,submit,onNavigation,onLocation,onLoadEnd,onMessage,fail,kind:document?.kind||authPageKind(current.current,base)||'login',
    retry:()=>open(authPageKind(current.current,base)?current.current:new URL('/login',base).href),login:()=>open(new URL('/login',base).href),injectedScript:nativeAuthScript(base)};
}
