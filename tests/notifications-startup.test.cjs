const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const babel = require('@babel/core');

function load(file, mocks) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'utils', file), 'utf8');
  const { code } = babel.transformSync(source, {
    babelrc: false,
    configFile: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    URL,
    URLSearchParams,
    console: { warn() {} },
    require(name) {
      if(name==='./classLinks')return load('classLinks.js',{});
      assert.ok(name in mocks, `Unexpected import: ${name}`);
      return mocks[name]();
    },
  });
  return exports;
}

test('missing native notifications do not throw during import or initialization', () => {
  let attempts = 0;
  const { getNotifications } = load('notificationModule.js', {
    'expo-notifications': () => {
      attempts += 1;
      throw new Error("Cannot find native module 'ExpoPushTokenManager'");
    },
  });
  assert.equal(attempts, 0);
  assert.equal(getNotifications(), null);
  assert.equal(getNotifications(), null);
  assert.equal(attempts, 1);
});

test('notification handler setup failure stays inside the optional feature', () => {
  const { getNotifications } = load('notificationModule.js', {
    'expo-notifications': () => ({ setNotificationHandler() { throw new Error('Native setup failed'); } }),
  });
  assert.equal(getNotifications(), null);
});

test('available notifications initialize once and retain foreground handling', async () => {
  let calls = 0;
  let handler;
  const notifications = { setNotificationHandler(value) { calls += 1; handler = value; } };
  const { getNotifications } = load('notificationModule.js', {
    'expo-notifications': () => notifications,
  });
  assert.equal(getNotifications(), notifications);
  assert.equal(getNotifications(), notifications);
  assert.equal(calls, 1);
  assert.equal((await handler.handleNotification()).shouldShowBanner, true);
  const phase=await handler.handleNotification({request:{content:{data:{type:'workout-set'}}}});
  assert.equal(phase.shouldShowBanner,false);assert.equal(phase.shouldShowList,false);assert.equal(phase.shouldPlaySound,true);
});

function hookWith(notifications, device = () => ({ isDevice: true })) {
  const effects = [];
  const scripts=[],openedUrls=[];
  const hook = load('usePushNotifications.js', {
    react: () => ({
      useCallback: (callback) => callback,
      useRef: (current) => ({ current }),
      useEffect: (effect) => effects.push(effect),
    }),
    'react-native': () => ({ Platform: { OS: 'ios' }, AppState: {addEventListener:()=>({remove(){}})} }),
    'expo-constants': () => ({ easConfig: { projectId: 'test-project' } }),
    './notificationModule': () => ({ getNotifications: () => notifications }),
    './pushNotificationNavigation': () => load('pushNotificationNavigation.js', {}),
    './pushInstallation': () => ({ getPushInstallation: async () => ({installationId:'a'.repeat(32),installationSecret:'b'.repeat(64)}), pushRegistrationScript: () => 'true;' }),
    'expo-device': device,
  });
  const instance=hook.default({ current: { injectJavaScript(script) {scripts.push(script);} } }, 'https://specialcalendar.com/login', url=>openedUrls.push(url));
  return { hook, effects,instance,scripts,openedUrls };
}

test('class reminders use the resolved class popup instead of a generic text popup, with stale fallback',async()=>{
 let response;
 const h=hookWith({getPermissionsAsync:async()=>({granted:false,status:'denied'}),requestPermissionsAsync:async()=>({granted:false,status:'denied'}),
  addNotificationResponseReceivedListener:fn=>{response=fn;return {remove(){}};},addPushTokenListener:()=>({remove(){}}),getLastNotificationResponseAsync:async()=>null,clearLastNotificationResponseAsync:async()=>{}});
 const cleanup=h.effects[0]();
 const tap=id=>response({actionIdentifier:'default',notification:{request:{identifier:id,content:{title:'Class reminder',body:'Your class starts in 10 minutes.',data:{type:'class-reminder',url:'/mobile-notifications/open?code='+'a'.repeat(64)}}}}});
 tap('first');assert.ok(h.openedUrls[0].includes('/mobile-notifications/open?code='));
 h.instance.onLoadEnd({nativeEvent:{url:'https://specialcalendar.com/dashboard-gym-client/index?date=2026-12-30&schedule_id=7&_push_class=1'}});
 assert.ok(!h.scripts.some(script=>script.includes('window.__specialCalendarOpenedNotification=')));
 tap('expired');h.instance.onLoadEnd({nativeEvent:{url:'https://specialcalendar.com/mobile-notifications/open?code='+'a'.repeat(64)}});
 assert.ok(h.scripts.some(script=>script.includes('window.__specialCalendarOpenedNotification=')),'Expired reminders retain an information fallback');
 cleanup();await new Promise(setImmediate);
});

test('startup and registration survive absent notification native modules', async () => {
  const { hook, effects } = hookWith(null);
  assert.doesNotThrow(() => effects[0]());
  const state = await hook.registerPushNotifications();
  assert.equal(state.error, 'notifications-unavailable');
  assert.equal(state.expoPushToken, null);
});

test('partially initialized listeners are cleaned up after a native failure', () => {
  let removed = 0;
  const { effects } = hookWith({
    addNotificationResponseReceivedListener: () => ({ remove() { removed += 1; } }),
    addPushTokenListener() { throw new Error('Listener unavailable'); },
    getPermissionsAsync: async () => ({ granted: false, canAskAgain: false, status: 'denied' }),
  });
  const cleanup = effects[0]();
  cleanup();
  assert.equal(removed, 1);
});

test('registration still obtains a push token when native modules are available', async () => {
  const { hook } = hookWith({
    getPermissionsAsync: async () => ({ granted: true, status: 'granted', canAskAgain: true }),
    getExpoPushTokenAsync: async ({ projectId }) => {
      assert.equal(projectId, 'test-project');
      return { data: 'ExponentPushToken[test]' };
    },
  });
  assert.equal((await hook.registerPushNotifications()).expoPushToken, 'ExponentPushToken[test]');
});

test('a missing device module cannot terminate registration', async () => {
  const { hook } = hookWith({
    getPermissionsAsync: async () => ({ granted: true, status: 'granted' }),
  }, () => { throw new Error("Cannot find native module 'ExpoDevice'"); });
  assert.equal((await hook.registerPushNotifications()).error, 'notifications-unavailable');
});

test('a forbidden server registration is reported separately from OS permission', () => {
  const { hook } = hookWith(null);
  const result = hook.pushRegistrationState({ success: false, error: 'request-rejected-403' });
  assert.equal(result.registrationStatus, 'failed');
  assert.equal(result.registrationError, 'registration-forbidden');
  assert.equal(result.permission, undefined);
});

test('successful and preference-disabled registrations clear previous errors', () => {
  const { hook } = hookWith(null);
  for (const enabled of [true, false]) {
    const result = hook.pushRegistrationState({ success: true, result: { success: true, enabled } });
    assert.equal(result.registrationStatus, enabled ? 'registered' : 'disabled');
    assert.equal(result.registrationError, null);
  }
});

test('registration diagnostics do not expose arbitrary response contents', () => {
  const { hook } = hookWith(null);
  for (const error of ['synthetic-private-server-response', '__proto__', 'constructor', undefined]) {
    const result = hook.pushRegistrationState({ success: false, error });
    assert.equal(result.registrationError, 'server-registration-failed');
    assert.equal(result.registrationStatus, 'failed');
  }
});
