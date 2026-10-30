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
  const slots = [], scripts = [], timers = new Map(); let cursor = 0, timer = 0;
  const react = { useRef(value) { const i = cursor++; if (!(i in slots)) slots[i] = { current: value }; return slots[i]; },
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value;
      return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useCallback: fn => fn, useEffect() {} };
  const { default: useNativeGym } = load('utils/useNativeGym.js', {
    react, 'react-native': { AppState: {} }, 'expo-notifications': {},
    'expo-secure-store': { deleteItemAsync: async () => {} },
    './nativeTimerAlerts': { cancelTimerAlert: async () => {} }, './nativeGymCore': core,
  }, { setTimeout: fn => { timers.set(++timer, fn); return timer; }, clearTimeout: id => timers.delete(id) });
  const ref = { current: { injectJavaScript: script => scripts.push(script) } };
  const render = () => { cursor = 0; return useNativeGym(ref, start, () => {}); };
  let gym = render(); gym.onNavigation(start + 'dashboard-gym-client');
  return { render, scripts, timers,
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

function shell(gym, child) {
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
    './NativeGymTypography': { Text: 'Text', Icon: 'Icon', NativeFontContext: { Provider: 'Provider' } },
    '../utils/gymUiTheme': { __esModule: true, default: {}, brandSoft: () => '' },
    '../utils/companyAppConfig': () => ({ color: '#198754' }),
    '../utils/nativeCompanyBranding': { companyLogoImage: () => 1 },
    ...Object.fromEntries(['boxicons.ttf','Poppins-Regular.ttf','Poppins-SemiBold.ttf','BricolageGrotesque-Bold.ttf']
      .map(name => ['../assets/fonts/' + name, 1])),
  });
  return NativeGymShell({ gym, children: child });
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
