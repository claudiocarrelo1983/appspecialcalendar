const HEALTH='sc.webview.health';
const normDoc=url=>{
  try{
    const p=new URL(url);
    return `${p.origin}${p.pathname.replace(/\/index\/?$/,'').replace(/\/$/, '')}${p.search}`;
  }catch{return url;}
};
const matchDoc=(a,b)=>a===b||normDoc(a)===normDoc(b);
export function createWebViewRecovery({base,inject,remount,change,active=true,setTimer=setTimeout,clearTimer=clearTimeout,now=Date.now}) {
  const origin=new URL(base).origin;
  let current=base,safe=base,foreground=active,loading=false,failed=false,mutation=false,disposed=false;
  let revision=0,probeId=0,attempts=0,windowStart=now(),reference='',status='ready';
  const timers=new Map();
  const stop=name=>{if(timers.has(name))clearTimer(timers.get(name));timers.delete(name);};
  const stopAll=()=>{for(const name of [...timers.keys()])stop(name);};
  const schedule=(name,fn,ms)=>{stop(name);timers.set(name,setTimer(()=>{timers.delete(name);if(!disposed)fn();},ms));};
  const local=url=>{try{const parsed=new URL(url);return parsed.origin===origin&&!parsed.username&&!parsed.password;}catch{return false;}};
  const publish=next=>{status=next;change({status,reference,revision});};
  const recover=()=>{
    stopAll();if(disposed||!foreground)return;
    if(status!=='recovering'&&now()-windowStart>60000){windowStart=now();attempts=0;}
    if(attempts>=2){publish('failed');return;}
    attempts++;revision++;probeId++;failed=false;mutation=false;loading=true;current=safe;
    publish('recovering');remount(safe,revision);
    schedule('load',()=>fail('LOAD_TIMEOUT'),25000);
  };
  const fail=code=>{failed=true;reference=String(code||'CONNECTION').slice(0,48);stopAll();if(foreground)recover();};
  const healthy=()=>{stopAll();loading=false;failed=false;attempts=0;windowStart=now();reference='';publish('ready');};
  const probe=()=>{
    if(disposed||!foreground)return;
    if(!local(current)){if(!loading)healthy();return;}
    const token=++probeId;
    schedule('probe',()=>fail('RESUME_NO_RESPONSE'),4000);
    inject('(function(){try{if(location.origin!=='+JSON.stringify(origin)+')return;window.ReactNativeWebView.postMessage(JSON.stringify({type:'+JSON.stringify(HEALTH)+',token:'+token+',documentUrl:location.href,content:!!document.body&&(document.body.children.length>0||document.body.textContent.trim().length>0)}));}catch(e){}})();true;');
  };
  return {
    replace(url){
      if(disposed||!local(url))return false;
      // A deliberate login navigation must invalidate every event/timer from
      // the former authenticated document, including a renderer-loss recovery.
      stopAll();revision++;probeId++;current=url;safe=url;mutation=false;
      loading=true;failed=false;attempts=0;windowStart=now();reference='';
      publish('ready');remount(url,revision);
      if(foreground)schedule('load',()=>fail('LOAD_TIMEOUT'),25000);
      return true;
    },
    navigation(request){
      if(request.isTopFrame===false)return;
      if(['formsubmit','formresubmit'].includes(request.navigationType)||request.method&&request.method.toUpperCase()!=='GET')mutation=true;
      else if(['click','backforward'].includes(request.navigationType))mutation=false;
      if(!mutation&&local(request.url))safe=request.url;
    },
    location(url,generation=revision){if(generation===revision&&local(url)){current=url;if(!loading&&!mutation)safe=url;}},
    start(url,generation=revision){
      if(generation!==revision||disposed)return false;
      current=url||current;loading=true;failed=false;probeId++;stopAll();
      if(!mutation&&local(current))safe=current;
      if(foreground)schedule('load',()=>fail('LOAD_TIMEOUT'),25000);
      return true;
    },
    end(url,generation=revision){
      if(generation!==revision||disposed||failed)return false;
      // onLoadEnd also fires after onError; ignore a dead document's final event.
      if(url&&url!==current){
        if(local(url)){current=url;mutation=false;safe=url;}
        else return false;
      }
      loading=false;stop('load');probe();return true;
    },
    error(event,generation=revision){
      if(generation!==revision||disposed||Number(event.code)===-999||event.isTopFrame===false)return;
      if(event.url&&event.url!==current)return;
      fail(event.code||'CONNECTION');
    },
    terminated(generation=revision){if(generation===revision&&!disposed)fail('WEBVIEW_TERMINATED');},
    message(event){
      if(typeof event.data!=='string'||event.data.length>2048)return false;
      let value;try{value=JSON.parse(event.data);}catch{return false;}
      if(value?.type!==HEALTH)return false;
      if(disposed||value.token!==probeId||!local(event.url||current)||!local(value.documentUrl)||!matchDoc(value.documentUrl,current))return true;
      if(value.content===true)healthy();else fail('EMPTY_DOCUMENT');return true;
    },
    appState(state){
      const wasActive=foreground;foreground=state==='active';
      if(!foreground){stopAll();return;}
      if(wasActive)return;
      if(failed||status==='failed')recover();
      else if(loading)schedule('load',()=>fail('LOAD_TIMEOUT'),25000);
      else probe();
    },
    retry(){attempts=0;windowStart=now();reference=reference||'CONNECTION';recover();},
    activate(){disposed=false;},
    dispose(){disposed=true;stopAll();},
  };
}
