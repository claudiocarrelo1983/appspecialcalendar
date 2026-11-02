const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {test}=require('node:test'),babel=require('@babel/core');
const base='https://club.example/',dashboard=base+'dashboard-gym';
const {code}=babel.transformSync(fs.readFileSync(require.resolve('../src/utils/webViewRecovery.js'),'utf8'),{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']});
const exportsRecovery={};vm.runInNewContext(code,{exports:exportsRecovery,URL,setTimeout,clearTimeout});
function harness(){
  let time=0,sequence=0,state={status:'ready',revision:0},timers=new Map();const scripts=[],mounts=[];
  const api=exportsRecovery.createWebViewRecovery({base,inject:script=>scripts.push(script),remount:(url,revision)=>mounts.push({url,revision}),change:value=>state=value,
    now:()=>time,setTimer:(fn,ms)=>{timers.set(++sequence,{fn,at:time+ms});return sequence;},clearTimer:id=>timers.delete(id)});
  const advance=ms=>{const target=time+ms;while(true){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>target)break;time=next[1].at;timers.delete(next[0]);next[1].fn();}time=target;};
  const ack=(url=dashboard,content=true,token=Number(scripts.at(-1).match(/token:(\d+)/)[1]))=>api.message({url:new URL(url).origin,data:JSON.stringify({type:'sc.webview.health',token,documentUrl:url,content})});
  return {api,scripts,mounts,advance,ack,get state(){return state;},timers};
}
test('iPhone -1001 on background is recovered once active, without accepting the failed load-end',()=>{
  const h=harness();h.api.start(dashboard);h.api.appState('background');
  h.api.error({url:dashboard,code:-1001});assert.equal(h.mounts.length,0);assert.equal(h.api.end(dashboard),false);
  h.api.appState('active');assert.equal(h.mounts.length,1);assert.equal(h.mounts[0].url,dashboard);assert.equal(h.state.status,'recovering');
  assert.equal(h.api.end(dashboard,0),false);
  h.api.start(dashboard,1);assert.equal(h.api.end(dashboard,1),true);h.ack();assert.equal(h.state.status,'ready');assert.equal(h.timers.size,0);
});
test('a live WebView resumes without a reload or lost form content',()=>{
  const h=harness();h.api.start(dashboard);h.api.end(dashboard);h.ack();
  h.api.appState('inactive');h.api.appState('active');h.ack();h.advance(30000);
  assert.equal(h.mounts.length,0);assert.equal(h.state.status,'ready');
});
test('a frozen WebView that does not answer the resume probe is remounted',()=>{
  const h=harness();h.api.start(dashboard);h.api.end(dashboard);h.ack();
  h.api.appState('background');h.api.appState('active');h.advance(4000);
  assert.equal(h.mounts.length,1);assert.equal(h.state.reference,'RESUME_NO_RESPONSE');
});

test('logout replaces the recovery target atomically so stale dashboard events cannot reopen it',()=>{
 const h=harness(),login=base+'login?_native_login=1';
 h.api.start(dashboard);h.api.end(dashboard);h.ack();
 const oldRevision=h.state.revision;
 assert.equal(h.api.replace(login),true);assert.equal(h.mounts.at(-1).url,login);
 const loginRevision=h.state.revision;
 h.api.error({url:dashboard,code:-1001},oldRevision);h.api.terminated(oldRevision);
 assert.equal(h.mounts.length,1,'Old document cannot trigger another remount');
 assert.equal(h.api.end(dashboard,oldRevision),false);
 h.api.start(login,loginRevision);h.api.error({url:login,code:-1001},loginRevision);
 assert.equal(h.mounts.at(-1).url,login,'Even a current login failure retries login, never the dashboard');
 h.api.start(login,h.state.revision);h.api.end(login,h.state.revision);h.ack(login);
 assert.equal(h.state.status,'ready');assert.equal(h.timers.size,0);
});
test('iOS termination and Android renderer loss both create a fresh WebView instance',()=>{
  const h=harness();h.api.start(dashboard);h.api.end(dashboard);h.ack();h.api.terminated();
  assert.equal(h.mounts[0].revision,1);assert.equal(h.state.reference,'WEBVIEW_TERMINATED');
});
test('repeated timeouts stop at two automatic retries and offer manual retry',()=>{
  const h=harness();h.api.start(dashboard);h.api.error({code:-1001,url:dashboard},0);
  h.api.start(dashboard,1);h.api.error({code:-1001,url:dashboard},1);
  h.api.start(dashboard,2);h.api.error({code:-1001,url:dashboard},2);
  assert.equal(h.mounts.length,2);assert.equal(h.state.status,'failed');assert.equal(h.state.reference,'-1001');
  h.api.retry();assert.equal(h.mounts.length,3);assert.equal(h.state.status,'recovering');
});
test('recovery returns to the last safe GET rather than resubmitting a form',()=>{
  const h=harness(),form=base+'memberships/create',submit=base+'memberships/save';
  h.api.start(form);h.api.end(form);h.ack(form);
  h.api.navigation({url:submit,navigationType:'formsubmit',method:'POST'});h.api.start(submit);h.api.error({code:-1001,url:submit});
  assert.equal(h.mounts[0].url,form);
});
test('successful POST documents never become the recovery GET target',()=>{
  const h=harness(),form=base+'memberships/create',submit=base+'memberships/save';
  h.api.start(form);h.api.end(form);h.ack(form);
  h.api.navigation({url:submit,navigationType:'formsubmit'});h.api.start(submit);h.api.end(submit);h.ack(submit);
  h.api.location(submit);h.api.terminated();assert.equal(h.mounts[0].url,form);
});
test('foreign, stale and subframe events cannot authorize recovery or a healthy document',()=>{
  const h=harness();h.api.start(dashboard);h.api.end(dashboard);
  h.ack('https://other.example/',true);h.ack(dashboard,true,0);
  h.api.error({code:-1001,url:dashboard,isTopFrame:false});assert.equal(h.mounts.length,0);
  h.advance(4000);assert.equal(h.mounts.length,1);
  h.api.error({code:-1001,url:dashboard},0);assert.equal(h.mounts.length,1);
});
test('background time never triggers an automatic reload; cancelled requests are ignored',()=>{
  const h=harness();h.api.start(dashboard);h.api.error({url:dashboard,code:-999});h.api.appState('background');h.advance(90000);
  assert.equal(h.mounts.length,0);h.api.appState('active');h.advance(25000);assert.equal(h.mounts.length,1);
  h.api.dispose();h.advance(90000);assert.equal(h.mounts.length,1);assert.equal(h.timers.size,0);
});
test('blank HTML and stalled initial loads recover instead of leaving a white screen',()=>{
  const h=harness();h.api.start(dashboard);h.api.end(dashboard);h.ack(dashboard,false);assert.equal(h.mounts.length,1);
  const stalled=harness();stalled.api.start(dashboard);stalled.advance(25000);assert.equal(stalled.mounts.length,1);
  stalled.advance(50000);assert.equal(stalled.mounts.length,2);assert.equal(stalled.state.status,'failed');
});
test('the screen wires process recovery, suppresses the default blank error view and renders a retry state',()=>{
  const source=fs.readFileSync(require.resolve('../src/screens/WebViewScreen.js'),'utf8');
  for(const name of ['onContentProcessDidTerminate','onRenderProcessGone','renderError','webview-recovery','recovery.revision'])assert.ok(source.includes(name),name);
});
