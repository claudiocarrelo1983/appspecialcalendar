const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { test } = require('node:test'), babel = require('@babel/core');
const { code } = babel.transformSync(fs.readFileSync(path.join(__dirname, '../src/utils/webViewPosition.js'), 'utf8'), {
  babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
});
const exportsObject = {}; vm.runInNewContext(code, { exports: exportsObject, URL });
function page(saved, age = 0, route='/dashboard-gym') {
  const listeners = {}, storage = new Map(), moves = [];
  const origin = 'https://c20260531125358085.specialcalendar.com', key = 'sc-scroll:'+route;
  if (saved !== undefined) storage.set(key, JSON.stringify({ y: saved, at: Date.now() - age }));
  const context = { location: { origin, pathname: route, search: '', href: origin + route }, URL,
    sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    document: { readyState: 'complete', addEventListener: (name, fn) => { listeners[name] = fn; } },
    window: { scrollY: 650, addEventListener: (name, fn) => { listeners[name] = fn; }, requestAnimationFrame: fn => fn(),
      scrollTo: (_x, y) => { moves.push(y); context.window.scrollY = y; } }, setTimeout: fn => fn(),
  };
  vm.runInNewContext(exportsObject.positionRestoreScript(origin), context);
  return { listeners, storage, moves, key };
}
test('clock/check-in submits save only position and a timestamp, then restore after reload', () => {
  const p = page();
  p.listeners.submit({ target: { action: 'https://c20260531125358085.specialcalendar.com/timesheet/clock-out' } });
  const saved = JSON.parse(p.storage.get(p.key)); assert.equal(saved.y, 650);
  assert.deepEqual(Object.keys(saved), ['y', 'at']); assert.equal(page(saved.y).moves[0], 650);
});

test('a normal submit button default formAction cannot override the form action',()=>{
 const p=page();p.listeners.submit({target:{action:'https://c20260531125358085.specialcalendar.com/timesheet/clock-in'},submitter:{hasAttribute:()=>false,formAction:'https://c20260531125358085.specialcalendar.com/dashboard-gym'}});
 assert.equal(JSON.parse(p.storage.get(p.key)).y,650);
});

test('Yii POST links on attendance pages and clock controls on team dashboards retain position',()=>{
  for(const route of ['/gym-attendance','/gym-checkin','/dashboard-team']){
    const p=page(undefined,0,route);
    p.listeners.click({target:{closest:()=>({href:'https://c20260531125358085.specialcalendar.com/gym-attendance/checkout?id=8'})}});
    assert.equal(JSON.parse(p.storage.get(p.key)).y,650);
  }
  const p=page();p.listeners.click({target:{closest:()=>({href:'https://foreign.example/gym-attendance/checkout'})}});
  assert.equal(p.storage.size,0);
});

test('nested scroll positions store coordinates only and delayed layouts are restored repeatedly',()=>{
  const p=page();p.listeners.submit({target:{action:'https://c20260531125358085.specialcalendar.com/timesheet/clock-in',parentElement:{id:'main-scroll',scrollHeight:1800,clientHeight:600,scrollTop:310}}});
  assert.deepEqual(JSON.parse(p.storage.get(p.key)).containers,[{id:'main-scroll',y:310}]);
  assert.equal(page(650).moves.length,20);
});
test('expired positions and unrelated/cross-origin forms cannot change navigation position', () => {
  assert.equal(page(500, 60000).moves.length, 0);
  for (const action of ['https://evil.example/clock-in', 'https://c20260531125358085.specialcalendar.com/site/login']) {
    const p = page(); p.listeners.submit({ target: { action } }); assert.equal(p.storage.size, 0);
  }
});
