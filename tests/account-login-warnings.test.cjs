const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {test}=require('node:test'),babel=require('@babel/core');
const base='https://club.example/',url=base+'dashboard-gym',token='a'.repeat(64);
function handler(){
  const alerts=[],scripts=[],document={url,version:1};
  const {code}=babel.transformSync(fs.readFileSync(require.resolve('../src/utils/accountLoginWarnings.js'),'utf8'),{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']});
  const exports={};vm.runInNewContext(code,{exports,URL,require:()=>({sameGymOrigin:(value,site)=>{try{return new URL(value).origin===new URL(site).origin;}catch{return false;}}})});
  const receive=exports.createAccountLoginWarningHandler({base,document:()=>({...document}),show:(...args)=>alerts.push(args),inject:script=>scripts.push(script)});
  const send=(overrides={},origin=base)=>receive({url:origin,data:JSON.stringify({type:'sc.account.login-warning',documentUrl:url,token,title:'Another device',message:'This account is also signed in elsewhere.',...overrides})});
  return {alerts,scripts,document,send};
}
test('an authenticated server warning appears once and acknowledgement waits for OK',()=>{
  const h=handler();h.send();h.send();assert.equal(h.alerts.length,1);assert.equal(h.scripts.length,0);
  h.alerts[0][2][0].onPress();assert.ok(h.scripts[0].includes(token));assert.ok(h.scripts[0].includes('__scAcknowledgeLoginWarning'));
});
test('foreign, malformed and stale documents never display an account warning',()=>{
  const h=handler();h.send({},'https://other.example');h.send({documentUrl:base+'login'});h.send({token:'not-valid'});assert.equal(h.alerts.length,0);
});
test('closing a warning after navigating or signing out cannot acknowledge it in a new session',()=>{
  const h=handler();h.send();h.document.version++;h.document.url=base+'login';h.alerts[0][2][0].onPress();assert.equal(h.scripts.length,0);
});

test('Continue and logout are explicit choices; logout is never invoked by displaying the warning',()=>{
  const h=handler();h.send({continueLabel:'Continuar',logoutLabel:'Terminar sessão neste dispositivo'});
  assert.equal(h.scripts.length,0);assert.equal(h.alerts[0][2].length,2);
  assert.equal(h.alerts[0][2][0].text,'Continuar');assert.equal(h.alerts[0][2][1].style,'destructive');
  h.alerts[0][2][1].onPress();assert.ok(h.scripts[0].includes('__scLogoutLoginWarning'));assert.ok(h.scripts[0].includes(token));
});

test('stale or foreign warnings cannot log out the current session',()=>{
  const h=handler();h.send({logoutLabel:'Log out this device'});h.document.version++;
  h.alerts[0][2][1].onPress();assert.equal(h.scripts.length,0);
  h.send({logoutLabel:'Log out this device'},'https://other.example');assert.equal(h.alerts.length,1);
});

test('invalid action labels are rejected',()=>{
  for(const label of [null,{},'', 'x'.repeat(151)]){const h=handler();h.send({logoutLabel:label});assert.equal(h.alerts.length,0);}
});

async function webHarness({native=false}={}) {
  const {JSDOM}=await import('jsdom');
  const dom=new JSDOM('<!doctype html><meta name="csrf-token" content="test-csrf"><body><a href="/profile">Profile</a>',{url,runScripts:'outside-only',pretendToBeVisual:true});
  const window=dom.window,requests=[],messages=[],errors=[];
  const warning={token,title:'Another device',message:'Continue or log out.',continueLabel:'Continue',logoutLabel:'Log out this device'};
  let check,fail=false;
  window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  window.setInterval=fn=>{check=fn;return 1;};window.clearInterval=()=>{};
  window.alert=message=>errors.push(message);
  if(native)window.ReactNativeWebView={postMessage:message=>messages.push(JSON.parse(message))};
  window.fetch=async(path,options={})=>{
    requests.push({path,...options});
    if(options.method==='POST'&&fail)throw Error('offline');
    return {ok:true,json:async()=>({success:true,data:{warning}})};
  };
  window.eval(fs.readFileSync(require.resolve('../deployment/account-login-warnings/common/helpers/account-login-warning.js'),'utf8'));
  const flush=()=>new Promise(resolve=>setImmediate(resolve));await flush();
  return {window,requests,messages,errors,check,flush,fail:()=>{fail=true;},close:()=>window.close()};
}

test('website warning keeps the session active until the user chooses Continue',async()=>{
  const h=await webHarness();try{
    const dialog=h.window.document.querySelector('dialog');assert.ok(dialog.open);
    assert.equal(h.requests.filter(item=>item.method==='POST').length,0);
    await h.check();assert.equal(h.window.document.querySelectorAll('dialog').length,1);
    dialog.querySelector('button').click();await h.flush();
    assert.equal(h.window.document.querySelector('dialog'),null);
    const request=h.requests.find(item=>item.method==='POST');assert.equal(request.path,'/account-login-warning/acknowledge');
    assert.equal(request.headers['X-CSRF-Token'],'test-csrf');assert.equal(request.body,'token='+token);
  }finally{h.close();}
});

test('website logout posts only after a click and preserves the warning when offline',async()=>{
  const h=await webHarness();try{
    h.fail();h.window.document.querySelectorAll('dialog button')[1].click();await h.flush();
    assert.equal(h.requests.filter(item=>item.path.endsWith('/logout')).length,1);
    assert.ok(h.window.document.querySelector('dialog').open);assert.equal(h.window.location.href,url);assert.equal(h.errors.length,1);
    assert.equal(h.requests.filter(item=>item.path.endsWith('/acknowledge')).length,0);
  }finally{h.close();}
});

test('native delivery includes both actions and rejects an outdated logout token',async()=>{
  const h=await webHarness({native:true});try{
    assert.equal(h.window.document.querySelector('dialog'),null);assert.equal(h.messages[0].logoutLabel,'Log out this device');
    await h.window.__scLogoutLoginWarning('b'.repeat(64));assert.equal(h.requests.length,1);
  }finally{h.close();}
});
