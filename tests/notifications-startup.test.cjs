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
    console: { warn() {} },
    require(name) {
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
});

function hookWith(notifications, device = () => ({ isDevice: true })) {
  const effects = [];
  const hook = load('usePushNotifications.js', {
    react: () => ({
      useCallback: (callback) => callback,
      useRef: (current) => ({ current }),
      useEffect: (effect) => effects.push(effect),
    }),
    'react-native': () => ({ Platform: { OS: 'ios' }, AppState: {} }),
    'expo-constants': () => ({ easConfig: { projectId: 'test-project' } }),
    './notificationModule': () => ({ getNotifications: () => notifications }),
    './pushInstallation': () => ({ getPushInstallation: async () => ({installationId:'a'.repeat(32),installationSecret:'b'.repeat(64)}), pushRegistrationScript: () => 'true;' }),
    'expo-device': device,
  });
  hook.default({ current: { injectJavaScript() {} } }, 'https://specialcalendar.com/login', () => {});
  return { hook, effects };
}

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
