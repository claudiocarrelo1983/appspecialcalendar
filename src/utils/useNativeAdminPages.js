import { useCallback, useEffect, useRef, useState } from 'react';
import { sameGymOrigin } from './nativeGymCore';
import { ADMIN_PAGES_MESSAGE, adminListUrl, adminPageScript, validAdminPage } from './nativeAdminPages';
import { adminCandidateUrl, publicOrClientUrl, adminDocumentMessageMatches } from './nativeAdminNavigation';

export default function useNativeAdminPages(ref, base, navigateWeb) {
  const [document, setDocument] = useState(null), [page, setPage] = useState(null);
  const [busy,setBusy] = useState(false), [error,setError] = useState(''), [web,setWeb] = useState(false);
  const [startup,setStartup]=useState('idle');
  const [diagnostic,setDiagnostic]=useState('');
  const [localScreen,setLocalScreen]=useState(null),[sessionVersion,setSessionVersion]=useState(0);
  const doc = useRef(null), current = useRef(null), source = useRef(base), pending = useRef(null), sequence = useRef(0);
  const cache = useRef(new Map()), history = useRef([]), active = useRef(true), previousSource = useRef('');
  const offsets = useRef(new Map());
  const confirmedAdmin=useRef(false),bootstrapTimer=useRef(null);
  const documentGeneration=useRef(0);
  const warm=useRef(new Map()),warmTimer=useRef(null),warmSequence=useRef(0);
  const stopWarm=useCallback(()=>{clearTimeout(warmTimer.current);warmTimer.current=null;warm.current.clear();},[]);
  const stopBootstrap=useCallback(()=>{if(bootstrapTimer.current)clearTimeout(bootstrapTimer.current);bootstrapTimer.current=null;},[]);
  const isAdminRoute=useCallback(url=>adminCandidateUrl(url,base)||(confirmedAdmin.current&&!publicOrClientUrl(url,base)),[base]);
  const onLocation=useCallback(url=>{
    if(!isAdminRoute(url)||doc.current)return;
    setStartup('loading');
    if(!bootstrapTimer.current)bootstrapTimer.current=setTimeout(()=>{
      bootstrapTimer.current=null;if(active.current&&!doc.current){setStartup('failed');setError('native_setup');setDiagnostic('ADMIN_BRIDGE_TIMEOUT');}
    },15000);
  },[isAdminRoute]);
  const display = useCallback(value => {current.current=value;setPage(value);setWeb(value?.kind==='web');setLocalScreen(null);setError('');},[]);
  const cancel = useCallback(() => {stopWarm();sequence.current++;if(pending.current)clearTimeout(pending.current.timer);pending.current=null;setBusy(false);},[stopWarm]);
  const clear = useCallback(() => {cancel();stopBootstrap();confirmedAdmin.current=false;setSessionVersion(value=>value+1);setStartup('idle');setDiagnostic('');doc.current=null;setDocument(null);display(null);cache.current.clear();offsets.current.clear();history.current=[];},[cancel,display,stopBootstrap]);
  const openWeb = useCallback(url => {
    if (!sameGymOrigin(url,base)) return;
    cancel();setWeb(true);setLocalScreen(null);cache.current.clear();history.current=[];
    if (url === source.current) return;
    navigateWeb(url);
  },[base,cancel,navigateWeb]);
  const read = useCallback((url,remember=true,force=false) => {
    const target=adminListUrl(url,base);
    if(!target||!doc.current) {openWeb(url);return;}
    if(remember && current.current?.url !== target && current.current) {
      history.current.push(current.current);if(history.current.length>12)history.current.shift();
    }
    cancel();const id='page:'+sequence.current;
    const cached=cache.current.get(target);
    if(cached && !force) {display(cached.page);if(Date.now()-cached.at<60000)return;}
    setBusy(true);setError('');
    const timer=setTimeout(()=>{if(pending.current?.id===id){pending.current=null;setBusy(false);setError('offline');}},15000);
    pending.current={id,url:target,timer};ref.current?.injectJavaScript(adminPageScript(base,'read',{url:target,id}));
  },[base,cancel,display,openWeb,ref]);
  const navigate = useCallback(url => {
    if(!sameGymOrigin(url,base))return;
    if(/^\/workout-timer(?:\/index)?\/?$/.test(new URL(url).pathname)){
      const permitted=items=>(items||[]).some(item=>item.url&&/^\/workout-timer(?:\/index)?\/?$/.test(new URL(item.url).pathname)||permitted(item.children));
      if(doc.current&&(permitted(doc.current.menuTree)||permitted(doc.current.menu))){cancel();setLocalScreen('timer');setWeb(false);setError('');}
      return;
    }
    if(url===doc.current?.page?.url){
      if(current.current && current.current.url!==url)history.current.push(current.current);
      cancel();display(doc.current.page);return;
    }
    read(url);
  },[base,cancel,display,read]);
  const back = useCallback(() => {
    if(localScreen){setLocalScreen(null);return true;}
    if(!history.current.length)return false;
    cancel();display(history.current.pop());return true;
  },[cancel,display,localScreen]);
  const invoke = useCallback((id,values) => {
    if(!doc.current||busy)return;
    cache.current.clear();setBusy(true);setError('');
    ref.current?.injectJavaScript(adminPageScript(base,values?'submit':'invoke',{id,values}));
    // Page navigation and AJAX updates publish fresh snapshots. Unlock if no update occurs.
    cancel();setBusy(true);const requestId='action:'+sequence.current;
    pending.current={id:requestId,timer:setTimeout(()=>{
      if(active.current&&pending.current?.id===requestId){pending.current=null;setBusy(false);}
    },5000)};
  },[base,busy,cancel,ref]);
  const onNavigation = useCallback(url => {
    documentGeneration.current++;setDiagnostic('');
    stopBootstrap();if(publicOrClientUrl(url,base)){confirmedAdmin.current=false;setSessionVersion(value=>value+1);}
    source.current=url||'';cancel();setWeb(false);setError('');
    // A real document load may change the account, company or its permissions.
    doc.current=null;setDocument(null);display(null);cache.current.clear();history.current=[];
    setStartup('idle');onLocation(url);
    if(!sameGymOrigin(url,base)||/^\/(?:site\/)?(?:login|logout)?\/?$/.test(new URL(url,base).pathname))offsets.current.clear();
  },[base,cancel,display,onLocation,stopBootstrap]);
  const onLoadEnd = useCallback(url => {
    // Redirects do not consistently produce a second onLoadStart in Android WebView.
    // Commit its final URL before validating the document snapshot.
    if (!sameGymOrigin(url,base)) {clear();return;}
    if(source.current!==url)onNavigation(url);
    source.current=url;
    onLocation(url);
    ref.current?.injectJavaScript(adminPageScript(base,'install',{documentId:documentGeneration.current}));
  },[base,clear,onLocation,onNavigation,ref]);
  const change = useCallback((id,value) => {
    if(!doc.current||busy)return;
    cache.current.clear();cancel();setBusy(true);setError('');
    const requestId='change:'+sequence.current;
    pending.current={id:requestId,timer:setTimeout(()=>{
      if(active.current&&pending.current?.id===requestId){pending.current=null;setBusy(false);setError('offline');}
    },15000)};
    ref.current?.injectJavaScript(adminPageScript(base,'change',{id,value}));
  },[base,busy,cancel,ref]);
  const onMessage = useCallback(event => {
    if(typeof event.data!=='string'||event.data.length>500000)return false;
    let message;try{message=JSON.parse(event.data);}catch{return false;}
    if(!message||message.type!==ADMIN_PAGES_MESSAGE)return false;
    if(!sameGymOrigin(event.url||source.current,base))return true;
    if(!adminDocumentMessageMatches(event.url,message,source.current,base,documentGeneration.current))return true;
    if(message.event==='response'&&warm.current.has(message.id)){
      const target=warm.current.get(message.id);warm.current.delete(message.id);
      if(message.status===200&&validAdminPage(message.page,base)&&message.page.url===target&&message.page.kind!=='web'){
        cache.current.set(target,{at:Date.now(),page:message.page});
        if(cache.current.size>8)cache.current.delete(cache.current.keys().next().value);
      }else if([401,403].includes(message.status))cache.current.clear();
      return true;
    }
    if(message.event==='error') {
      stopBootstrap();setStartup('failed');setError('native_setup');setDiagnostic('ADMIN_SNAPSHOT_FAILED');
    }else if(message.event==='document') {
      if (message.page && !validAdminPage(message.page,base)) return true;
      if(!message.active){
        const candidate=isAdminRoute(source.current);clear();
        if(candidate){
          const reason=['HEADER_MISSING','ACCOUNT_CONTROL_MISSING','ROLE_UNRECOGNIZED','CLIENT_PAGE'].includes(message.reason)?message.reason:'UNKNOWN';
          setStartup('failed');setError('native_setup');setDiagnostic('ADMIN_DOCUMENT_UNAVAILABLE_V2_'+reason);return true;
        }
        return {documentRole:message.client===true?'client':'public',documentUrl:message.documentUrl};
      }
      if(!validAdminPage(message.page,base)||!Array.isArray(message.footer)||!Array.isArray(message.menu))return true;
      const selected=current.current,previousDocument=doc.current;
      const followDocument=!selected||selected.url===message.page.url||selected.url===previousDocument?.page?.url;
      const reading=pending.current?.id.startsWith('page:')===true;
      // Header AJAX updates belong to the backing document. They must not replace
      // a different native tab or cancel its independent read request.
      if(!reading)cancel();
      stopBootstrap();confirmedAdmin.current=true;setStartup('active');setDiagnostic('');const wasSame=previousSource.current===message.page.url;
      previousSource.current=message.page.url;doc.current=message;setDocument(message);
      setBusy(reading||message.page.submitting === true);
      // Keep the explicit full-page choice during validation/AJAX updates.
      if(followDocument){current.current=message.page;setPage(message.page);if(message.page.kind==='web')setWeb(true);else if(!wasSame)setWeb(false);}
      ref.current?.injectJavaScript(adminPageScript(base,'frame',{enabled:true}));
      if(adminListUrl(message.page.url,base))cache.current.set(message.page.url,{at:Date.now(),page:message.page});
      return {documentRole:'admin',documentUrl:message.documentUrl};
    }else if(message.event==='response'&&pending.current?.id===message.id) {
      const target=pending.current.url;cancel();
      if(message.status===401||message.status===403) {
        clear();ref.current?.injectJavaScript(adminPageScript(base,'frame',{enabled:false}));
        setStartup('failed');setError('native_setup');setDiagnostic('HTTP_'+message.status);
        // Show the server's access response; no permission fallback or alternate endpoint.
        navigateWeb(target);
      }else if(message.status===200&&validAdminPage(message.page,base)) {
        cache.current.set(target,{at:Date.now(),page:message.page});if(cache.current.size>8)cache.current.delete(cache.current.keys().next().value);
        if(message.page.kind==='web')openWeb(target);else display(message.page);
      }else setError('offline');
    }
    return true;
  },[base,cancel,clear,display,navigateWeb,openWeb,ref,isAdminRoute,stopBootstrap]);
  const refresh = useCallback(() => {
    cache.current.clear();
    if(adminListUrl(current.current?.url,base))read(current.current.url,false,true);
    else if(current.current) {setWeb(true);ref.current?.reload();}
  },[base,read,ref]);
  useEffect(()=>{active.current=true;return()=>{active.current=false;stopWarm();stopBootstrap();if(pending.current)clearTimeout(pending.current.timer);};},[stopBootstrap,stopWarm]);
  useEffect(()=>{
    stopWarm();
    if(!document||busy||web)return;
    // Read only destinations the server actually supplied. Never prefetch forms,
    // action links or another company, and never execute scripts from fetched HTML.
    const targets=[...new Set((document.footer||[]).map(item=>adminListUrl(item.url,base)).filter(Boolean))]
      .filter(url=>url!==current.current?.url&&!cache.current.has(url)).slice(0,3);
    let index=0;
    const next=()=>{
      if(!active.current||pending.current||!doc.current||index>=targets.length)return;
      const url=targets[index++],id='warm:'+documentGeneration.current+':'+(++warmSequence.current);
      warm.current.set(id,url);ref.current?.injectJavaScript(adminPageScript(base,'read',{url,id}));
      if(index<targets.length)warmTimer.current=setTimeout(next,1200);
    };
    if(targets.length)warmTimer.current=setTimeout(next,800);
    return stopWarm;
  },[document,busy,web,base,ref,stopWarm]);
  const rememberScroll=useCallback((url,value)=>{
    if(!sameGymOrigin(url,base)||!Number.isFinite(value)||value<0)return;
    offsets.current.set(url,Math.min(value,100000));if(offsets.current.size>12)offsets.current.delete(offsets.current.keys().next().value);
  },[base]);
  const scrollOffset=useCallback(url=>offsets.current.get(url)||0,[]);
  const retry=useCallback(()=>{
    setError('');setDiagnostic('');setStartup('loading');
    if(doc.current)onLoadEnd(source.current);else ref.current?.reload();
  },[onLoadEnd,ref]);
  return {document,page,busy,error,web,startup,diagnostic,localScreen,sessionVersion,navigate,back,invoke,refresh,openWeb,change,onLoadEnd,onLocation,isAdminRoute,
    rememberScroll,scrollOffset,retry,
    showWeb:()=>setWeb(true),showNative:()=>setWeb(current.current?.kind==='web'),onNavigation,onMessage,
    injectedScript:adminPageScript(base,'install',{documentId:documentGeneration.current})};
}
