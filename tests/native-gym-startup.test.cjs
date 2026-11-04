const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const babel = require('@babel/core');
const root = path.join(__dirname, '..');
const start = 'https://c20260531125358085.specialcalendar.com/';

function load(file, mocks = {}, globals = {}) {
  const source = fs.readFileSync(path.join(root, 'src', file), 'utf8');
  const { code } = babel.transformSync(source, { babelrc: false, configFile: false,
    plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'] });
  const exports = {};
  vm.runInNewContext(code, { exports, URL, URLSearchParams, ...globals, require(name) {
    if(name==='./classLinks')return load('utils/classLinks.js');
    assert.ok(name in mocks, `Unexpected dependency: ${name}`); return mocks[name];
  } });
  return exports;
}
const core = load('utils/nativeGymCore.js');
const snapshot = () => ({ enabled: true, accountKey: 'a'.repeat(64), language: 'en',
  serverTime: '2026-10-29T22:00:00Z', client: { name: 'Test member', number: 1 },
  company: { name: 'FTX Team', color: '#198754' },
  features: { pass: false, sessions: false, week: false, timer: false }, bookings: [] });

function hook() {
  const slots = [], scripts = [], urls=[], timers = new Map(); let cursor = 0, timer = 0;
  const react = { useRef(value) { const i = cursor++; if (!(i in slots)) slots[i] = { current: value }; return slots[i]; },
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value;
      return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useCallback: fn => fn, useEffect() {} };
  const { default: useNativeGym } = load('utils/useNativeGym.js', {
    react, 'react-native': { AppState: {} }, 'expo-notifications': {},
    'expo-secure-store': { deleteItemAsync: async () => {} },
    './nativeTimerAlerts': { cancelTimerAlert: async () => {} }, './nativeGymCore': core,
    './nativeAuthCore': load('utils/nativeAuthCore.js'),
  }, { setTimeout: fn => { timers.set(++timer, fn); return timer; }, clearTimeout: id => timers.delete(id) });
  const ref = { current: { injectJavaScript: script => scripts.push(script) } };
  const render = () => { cursor = 0; return useNativeGym(ref, start, url => urls.push(url)); };
  let gym = render(); gym.onNavigation(start + 'dashboard-gym-client');
  return { render, scripts, urls, timers,
    request() { const promise = render().refresh(); return { promise, script: scripts.at(-1) }; },
    reply(request, status, data) {
      const config = JSON.parse(request.script.match(/\}\)\((\{.*\})\);true;$/s)[1]);
      render().onMessage({ url: start + 'dashboard-gym-client', data: JSON.stringify({
        type: core.NATIVE_GYM_MESSAGE, id: config.id, status, result: { success: status === 200, data },
      }) });
    },
  };
}

test('FTX HTTP 403 clears native access without signing out the valid website session', async () => {
  const p = hook(), first = p.request(); p.reply(first, 200, snapshot()); await first.promise;
  assert.ok(p.render().data);
  const request = p.request(); p.reply(request, 403, null); await request.promise;
  const gym = p.render();
  assert.equal(gym.data, null); assert.equal(gym.screen, 'web');
  assert.equal(gym.bootstrapState, 'failed'); assert.equal(gym.bootstrapError, 'HTTP_403');
  assert.ok(!p.scripts.some(script => script.includes('location.replace')));
  assert.ok(gym.injectedScript.includes('"enabled":false'));
});

test('an expired session returns to sign-in instead of trapping startup on the error screen', async () => {
  const p = hook(), request = p.request(); p.reply(request, 401, null); await request.promise;
  assert.equal(p.render().data, null); assert.equal(p.render().bootstrapState, 'idle');
  assert.ok(p.scripts.at(-1).includes('location.replace("' + start + 'login")'));
});

test('registration and password recovery remain open without a protected context request or login bounce',async()=>{
 for(const route of ['form-signup','form-signup/index','site/signup-client','site/request-password-reset','request-password-reset','reset-password?token=SYNTHETIC']){
   const p=hook(),url=start+route;p.render().onNavigation(url);const before=p.scripts.length;
   p.render().onLoadEnd({nativeEvent:{url}});await p.render().refresh();
   assert.equal(p.timers.size,0,route+' must not request protected context');
   assert.ok(p.scripts.slice(before).every(script=>!script.includes('sc.nativeGym.response')),route+' must keep the public form open');
   assert.ok(!p.scripts.some(script=>script.includes('location.replace')),route+' must not bounce back to login');
 }
});

test('leaving a client session for registration invalidates pending context before its guest response',async()=>{
 const p=hook(),request=p.request();p.render().onNavigation(start+'form-signup');await request.promise;
 p.reply(request,401,null);p.render().onLoadEnd({nativeEvent:{url:start+'form-signup'}});
 assert.ok(!p.scripts.some(script=>script.includes('location.replace')));assert.equal(p.render().data,null);assert.equal(p.timers.size,0);
});

test('client Settings keeps the previous web pass hidden until the settings document finishes',async()=>{
  const p=hook(),context=p.request();p.reply(context,200,snapshot());await context.promise;
  p.render().openWeb('settings');
  assert.equal(new URL(p.render().webTarget).pathname,'/client-settings');
  p.render().onLoadEnd({nativeEvent:{url:start+'dashboard-gym-client'}});
  assert.ok(p.render().webTarget,'A late load from the old dashboard cannot reveal it');
  p.render().onNavigation(start+'client-settings');
  p.render().onLoadEnd({nativeEvent:{url:start+'client-settings'}});
  assert.equal(p.render().webTarget,null);
  assert.equal(p.render().webSection,'settings');
});

test('a server-disabled native dashboard keeps the website open without reporting invalid data', async () => {
  const p = hook(), request = p.request(); p.reply(request, 200, { enabled: false }); await request.promise;
  assert.equal(p.render().data, null); assert.equal(p.render().screen, 'web');
  assert.equal(p.render().bootstrapState, 'idle'); assert.equal(p.render().bootstrapError, '');
});

test('retry after HTTP 403 activates native tools only when the server grants valid context', async () => {
  const p = hook(), first = p.request(); p.reply(first, 403, null); await first.promise;
  const retry = p.request(); p.reply(retry, 200, snapshot()); await retry.promise;
  assert.equal(p.render().data.accountKey, snapshot().accountKey);
  assert.equal(p.render().bootstrapState, 'idle'); assert.equal(p.render().bootstrapError, '');
});

test('client logout clears native account only after server confirmation and returns to sign-in',async()=>{
 const p=hook(),context=p.request();p.reply(context,200,snapshot());await context.promise;
 const logout=p.render().logout();const request={script:p.scripts.at(-1)};
 assert.ok(p.render().data,'Account remains visible while logout is unconfirmed');
 const config=JSON.parse(request.script.match(/\}\)\((\{.*\})\);true;$/s)[1]);
 assert.equal(config.path,'/site/logout');assert.equal(config.post,true);
 p.reply(request,200,{loggedOut:true});await logout;
 assert.equal(p.render().data,null);assert.equal(p.render().screen,'web');
 assert.equal(new URL(p.urls.at(-1)).pathname,'/login');
 assert.equal(p.render().authTransition,false,'Confirmed logout opens a fresh WebView without waiting behind an overlay');
 p.render().onNavigation(start+'login');assert.equal(p.render().authTransition,false);
 p.render().onLoadEnd({nativeEvent:{url:start+'login'}});assert.equal(p.render().authTransition,false);
});

test('failed client logout retains the session and can be retried',async()=>{
 const p=hook(),context=p.request();p.reply(context,200,snapshot());await context.promise;
 const logout=p.render().logout();p.reply({script:p.scripts.at(-1)},500,null);
 await assert.rejects(logout);assert.ok(p.render().data);assert.equal(p.render().busy,false);assert.equal(p.render().authTransition,false);
 const retry=p.render().logout();p.reply({script:p.scripts.at(-1)},200,{loggedOut:true});await retry;
 assert.equal(p.render().data,null);
});

test('iPhone login DOM readiness ends the logout overlay without a WebView load-end event',async()=>{
 const p=hook(),context=p.request();p.reply(context,200,snapshot());await context.promise;
 const logout=p.render().logout();p.reply({script:p.scripts.at(-1)},200,{loggedOut:true});await logout;
 const url=p.urls.at(-1),messages=[],{JSDOM}=require('jsdom');
 const dom=new JSDOM('<html><body><form><input type="password"></form></body></html>',{url,runScripts:'outside-only'});
 dom.window.ReactNativeWebView={postMessage:value=>messages.push(JSON.parse(value))};
 dom.window.eval(core.authPageReadyScript(start));dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
 assert.equal(messages[0].type,core.NATIVE_AUTH_READY);
 p.render().onMessage({url:'https://foreign.example/login',data:JSON.stringify({...messages[0],documentUrl:'https://foreign.example/login'})});
 assert.equal(p.render().authTransition,false,'No extra loading gate remains after the server confirms sign-out');
 p.render().onMessage({url,data:JSON.stringify(messages[0])});
 assert.equal(p.render().authTransition,false);assert.equal(p.timers.size,0);dom.window.close();
});

test('logout never leaves a loading gate after confirmation and retry creates a fresh login WebView',async()=>{
 const p=hook(),context=p.request();p.reply(context,200,snapshot());await context.promise;
 const logout=p.render().logout();p.reply({script:p.scripts.at(-1)},200,{loggedOut:true});await logout;
 const first=p.urls.at(-1);assert.equal(p.render().authTransitionError,'');
 assert.equal(p.timers.size,0);assert.equal(p.render().authTransition,false);
 p.render().signIn();assert.notEqual(p.urls.at(-1),first);assert.equal(p.render().authTransitionError,'');
 p.render().onAuthLoadError({url:p.urls.at(-1),code:-1001});assert.equal(p.render().authTransition,false);
 p.render().onAuthPageReady(p.urls.at(-1));assert.equal(p.render().authTransition,false);
});

async function logoutTransport(responses,verification={status:401,json:{success:false}}){
 const calls=[],messages=[];
 vm.runInNewContext(core.gymRequestScript('logout','logout',{},start),{URL,URLSearchParams,AbortController,
  setTimeout:()=>1,clearTimeout(){},location:{origin:new URL(start).origin,href:start+'dashboard-gym-client'},
  document:{querySelector:selector=>({content:selector.includes('csrf-token')?'private-token':'_csrf-frontend'})},
  window:{ReactNativeWebView:{postMessage:value=>messages.push(JSON.parse(value))}},
  fetch:async(url,options)=>{calls.push({url,options});const next=url==='/native-gym'?verification:responses.shift();if(next instanceof Error)throw next;return {...next,ok:next.status>=200&&next.status<300,text:async()=>next.body||'',json:async()=>next.json};}});
 await new Promise(setImmediate);return {calls,messages};
}
test('iPhone client logout posts the website form in the existing cookie jar and confirms login redirect',async()=>{
 const result=await logoutTransport([{status:200,url:start+'login',redirected:true}]);
 assert.equal(result.calls[0].url,'/site/logout');assert.equal(result.calls[0].options.method,'POST');
 assert.equal(result.calls[0].options.credentials,'same-origin');assert.ok(result.calls[0].options.body.includes('_csrf-frontend=private-token'));
 assert.ok(result.calls[0].options.body.includes('logout_context=public'),'Always return to the current app login, not a different selected company');
 assert.equal(result.messages[0].result.data.loggedOut,true);assert.ok(!JSON.stringify(result.messages).includes('private-token'));
});
test('expired logout CSRF refreshes once; a dashboard response or foreign redirect never confirms sign-out',async()=>{
 const retry=await logoutTransport([{status:400,url:start+'site/logout'},
  {status:200,json:{success:true,data:{param:'_csrf-frontend',token:'fresh-token'}}},
  {status:200,url:start+'login',redirected:true}]);
 assert.equal(retry.calls.length,4);assert.equal(retry.calls[1].url,'/api/v1/csrf');
 assert.equal(retry.calls[2].options.headers['X-CSRF-Token'],'fresh-token');assert.equal(retry.messages[0].result.success,true);
 for(const url of [start+'dashboard-gym-client','https://other.example/login']){
  const failure=await logoutTransport([{status:200,url,redirected:true}]);assert.ok(!failure.messages[0].result?.success);
 }
 const offline=await logoutTransport([Error('network')]);assert.equal(offline.messages[0].status,0);
});

test('a 404 logout destination falls back to a protected native POST without accepting an error page as success',async()=>{
 for(const response of [{status:200,json:{success:true,data:{loggedOut:true}}},{status:401,json:{success:false}}]){
  const result=await logoutTransport([{status:404,url:start+'missing-company-login',redirected:true},{...response,url:start+'native-gym/logout'}]);
  assert.equal(result.calls[1].url,'/native-gym/logout');assert.equal(result.calls[1].options.method,'POST');
  assert.equal(result.messages[0].result.data.loggedOut,true);
 }
 const failed=await logoutTransport([{status:404,url:start+'site/logout'},{status:404,url:start+'native-gym/logout'},{status:404,url:start+'api/v1/native-gym/logout'}]);
 assert.ok(!failed.messages[0].result?.success);
});

test('a redirect to Login does not count as logout while the same WebView session is still authenticated',async()=>{
 const result=await logoutTransport([{status:200,url:start+'login',redirected:true}],{status:200,json:{success:true,data:snapshot()}});
 assert.equal(result.calls.at(-1).url,'/native-gym');assert.equal(result.messages[0].status,409);
 assert.equal(result.messages[0].result.success,false);
});

test('iPhone WebView cannot reimport shared app cookies after logout; saved-role redirects are removed',()=>{
 const source=fs.readFileSync(path.join(root,'src/screens/WebViewScreen.js'),'utf8');
 const ast=babel.parseSync(source,{babelrc:false,configFile:false,parserOpts:{plugins:['jsx']}});let cookiePolicy;
 function visit(node){if(!node||typeof node!=='object')return;if(node.type==='JSXOpeningElement'&&node.name?.name==='WebView')cookiePolicy=node.attributes.find(attribute=>attribute.name?.name==='sharedCookiesEnabled')?.value?.expression;for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}}
 visit(ast);assert.ok(cookiePolicy);
 const expression=babel.transformFromAstSync({type:'File',program:{type:'Program',sourceType:'script',body:[{type:'ExpressionStatement',expression:cookiePolicy}]}},null,{babelrc:false,configFile:false}).code;
 assert.equal(vm.runInNewContext(expression,{Platform:{OS:'ios'}}),false);
 assert.equal(vm.runInNewContext(expression,{Platform:{OS:'android'}}),true);
 assert.ok(!source.includes('GYM_REDIRECT_SCRIPT'),'Stale local storage must not redirect Login back to a dashboard');
});

test('an older failed request cannot overwrite a newer startup request', async () => {
  const p = hook(), old = p.request(), current = p.request();
  p.reply(old, 500, null); await old.promise;
  assert.equal(p.render().bootstrapState, 'loading'); assert.equal(p.render().bootstrapError, '');
  p.reply(current, 200, snapshot()); await current.promise;
  assert.ok(p.render().data); assert.equal(p.render().bootstrapState, 'idle');
});

test('navigation while startup is pending cancels the request without re-opening an error screen', async () => {
  const p = hook(), request = p.request();
  p.render().onNavigation(start + 'profile'); await request.promise;
  assert.equal(p.render().bootstrapState, 'idle'); assert.equal(p.timers.size, 0);
});

test('malformed responses and timeouts remain retryable without granting native access', async () => {
  const p = hook(), request = p.request(); p.reply(request, 200, { enabled: true }); await request.promise;
  assert.equal(p.render().bootstrapError, 'invalid_context'); assert.equal(p.render().data, null);
  const retry = p.request(); [...p.timers.values()][0](); await retry.promise;
  assert.equal(p.render().bootstrapState, 'failed'); assert.equal(p.render().bootstrapError, 'connection');
});

function shell(gym, child, extra = {}) {
  const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: value => [value, () => {}], useEffect() {}, useRef: value => ({ current: value }) };
  const translations = load('utils/nativeGymTranslations.js');
  const native = Object.fromEntries(['ActivityIndicator','Alert','Image','Modal','PixelRatio','Pressable',
    'RefreshControl','ScrollView','View'].map(name => [name, name]));
  const { default: NativeGymShell } = load('screens/NativeGymShell.js', {
    react, 'react-native': { ...native, Platform: { OS: 'android' }, StyleSheet: { create: value => value } },
    'expo-font': { useFonts: () => [true] },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0, top: 0 }) },
    '../utils/nativeGymTranslations': translations, '../utils/nativeGymCore': core,
    './NativeWorkoutTimer': 'Timer', './NativeNotifications': 'Notifications', './NativeBirthdays': 'Birthdays',
    './NativeClientBookings':'ClientBookings',
    './NativeClientTabIcon':'ClientTabIcon',
    './NativeCompanyLogo':'CompanyLogo','./NativeFitnessCalendar':'FitnessCalendar',
    './NativeGymTypography': { Text: 'Text', Icon: 'Icon', NativeFontContext: { Provider: 'Provider' } },
    '../utils/gymUiTheme': { __esModule: true, default: {}, brandSoft: () => '' },
    '../utils/summaryCardLayout': load('utils/summaryCardLayout.js', {}),
    '../utils/companyAppConfig': () => ({ color: '#198754' }),
    '../utils/nativeCompanyBranding': { companyLogoImage: () => 1 },
    '../utils/useBirthdayCount': () => [0,()=>{}],
    ...Object.fromEntries(['boxicons.ttf','Poppins-Regular.ttf','Poppins-SemiBold.ttf','BricolageGrotesque-Bold.ttf']
      .map(name => ['../assets/fonts/' + name, 1])),
  });
  return NativeGymShell({ gym, children: child, ...extra });
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...(tree.props?.children || []).flat(Infinity).flatMap(nodes)];
}
test('startup uses the same native shell as Demo, without a company-specific web fallback', () => {
  for (const bootstrapState of ['idle', 'loading', 'failed']) {
    const child = { type: 'WebView', props: {} };
    const tree = shell({ data: null, bootstrapState, bootstrapError: 'HTTP_403', screen: 'web' }, child);
    const wrapper = nodes(tree).find(node => node.props?.children?.includes(child));
    const pending = bootstrapState !== 'idle';
    assert.equal(wrapper.props.pointerEvents, pending ? 'none' : 'auto');
    assert.equal(wrapper.props.accessibilityElementsHidden, pending);
    assert.equal(wrapper.props.importantForAccessibility, pending ? 'no-hide-descendants' : 'auto');
    assert.equal(nodes(tree).some(node => node.props?.testID === 'native-client-setup'), pending);
    assert.ok(!nodes(tree).some(node => node.props?.testID === 'native-client-status'));
  }
});

test('client Bookings tab hides the web content and opens the native booking page without navigating',()=>{
 const child={type:'WebView',props:{}},opened=[];
 const tree=nodes(shell({data:snapshot(),screen:'web',webSection:'bookings',showBookings:()=>opened.push('native'),openWeb:()=>opened.push('web')},child,{bookings:{page:null},sharing:{}}));
 assert.ok(tree.some(node=>node.type==='ClientBookings'));
 const wrapper=tree.find(node=>node.props.children?.includes(child));assert.equal(wrapper.props.pointerEvents,'none');assert.equal(wrapper.props.accessibilityElementsHidden,true);
 tree.find(node=>node.props.accessibilityRole==='tab'&&node.props.accessibilityLabel==='Bookings').props.onPress();assert.deepEqual(opened,['native']);
});

test('client header shows company and member identity with booking shortcuts and no general Share action',()=>{
 let loads=0;
 const tree=nodes(shell({data:snapshot(),screen:'web',webSection:'bookings'},null,{bookings:{page:null,busy:false,load:()=>loads++}}));
 assert.ok(tree.some(node=>node.props.testID==='native-client-header'));
 assert.ok(tree.some(node=>node.type==='Text'&&node.props.children.includes('Test member')&&node.props.children.includes(' · Member')));
 for(const label of ['Upcommings','History']) {
  const button=tree.find(node=>node.props.accessibilityRole==='button'&&node.props.accessibilityLabel===label);
  assert.ok(button);button.props.onPress();
 }
 assert.equal(loads,2);
 assert.ok(!tree.some(node=>node.props.accessibilityLabel==='Share'));
});

test('logout transition hides the old web dashboard until the login document is ready',()=>{
 const child={type:'WebView',props:{}};
 const tree=nodes(shell({data:null,screen:'web',authTransition:true,bootstrapState:'idle'},child));
 const wrapper=tree.find(node=>node.props.children?.includes(child));
 assert.equal(wrapper.props.pointerEvents,'none');assert.equal(wrapper.props.accessibilityElementsHidden,true);
 assert.ok(tree.some(node=>node.props.testID==='native-auth-transition'));
});

test('opening the client dashboard covers legacy HTML before context loading completes',()=>{
 const p=hook();assert.equal(p.render().bootstrapState,'loading');assert.equal(p.render().data,null);
 const {JSDOM}=require('jsdom');
 for(const suffix of ['dashboard-gym-client','dashboard-gym-client/index','login']){
  const dom=new JSDOM('<html><head></head><body><div class="gym-client-portal">Old dark dashboard</div></body></html>',{url:start+suffix,runScripts:'outside-only'});
  dom.window.eval(core.nativeShellStyleScript(false,start,undefined,true));
  assert.equal(dom.window.document.documentElement.classList.contains('sc-native-client-startup'),suffix!=='login');
  dom.window.eval(core.nativeShellStyleScript(true,start,'#198754'));
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  assert.ok(!dom.window.document.documentElement.classList.contains('sc-native-client-startup'));
  assert.ok(dom.window.document.documentElement.classList.contains('sc-native-shell'),'An older DOM-ready handler cannot restore the old shell');
  dom.window.eval(core.nativeShellStyleScript(false,start));
  assert.ok(!dom.window.document.documentElement.classList.contains('sc-native-client-startup'),'Explicit server-disabled fallback can reveal website');
  dom.window.close();
 }
});
