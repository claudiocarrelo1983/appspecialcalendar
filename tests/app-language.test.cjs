const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{test}=require('node:test'),babel=require('@babel/core');
function load(file,mocks={}){
 const exports={},code=babel.transformSync(fs.readFileSync(require.resolve('../src/utils/'+file),'utf8'),{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code;
 vm.runInNewContext(code,{exports,URL,require:name=>{assert.ok(name in mocks,name);return mocks[name];}});return exports;
}
const translations=load('nativeAuthTranslations.js');
const base='https://club.example';
function moduleFor(native={}){return load('appLanguage.js',{'react-native':{NativeModules:native},'./nativeAuthTranslations':translations});}
test('preferred iPhone and Android locales resolve English and Portuguese without another native dependency',()=>{
 for(const [locales,want] of [[['en-GB','pt-PT'],'en'],[['pt_BR','en-US'],'pt'],[['fr-FR','pt-PT'],'en']]){
  assert.equal(moduleFor({SettingsManager:{settings:{AppleLanguages:locales}}}).preferredPhoneLanguage(),want);
 }
 assert.equal(moduleFor({I18nManager:{getConstants:()=>({localeIdentifier:'en_US'})}}).preferredPhoneLanguage(),'en');
 assert.equal(moduleFor({I18nManager:{localeIdentifier:'pt_PT'}}).preferredPhoneLanguage(),'pt');
});
async function run({language='en',html='en',account='',storage=new Map(),origin=base,app=true,ok=true}={}){
 const calls=[],reloads=[],script=moduleFor().appLanguageScript(base,language);
 const context={URL,URLSearchParams,AbortController,setTimeout,clearTimeout,location:{origin,href:origin+'/login',pathname:'/login',reload:()=>reloads.push(true)},
  window:app?{ReactNativeWebView:{}}:{},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
  document:{readyState:'complete',documentElement:{lang:html},querySelector:selector=>selector.includes('fitness-account')?account?{getAttribute:()=>account}:null:{content:selector.includes('csrf-token')?'private-token':'_csrf'}},
  fetch:async(url,options)=>{calls.push({url,options});return {ok,url:base+url,text:async()=>new URLSearchParams(options.body).get('lang')};}};
 vm.runInNewContext(script,context);await new Promise(setImmediate);return {calls,reloads,storage,context,script};
}
test('first app launch synchronizes English using the existing CSRF-protected company endpoint',async()=>{
 const h=await run({html:'pt'});assert.equal(h.calls.length,1);
 assert.equal(new URLSearchParams(h.calls[0].options.body).get('lang'),'en');
 assert.equal(h.calls[0].options.credentials,'same-origin');assert.equal(h.calls[0].options.headers['X-CSRF-Token'],'private-token');
 assert.equal(h.reloads.length,1);assert.equal(h.storage.get('sc.app.language.initialized.guest'),'en');
 vm.runInNewContext(h.script,h.context);await new Promise(setImmediate);assert.equal(h.calls.length,1);
});
test('subsequent launches preserve the current manual server language instead of applying the phone default again',async()=>{
 const storage=new Map([['sc.app.language.initialized.guest','en']]);
 const h=await run({html:'pt',storage});assert.equal(h.calls.length,0);assert.equal(h.reloads.length,0);
});
test('an explicit app language takes precedence over the phone default on first account load',async()=>{
 const storage=new Map([['sc.app.language.choice','pt']]);const h=await run({account:'account-hash',storage});
 assert.equal(new URLSearchParams(h.calls[0].options.body).get('lang'),'pt');assert.equal(storage.get('sc.app.language.initialized.account-hash'),'pt');
 const again=await run({account:'account-hash',storage});assert.equal(again.calls.length,0);
});
test('language initialization never runs on the normal website or a foreign origin',async()=>{
 assert.equal((await run({app:false})).calls.length,0);assert.equal((await run({origin:'https://foreign.example'})).calls.length,0);
});
test('failed initialization does not reload or save a false success marker',async()=>{
 const h=await run({ok:false});assert.equal(h.reloads.length,0);assert.equal(h.storage.size,0);
});
