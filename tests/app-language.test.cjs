const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{test}=require('node:test'),babel=require('@babel/core');
function load(file,mocks={}){
 const exports={},code=babel.transformSync(fs.readFileSync(require.resolve('../src/utils/'+file),'utf8'),{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code;
 vm.runInNewContext(code,{exports,URL,require:name=>{assert.ok(name in mocks,name);return mocks[name];}});return exports;
}
const translations=load('nativeAuthTranslations.js');
const moduleFor=native=>load('appLanguage.js',{'react-native':{NativeModules:native||{}},'./nativeAuthTranslations':translations});
const language=moduleFor();
test('language priority is saved choice, phone language, then English',()=>{
 for(const phone of ['pt','en','si-LK','ta-LK','pt-PT',null])for(const chosen of ['pt','en',null,'','unknown']){
  const expected=['pt','en'].includes(chosen)?chosen:/^pt(?:-|$)/.test(phone||'')?'pt':'en';
  assert.equal(translations.resolveAppLanguage(chosen,phone),expected);
 }
});
test('phone language is read on iPhone and Android with safe English fallback',()=>{
 for(const [locale,expected] of [['pt-PT','pt'],['pt_BR','pt'],['en-LK','en'],['si-LK','en'],['ta-LK','en'],['unknown','en']]){
  assert.equal(moduleFor({SettingsManager:{settings:{AppleLanguages:[locale]}}}).preferredPhoneLanguage(),expected);
  assert.equal(moduleFor({I18nManager:{getConstants:()=>({localeIdentifier:locale})}}).preferredPhoneLanguage(),expected);
 }
 assert.equal(moduleFor({I18nManager:{getConstants(){throw Error('Unavailable');}}}).preferredPhoneLanguage(),'en');
});
test('language startup cannot make requests or reload login in either company',()=>{
 for(const base of ['https://c20260531125358085.specialcalendar.com','https://c20261027151705426.specialcalendar.com'])for(const phone of ['en','pt','si-LK'])for(const chosen of ['pt','en',null,'invalid']){
  const expected=['pt','en'].includes(chosen)?chosen:phone==='pt'?'pt':'en';
  const fail=()=>{throw Error('Automatic language side effect');};
  const context={location:{origin:base,reload:fail},window:{ReactNativeWebView:{}},localStorage:{getItem:()=>chosen},fetch:fail,Intl:{DateTimeFormat:fail},NativeModules:new Proxy({},{get:fail})};
  vm.runInNewContext(language.appLanguageScript(base,phone),context);
  assert.equal(context.window.__scAppLanguage,expected);
 }
});
test('unavailable preference storage still defaults to English',()=>{
 const context={location:{origin:'https://club.example'},window:{ReactNativeWebView:{}},localStorage:{getItem:()=>{throw Error('Storage unavailable');}}};
 vm.runInNewContext(language.appLanguageScript('https://club.example'),context);assert.equal(context.window.__scAppLanguage,'en');
});
test('ordinary website and foreign pages are unchanged',()=>{
 for(const [origin,app] of [['https://club.example',false],['https://foreign.example',true]]){
  const context={location:{origin},window:app?{ReactNativeWebView:{}}:{}};
  vm.runInNewContext(language.appLanguageScript('https://club.example'),context);assert.equal(context.window.__scAppLanguage,undefined);
 }
});
