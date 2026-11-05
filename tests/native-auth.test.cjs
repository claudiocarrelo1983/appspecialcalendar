const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),babel=require('@babel/core'),{JSDOM}=require('jsdom');
function load(file,mocks={},globals={}){const exports={},code=babel.transformSync(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-react-jsx','@babel/plugin-transform-modules-commonjs']}).code;vm.runInNewContext(code,{exports,URL,console,...globals,require:name=>{assert.ok(name in mocks,name);return mocks[name];}});return exports;}
const core=load('utils/nativeAuthCore.js'),base='https://c20260531125358085.specialcalendar.com/';
const markup=`<html lang="en"><body><main><section class="login-card"><form id="login-form" method="post" data-native-auth="login" data-native-auth-company="FTX" data-native-auth-logo="/images/company/mobile.png">
<input type="hidden" name="_csrf" value="csrf-secret"><input type="hidden" name="LoginForm[field]" value="company-scope">
<div class="form-group required"><label for="username">Username</label><input id="username" name="LoginForm[username]" autocomplete="username" required><div class="invalid-feedback"></div></div>
<div class="form-group"><label for="password">Password</label><input id="password" type="password" name="LoginForm[password]" value="never-export-this" required><div class="invalid-feedback"></div></div>
<button type="submit">Sign in</button></form><a href="/form-signup?pagecode=c20260531125358085">Register</a><a href="/site/request-password-reset?pagecode=c20260531125358085">Forgot password</a><a href="https://foreign.example/login">Foreign</a></section></main></body></html>`;
async function page(html=markup,url=base+'login'){
 const dom=new JSDOM(html,{url,runScripts:'outside-only',pretendToBeVisual:true}),messages=[];
 dom.window.ReactNativeWebView={postMessage:value=>messages.push(JSON.parse(value))};dom.window.eval(core.nativeAuthScript(base));
 if(dom.window.document.readyState==='loading')await new Promise(resolve=>dom.window.document.addEventListener('DOMContentLoaded',resolve,{once:true}));
 return {dom,messages,last:()=>messages.filter(value=>value.type===core.AUTH_MESSAGE).at(-1)};
}
test('native authentication recognizes only this company login/signup/recovery paths',()=>{
 for(const [route,kind] of [['/','login'],['/login','login'],['/form-signup/index','register'],['/site/request-password-reset','forgot'],['/c20260531125358085/reset-password?token=example','reset']])assert.equal(core.authPageKind(new URL(route,base).href,base),kind);
 for(const url of ['https://foreign.example/login','https://person:secret@c20260531125358085.specialcalendar.com/login',base+'dashboard-gym',base+'clients-list/view/1',base+'c999/login'])assert.equal(core.authPageKind(url,base),null);
});

test('public desktop company login never becomes a native authentication target',async()=>{
 const publicUrl='https://specialcalendar.com/login?pagecode=c20261027151705426';
 assert.equal(core.authPageKind(publicUrl,base),null);assert.equal(core.authPageKind(publicUrl,'https://specialcalendar.com/'),null);
 const p=await page(markup,publicUrl);assert.equal(p.messages.length,0);assert.equal(p.dom.window.document.querySelector('style'),null);assert.equal(p.dom.window.__scNativeAuth,undefined);p.dom.window.close();
});
test('auth bridge generation does not depend on function source being retained in release builds',()=>{
 const source=babel.transformSync(fs.readFileSync(path.join(__dirname,'../src/utils/nativeAuthCore.js'),'utf8'),{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code;
 const exports={};vm.runInNewContext('Function.prototype.toString=function(){throw Error("No function source in this engine");};'+source,{exports,URL});
 assert.ok(exports.nativeAuthScript(base).includes('sc.auth.document'));assert.ok(exports.authSubmitScript(base,base+'login','one',{}).includes('requestSubmit'));
});
test('reset deep links retain their token only on the installed company origin',()=>{
 const link=base+'site/reset-password?pagecode=c20260531125358085&token=SYNTHETIC';assert.equal(core.authLinkTarget(link,base),link);
 for(const bad of [link.replace('c20260531125358085.specialcalendar.com','c20261027151705426.specialcalendar.com'),link.replace('pagecode=c20260531125358085','pagecode=c999'),link+'&pagecode=c999','specialcalendar-c999://reset-password?token=SYNTHETIC'])assert.equal(core.authLinkTarget(bad,base),null);
});
test('login snapshot exports native fields and links without passwords, CSRF or hidden company scope',async()=>{
 const p=await page(),data=p.last();assert.equal(data.fields.length,2);assert.equal(data.fields[1].value,'');assert.equal(data.company,'FTX');assert.equal(data.canSubmit,true);assert.equal(data.links.length,2);assert.ok(data.fields.every(field=>!field.error));
 const serialized=JSON.stringify(data);for(const secret of ['csrf-secret','company-scope','never-export-this'])assert.ok(!serialized.includes(secret));assert.equal(p.dom.window.document.body.style.visibility,'');p.dom.window.close();
});
test('native submission preserves original session form fields and cannot rewrite hidden or foreign controls',async()=>{
 const p=await page(),document=p.dom.window.document,data=p.last();let posted;
 document.querySelector('form').addEventListener('submit',event=>{event.preventDefault();posted=new p.dom.window.FormData(event.target);});
 p.dom.window.eval(core.authSubmitScript(base,data.url,data.revision,{'field-0':"alice');window.hacked=true;//",'field-1':'secret-password','_csrf':'attack','field-99':'attack'}));
 assert.equal(posted.get('_csrf'),'csrf-secret');assert.equal(posted.get('LoginForm[field]'),'company-scope');assert.equal(posted.get('LoginForm[password]'),'secret-password');assert.equal(posted.get('LoginForm[username]'),"alice');window.hacked=true;//");assert.equal(p.dom.window.hacked,undefined);p.dom.window.close();
});
test('stale forms and changed company origins cannot submit credentials',async()=>{
 const p=await page();let submits=0;p.dom.window.document.querySelector('form').addEventListener('submit',event=>{event.preventDefault();submits++;});
 p.dom.window.eval(core.authSubmitScript(base,p.last().url,'stale',{'field-0':'alice','field-1':'password'}));assert.equal(submits,0);
 p.dom.window.document.querySelector('form').action='https://foreign.example/login';p.dom.window.eval(core.authSubmitScript(base,p.last().url,p.last().revision,{'field-0':'alice','field-1':'password'}));assert.equal(submits,0);p.dom.window.close();
});
test('register exports select/consent controls and native submission honors required consent',async()=>{
 const p=await page(`<main><form id="form-signup" method="post"><div><label for="location">Club location</label><select id="location" name="location" required><option value="">Choose</option><option value="studio">Studio</option></select></div><div><label><input name="terms" type="checkbox" required>Accept terms <a href="/privacy-policy">Privacy</a></label><span class="invalid-feedback"></span></div><button type="submit">Register</button></form></main>`,base+'form-signup');
 const data=p.last();assert.equal(data.kind,'register');assert.equal(data.fields[0].options.length,2);assert.equal(data.fields[1].type,'checkbox');assert.equal(data.links.length,1);
 let submits=0;p.dom.window.document.querySelector('form').addEventListener('submit',event=>{event.preventDefault();submits++;});
 p.dom.window.eval(core.authSubmitScript(base,data.url,data.revision,{'field-0':'studio','field-1':false}));assert.equal(submits,0);
 p.dom.window.eval(core.authSubmitScript(base,data.url,data.revision,{'field-0':'studio','field-1':true}));assert.equal(submits,1);p.dom.window.close();
});
test('forgot-password success and expired reset links remain visible in native state',async()=>{
 const forgot=await page('<main><form id="request-password-reset-form" method="post"><input name="email" type="email"><div class="alert alert-success">Check your email.</div><button type="submit">Send link</button></form></main>',base+'site/request-password-reset');assert.equal(forgot.last().kind,'forgot');assert.equal(forgot.last().messages[0],'Check your email.');forgot.dom.window.close();
 const reset=await page('<main><div class="alert alert-warning">This link has expired.</div><a href="/site/request-password-reset">Request a new link</a></main>',base+'reset-password?token=example');assert.equal(reset.last().kind,'reset');assert.equal(reset.last().canSubmit,false);assert.equal(reset.last().messages[0],'This link has expired.');assert.equal(reset.last().links.length,1);reset.dom.window.close();
});
test('a completed authenticated document exits native authentication',async()=>{
 const p=await page('<html><body><main>Dashboard</main></body></html>',base+'dashboard-gym-client');assert.ok(p.messages.some(message=>message.type==='sc.auth.exit'));p.dom.window.close();
});
test('a password revealed by website JavaScript is still redacted from native snapshots',async()=>{
 const p=await page(markup.replace('id="password" type="password"','id="password" type="text"'));
 assert.equal(p.last().fields[1].type,'password');assert.equal(p.last().fields[1].value,'');assert.ok(!JSON.stringify(p.last()).includes('never-export-this'));p.dom.window.close();
});
function authHook(){
 const slots=[],effects=[],timers=new Map(),scripts=[],urls=[];let cursor=0,sequence=0;
 const react={useState(value){const id=cursor++;if(!(id in slots))slots[id]=value;return [slots[id],value=>slots[id]=value];},useRef(value){const id=cursor++;return slots[id]||(slots[id]={current:value});},useCallback:fn=>fn,useEffect(fn,deps){const id=cursor++;if(!slots[id]){slots[id]=true;effects.push(fn);}}};
 const hook=load('utils/useNativeAuth.js',{react,'./nativeAuthCore':core,'./nativeAuthTranslations':load('utils/nativeAuthTranslations.js')},{setTimeout:fn=>{timers.set(++sequence,fn);return sequence;},clearTimeout:id=>timers.delete(id)}).default;
 const ref={current:{injectJavaScript:script=>scripts.push(script)}};
 const render=()=>{cursor=0;const state=hook(ref,base,url=>urls.push(url));while(effects.length)effects.shift()();return state;};
 const message=(value,url=value.url)=>render().onMessage({url,data:JSON.stringify(value)});
 const doc=revision=>({type:core.AUTH_MESSAGE,url:base+'login',revision,kind:'login',fields:[],links:[],messages:[],canSubmit:true});
 return {render,message,doc,timers,scripts,urls};
}

test('startup keeps login hidden until a guest form or authenticated destination confirms the session',()=>{
 const h=authHook();assert.equal(h.render().checkingSession,true);assert.equal(h.render().document,null);
 h.render().onNavigation(base);assert.equal(h.render().checkingSession,true);
 h.render().onNavigation(base+'dashboard-gym-client');assert.equal(h.render().checkingSession,true);
 h.message({type:'sc.auth.exit',url:base+'dashboard-gym-client'});
 assert.equal(h.render().checkingSession,false);assert.equal(h.render().active,false);assert.equal(h.render().document,null);
 const guest=authHook();guest.render().onNavigation(base+'login');assert.equal(guest.render().checkingSession,true);
 guest.message(guest.doc('guest'));assert.equal(guest.render().checkingSession,false);assert.equal(guest.render().active,true);
});

test('explicit sign-in after logout is immediate and a failed startup can retry',()=>{
 const h=authHook();h.render().open(base+'login');assert.equal(h.render().checkingSession,false);assert.equal(h.render().active,true);
 const failed=authHook();failed.render().fail({url:base,code:-1001});assert.equal(failed.render().checkingSession,false);assert.equal(failed.render().error,'connection');
 failed.render().retry();assert.equal(failed.urls.at(-1),base);assert.equal(failed.render().error,'');
 const redirected=authHook();redirected.render().onNavigation(base+'dashboard-gym');
 Array.from(redirected.timers.values()).at(-1)();redirected.render().retry();
 assert.equal(redirected.urls.at(-1),base+'login','A stalled startup redirect still has a working retry');
});
test('auth transitions reject stale/foreign forms and leave login only for a completed destination',()=>{
 const h=authHook();h.render().onNavigation(base+'login');h.message(h.doc('first'));assert.equal(h.render().active,true);
 h.render().onNavigation(base+'login');h.message(h.doc('second'));h.message(h.doc('first'));assert.equal(h.render().document.revision,'second');
 h.message({...h.doc('foreign'),url:'https://foreign.example/login'});assert.equal(h.render().document.revision,'second');
 h.render().onNavigation(base+'dashboard-gym-client');assert.equal(h.render().active,true,'Do not expose the old login document during navigation');h.message({type:'sc.auth.exit',url:base+'dashboard-gym-client'});assert.equal(h.render().active,false);
});
test('a timed out native submission can retry without persisting a password',()=>{
 const h=authHook();h.render().onNavigation(base+'login');h.message(h.doc('first'));h.render().submit({'field-0':'alice','field-1':'example-password'});assert.equal(h.render().busy,true);assert.equal(h.scripts.length,1);
 const timeout=Array.from(h.timers.values()).at(-1);timeout();assert.equal(h.render().busy,false);assert.equal(h.render().error,'connection');h.render().retry();assert.equal(h.urls.at(-1),base+'login');assert.equal(h.render().document,null);
});
test('real workspace gym forms are representable with native controls',async t=>{
 const directory=path.join(__dirname,'../build/auth-fixtures');if(!fs.existsSync(path.join(directory,'ftx-register.html'))){t.skip('Generate local forms with scripts/render-native-auth-fixtures.php');return;}
 for(const [kind,route] of [['login','login'],['register','form-signup'],['forgot','site/request-password-reset']]){
   const p=await page(fs.readFileSync(path.join(directory,'ftx-'+kind+'.html'),'utf8'),base+route+'?pagecode=c20260531125358085');
   const doc=p.last();assert.equal(doc.kind,kind);assert.equal(doc.canSubmit,true,'Unsupported native form: '+kind);assert.ok(doc.fields.length>0);
   if(kind==='register'){assert.ok(doc.fields.some(field=>field.type==='checkbox'&&field.required));assert.ok(doc.fields.some(field=>field.type==='date'));assert.ok(doc.fields.some(field=>field.type==='select'));}
   assert.ok(doc.fields.every(field=>field.type!=='password'||field.value===''));p.dom.window.close();
 }
});
test('an expired reset HTTP response keeps its useful server message instead of a connection error',()=>{
 const h=authHook(),url=base+'reset-password?token=SYNTHETIC';h.render().onNavigation(url);
 h.message({...h.doc('reset'),url,kind:'reset',canSubmit:false,messages:['This reset link has expired.']});
 h.render().fail({url,statusCode:400});assert.equal(h.render().error,'');assert.equal(h.render().document.messages[0],'This reset link has expired.');
});

test('confirmed logout activates native login immediately and discards a previous registration document',()=>{
 const h=authHook(),signup={...h.doc('signup'),url:base+'form-signup',kind:'register'};
 h.render().onNavigation(signup.url);h.message(signup);
 h.render().onNavigation(base+'dashboard-gym-client');h.message({type:'sc.auth.exit',url:base+'dashboard-gym-client'});
 assert.equal(h.render().active,false);
 const url=base+'login?_native_login=1';h.render().open(url);
 assert.equal(h.render().active,true);assert.equal(h.render().kind,'login');assert.equal(h.render().document,null);assert.equal(h.urls.at(-1),url);
});

test('Android origin-only auth messages accept only the committed company document URL',()=>{
 const h=authHook(),url=base+'login';h.render().onNavigation(url);
 h.message(h.doc('android'),new URL(base).origin);assert.equal(h.render().document.revision,'android');
 h.message({...h.doc('wrong-page'),url:base+'form-signup'},new URL(base).origin);assert.equal(h.render().document.revision,'android');
 h.message(h.doc('foreign'),'https://foreign.example');assert.equal(h.render().document.revision,'android');
});

test('logout redirect commits the final guest URL and replays its bridge without retiring a fresh document twice',()=>{
 const h=authHook();h.render().onNavigation(base+'site/logout');
 h.render().onLoadEnd(base+'login');assert.equal(h.render().active,true);assert.equal(h.render().kind,'login');assert.equal(h.scripts.length,1);
 h.message(h.doc('redirect'));assert.equal(h.render().busy,false);
 h.render().onLocation(base+'login');h.render().onLoadEnd(base+'login');h.message(h.doc('redirect'));
 assert.equal(h.render().document.revision,'redirect');assert.equal(h.render().busy,false);
});

test('reinjecting auth after final redirect replays the same document revision and completed-page exit',async()=>{
 const p=await page();const first=p.last().revision,count=p.messages.length;
 p.dom.window.eval(core.nativeAuthScript(base));assert.ok(p.messages.length>count);assert.equal(p.last().revision,first);p.dom.window.close();
 const destination=await page('<main>Bookings</main>',base+'dashboard-gym-client');const before=destination.messages.length;
 destination.dom.window.eval(core.nativeAuthScript(base));assert.ok(destination.messages.length>before);assert.equal(destination.messages.at(-1).type,'sc.auth.exit');destination.dom.window.close();
});

test('native language choice waits for the confirmed server form and preserves its selected locale after reload',()=>{
 const h=authHook();h.render().onNavigation(base+'login');h.message({...h.doc('before'),language:'en'});
 h.render().setLanguage('pt');assert.equal(h.render().busy,true);assert.ok(h.scripts.at(-1).includes('/site/language'));
 h.message({type:core.AUTH_LANGUAGE_MESSAGE,url:base+'login',revision:'old',language:'pt',success:true});assert.equal(h.render().language,'en');
 h.message({type:core.AUTH_LANGUAGE_MESSAGE,url:base+'login',revision:'before',language:'pt',success:true});assert.equal(h.render().language,'pt');
 h.render().onNavigation(base+'login');h.message({...h.doc('after'),language:'pt'});assert.equal(h.render().language,'pt');assert.equal(h.render().busy,false);
});

test('language preference POST retains CSRF and current company cookie scope without credentials',async()=>{
 const calls=[],messages=[];let reloads=0;
 const location={origin:new URL(base).origin,href:base+'login',reload:()=>reloads++};
 const environment={URL,URLSearchParams,AbortController,setTimeout,clearTimeout,location,document:{querySelector:selector=>({content:selector.includes('csrf-token')?'csrf-test':'_csrf'})},
   window:{__scNativeAuth:{revision:'current'},ReactNativeWebView:{postMessage:value=>messages.push(JSON.parse(value))}},fetch:async(url,options)=>{calls.push({url,options});return {ok:true,url:base+'site/language',text:async()=>'pt'};}};
 vm.runInNewContext(core.authLanguageScript(base,location.href,'current','pt'),environment);await new Promise(setImmediate);
 assert.equal(calls.length,1);assert.equal(calls[0].options.method,'POST');assert.equal(calls[0].options.credentials,'same-origin');
 const body=new URLSearchParams(calls[0].options.body);assert.equal(body.get('lang'),'pt');assert.equal(body.get('_csrf'),'csrf-test');assert.equal([...body.keys()].length,2);
 assert.equal(messages[0].success,true);assert.equal(reloads,1);
 vm.runInNewContext(core.authLanguageScript(base,location.href,'old','en'),environment);assert.equal(calls.length,1);
 vm.runInNewContext(core.authLanguageScript(base,location.href,'current','unsupported'),environment);assert.equal(calls.length,1);
});

test('native auth language selector translates the form, navigation and legal links together',()=>{
 const translations=load('utils/nativeAuthTranslations.js'),draft=load('utils/nativeLoginDraft.js'),legal=load('utils/authLegalLinks.js');
 const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),useEffect(){},useRef:value=>({current:value}),useState:value=>[value,()=>{}]};
 const screen=load('screens/NativeAuthScreen.js',{react,'react-native':Object.fromEntries(['ActivityIndicator','KeyboardAvoidingView','Modal','Pressable','ScrollView','TextInput','View'].map(key=>[key,key]).concat([['Platform',{OS:'ios'}],['StyleSheet',{create:value=>value}],['Linking',{openURL:async()=>{}}]])),
   'react-native-safe-area-context':{useSafeAreaInsets:()=>({bottom:0})},'./NativeGymTypography':{LoadingIndicator:'ActivityIndicator',Text:'Text',Icon:'Icon'},'./NativeCompanyLogo':'Logo','./NativeDateField':'DateField',
   '../utils/gymUiTheme':{__esModule:true,default:{},brandSoft:()=>''},'../utils/nativeAuthCore':core,'../utils/nativeLoginDraft':draft,'expo-constants':{__esModule:true,default:{expoConfig:{name:'FTX'}}},'../utils/authLegalLinks':legal,'../utils/nativeAuthTranslations':translations}).default;
 const nodes=tree=>!tree||typeof tree!=='object'?[]:[tree,...(tree.props?.children||[]).flat(Infinity).flatMap(nodes)];
 let chosen;
 for(const [language,username,privacy] of [['pt','Nome de utilizador','Política de privacidade'],['en','Username','Privacy Policy']]){
   const tree=nodes(screen({base,color:'#198754',auth:{kind:'login',language,setLanguage:value=>chosen=value,busy:false,document:{...draft.loginPlaceholder(),placeholder:false,canSubmit:true,revision:'live',submitLabel:'Sign in'}}}));
   assert.ok(tree.some(node=>node.props.accessibilityLabel===username));assert.ok(tree.some(node=>node.props.accessibilityLabel===privacy));
   const selector=tree.find(node=>node.props.accessibilityLabel==='Português');assert.equal(selector.props.accessibilityState.checked,language==='pt');selector.props.onPress();assert.equal(chosen,'pt');
 }
 const startup=nodes(screen({base,color:'#198754',auth:{kind:'login',language:'pt',checkingSession:true}}));
 assert.ok(startup.some(node=>node.props.testID==='native-auth-session-check'));
 assert.ok(!startup.some(node=>node.type==='TextInput'||node.props.testID==='native-auth-screen'));
});
