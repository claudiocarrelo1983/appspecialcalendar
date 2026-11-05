const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { test } = require('node:test'), babel = require('@babel/core');
const root = path.join(__dirname, '..');
function load(file, mocks) {
  const { code } = babel.transformSync(fs.readFileSync(path.join(root, 'src', file), 'utf8'), {
    babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'],
  });
  const exports = {}; vm.runInNewContext(code, { exports, URL, URLSearchParams, setTimeout, clearTimeout, require(name) {
    assert.ok(name in mocks, name); return mocks[name];
  } }); return exports;
}
const core = load('utils/nativeAdminCore.js', { './nativeGymCore': {} });
function render(admin,extra={}) {
  const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: value => [value, () => {}], useRef: value => ({ current: value }), useEffect() {} };
  const native = Object.fromEntries(['ActivityIndicator','Alert','FlatList','Image','Modal','Pressable','RefreshControl','TextInput','View'].map(name => [name, name]));
  const { default: Shell } = load('screens/NativeAdminShell.js', { react,
    './NativeScheduleFilter': 'ScheduleFilter',
    './NativeClassShare':'ClassShare',
    './NativeAdminHeader': {ShareIcon:'ShareIcon'},
    '../utils/classLinks':load('utils/classLinks.js',{}),
    '../utils/calendarAlerts':{showCalendarFailure(){}},'../utils/nativeCalendar':{createClassCalendarHandler:()=>async()=>{}},
    'react-native': { ...native, StyleSheet: { create: value => value } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    './NativeGymTypography': {LoadingIndicator:'ActivityIndicator', Text: 'Text' }, '../utils/nativeAdminCore': core,
    '../utils/companyAppConfig': () => ({ color: '#198754', siteUrl: 'https://c20260531125358085.specialcalendar.com' }),
    '../utils/gymUiTheme': { __esModule: true, default: {}, brandSoft: () => '' },
  });
  return Shell({ admin, children: { type: 'WebView', props: {} },...extra });
}
function nodes(tree) { return !tree || typeof tree !== 'object' ? [] : [tree, ...(tree.props?.children || []).flat(Infinity).flatMap(nodes)]; }

test('member-owned web content cannot display the legacy staff navigation or class overlay',()=>{
 const tree=render({context:{language:'pt',classes:[]},screen:'classes',onDashboard:true,rosterOpen:true},{enabled:false});
 assert.equal(tree.type,'WebView');assert.equal(nodes(tree).length,1);
});

test('schedule filter matches web day/week navigation, Today, Monday strip and class selection',()=>{
  const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),useRef:value=>({current:value}),useEffect(){}};
  const filter=load('screens/NativeScheduleFilter.js',{react,'react-native':{View:'View',Pressable:'Pressable',ScrollView:'ScrollView',StyleSheet:{create:v=>v}},'./NativeGymTypography':{LoadingIndicator:'ActivityIndicator',Text:'Text'},'../utils/gymUiTheme':{}});
  const dates=[],classes=[];
  const tree=nodes(filter.default({date:'2026-12-31',today:'2026-10-30',classes:[{code:'muay',label:'Muay Thai'}],classCode:'muay',color:'#198754',onDate:value=>dates.push(value),onClass:value=>classes.push(value)}));
  const press=label=>tree.find(node=>node.props.accessibilityLabel===label).props.onPress();
  press('Next day');press('Next week');press('Previous day');press('Previous week');press('Today');
  assert.deepEqual(dates,['2027-01-01','2027-01-07','2026-12-30','2026-12-24','2026-10-30']);
  press('All');press('Muay Thai');assert.deepEqual(classes,['','muay']);
  assert.equal(tree.filter(node=>node.props.accessibilityLabel?.includes('December')||node.props.accessibilityLabel?.includes('January')).length,7);
  assert.equal(filter.shiftScheduleDate('2028-02-28',1),'2028-02-29');
});
test('native roster retains booking keys and remains mounted while participant status changes', () => {
  const klass = { schedule_id: 1, class_name: 'Muay-Thai', date: '2026-10-30', can_manage: true };
  const state = { context: { language: 'en', classes: [klass] }, screen: 'web', onDashboard: true, rosterOpen: true,
    roster: { class: klass, participants: [{ booking_id: 5, member_name: 'Test member', status: 'pending' }] }, members: [] };
  const before = nodes(render(state)).find(node => node.props?.testID === 'native-admin-roster');
  const after = nodes(render({ ...state, roster: { ...state.roster, participants: [{ ...state.roster.participants[0], status: 'attended' }] } }))
    .find(node => node.props?.testID === 'native-admin-roster');
  assert.equal(before.type, 'FlatList'); assert.equal(after.type, 'FlatList');
  assert.equal(before.props.keyExtractor(before.props.data[0]), '5');
  assert.equal(after.props.keyExtractor(after.props.data[0]), '5');
  assert.equal(before.props.key, undefined); assert.equal(after.props.key, undefined);
});
test('clients without an admin context get the original web flow without admin controls', () => {
  const tree = nodes(render({ context: null, screen: 'web', rosterOpen: false, members: [] }));
  assert.ok(!tree.some(node => node.props?.testID === 'native-admin-navigation'));
  const web = tree.find(node => node.props?.pointerEvents === 'auto');
  assert.ok(web); assert.equal(web.props.accessibilityElementsHidden, false);
});
