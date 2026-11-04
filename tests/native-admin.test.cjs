const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { test } = require('node:test'), babel = require('@babel/core');
const root = path.join(__dirname, '..'), base = 'https://c20260531125358085.specialcalendar.com/';
function load(file, mocks = {}, globals = {}) {
  const { code } = babel.transformSync(fs.readFileSync(path.join(root, 'src/utils', file), 'utf8'), {
    babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  const exports = {};
  vm.runInNewContext(code, { exports, URL, ...globals, require(name) { assert.ok(name in mocks, name); return mocks[name]; } });
  return exports;
}
const gym = load('nativeGymCore.js'), core = load('nativeAdminCore.js', { './nativeGymCore': gym });
async function bridge(action, params = {}, { origin = new URL(base).origin, csrf = 'csrf-private', status = 200, redirected = false } = {}) {
  const calls = [], replies = [];
  const response = { success: status === 200, class: { schedule_id: 1 }, participant: { booking_id: 2 } };
  const context = { location: { origin }, window: { ReactNativeWebView: { postMessage: text => replies.push(JSON.parse(text)) } },
    document: { querySelector: selector => selector.startsWith('meta') && csrf ? { content: csrf } : null },
    URL, URLSearchParams, AbortController, setTimeout, clearTimeout,
    fetch: async (url, options) => { calls.push({ url, options }); return { status, redirected,
      url: redirected ? base + 'login' : new URL(url, base).href, json: async () => response }; },
  };
  vm.runInNewContext(core.adminScript(base, action, params, 'admin:1'), context);
  await new Promise(setImmediate);
  return { calls, replies };
}
test('admin attendance reuses same-origin cookies and CSRF without exporting tokens or foreign scope', async () => {
  const { calls, replies } = await bridge('attendance', { booking_id: 2, status: 'attended', company_code: 'other', user_id: 1 });
  assert.equal(calls.length, 1); assert.equal(calls[0].url, '/dashboard-gym/save-today-class-attendance');
  assert.equal(calls[0].options.method, 'POST'); assert.equal(calls[0].options.credentials, 'same-origin');
  assert.equal(calls[0].options.headers['X-CSRF-Token'], 'csrf-private');
  assert.equal(calls[0].options.body, 'booking_id=2&status=attended');
  assert.ok(!JSON.stringify(replies).includes('csrf-private'));
});
test('foreign documents and missing CSRF cannot submit an admin mutation', async () => {
  assert.equal((await bridge('attendance', { booking_id: 2, status: 'missed' }, { origin: 'https://evil.example' })).calls.length, 0);
  const missing = await bridge('remove', { booking_id: 2 }, { csrf: '' });
  assert.equal(missing.calls.length, 0); assert.equal(missing.replies[0].status, 0);
});
test('403 is retained and never retried through another endpoint; login redirects clear native access', async () => {
  const denied = await bridge('roster', { schedule_id: 1, date: '2026-10-30' }, { status: 403 });
  assert.equal(denied.calls.length, 1); assert.equal(denied.replies[0].status, 403);
  const login = await bridge('roster', { schedule_id: 1, date: '2026-10-30' }, { redirected: true });
  assert.equal(login.replies[0].status, 401);
});
test('bridge accepts only named admin actions, positive IDs and known attendance states', () => {
  assert.throws(() => core.adminScript(base, 'arbitrary', {}));
  assert.throws(() => core.adminScript(base, 'remove', { booking_id: -1 }));
  assert.throws(() => core.adminScript(base, 'attendance', { booking_id: 1, status: 'cancelled' }));
  assert.throws(() => core.adminScript(base, 'roster', { schedule_id: 1, date: '2026-02-31' }));
  assert.ok(core.isAdminDashboard(base + 'dashboard-gym', base));
  assert.ok(!core.isAdminDashboard(base + 'dashboard-gym-client', base));
  assert.ok(!core.isAdminDashboard('https://evil.example/dashboard-gym', base));
});

test('admin detection exports only rendered class data and intercepts Manage only after native acknowledgment', () => {
  const messages = [], listeners = {};
  const card = { dataset: { classCard: '7', classDate: '2026-10-30', classStartTime: '09:00', classEndTime: '10:30' },
    querySelector: selector => selector.startsWith('[data-gym-') ? null : ({ textContent: selector === 'h3' ? 'Muay-Thai' : 'Upcoming' }),
    querySelectorAll: () => [{ textContent: 'Coach' }, { textContent: 'Room' }] };
  const section = { dataset: { selectedDate: '2026-10-30', selectedClassCode: 'muay', classNextOffset: '1', classTotal: '1', csrfToken: 'private-token' },
    querySelectorAll: () => [{ dataset: { classRegistered: '5', classCapacity: '36' }, querySelector: () => card }] };
  const context = { location: { origin: new URL(base).origin, pathname: '/dashboard-gym' },
    window: { ReactNativeWebView: { postMessage: value => messages.push(JSON.parse(value)) } },
    document: { documentElement: { lang: 'pt' }, querySelector: () => section,
      addEventListener: (name, callback) => { listeners[name] = callback; } } };
  vm.createContext(context); vm.runInContext(core.adminScript(base), context);
  assert.equal(messages[0].event, 'ready'); assert.equal(messages[0].classes[0].class_name, 'Muay-Thai');
  assert.equal(messages[0].classCode, 'muay'); assert.ok(!JSON.stringify(messages).includes('private-token'));
  let intercepted = 0;
  const event = { target: { closest: () => ({ dataset: { scheduleId: '7', classDate: '2026-10-30' } }) },
    preventDefault: () => { intercepted++; }, stopImmediatePropagation() {} };
  listeners.click(event); assert.equal(intercepted, 0);
  vm.runInContext(core.adminActivationScript(true), context); listeners.click(event);
  assert.equal(intercepted, 1); assert.equal(messages.at(-1).event, 'open'); assert.equal(messages.at(-1).schedule, 7);
});

function hook() {
  const slots = [], scripts = [], timers = new Map(); let cursor = 0, nextTimer = 0;
  const react = { useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value;
    return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(value) { const i = cursor++; if (!(i in slots)) slots[i] = { current: value }; return slots[i]; },
    useCallback: fn => fn, useEffect() {} };
  const ref = { current: { injectJavaScript: script => scripts.push(script) } };
  const { default: useNativeAdmin } = load('useNativeAdmin.js', { react, './nativeGymCore': gym, './nativeAdminCore': core }, {
    setTimeout: fn => { timers.set(++nextTimer, fn); return nextTimer; }, clearTimeout: id => timers.delete(id),
  });
  const render = () => { cursor = 0; return useNativeAdmin(ref, base); };
  const send = value => render().onMessage({ url: base + 'dashboard-gym', data: JSON.stringify({ type: core.ADMIN_MESSAGE, ...value }) });
  const lastId = () => JSON.parse(scripts.at(-1).match(/\}\)\((\{.*\})\);true;$/s)[1]).id;
  const reply = (id, result, status = 200) => send({ event: 'response', id, status, result: { success: status === 200, ...result } });
  const klass = { schedule_id: 1, date: '2026-10-30', class_name: 'Muay-Thai', can_manage: true, stats: { registered: 2 } };
  render().onNavigation(base + 'dashboard-gym');
  send({ event: 'ready', date: klass.date, language: 'en', classes: [klass], next: 1, total: 1 });
  return { render, send, reply, lastId, scripts, klass, timers };
}

test('client class Share opens the native invitation popup and retains the original calendar control',()=>{
 const {JSDOM}=require('jsdom');
 const dom=new JSDOM('<html lang="pt"><a data-gym-share data-share-title="Muay Thai" href="/dashboard-gym-client/index?company_code=ftx&date=2026-12-30&schedule_id=7"><span>Share</span></a><a data-gym-calendar-event="{}" href="https://calendar.google.com/calendar/render">Calendar</a></html>',{url:base+'dashboard-gym-client',runScripts:'outside-only'});
 const messages=[];dom.window.ReactNativeWebView={postMessage:value=>messages.push(JSON.parse(value))};
 dom.window.eval(core.adminScript(base));dom.window.document.querySelector('[data-gym-share] span').click();
 assert.equal(messages[0].event,'share');assert.equal(messages[0].item.schedule_id,7);assert.equal(messages[0].language,'pt');
 const p=hook();p.render().onNavigation(base+'dashboard-gym-client');
 p.send({...messages[0],documentUrl:base+'dashboard-gym-client?date=2026-12-30'});
 assert.equal(p.render().sharedClass.class_name,'Muay Thai');p.render().closeShareClass();assert.equal(p.render().sharedClass,null);
 p.send({...messages[0],documentUrl:'https://other.example/dashboard-gym-client'});assert.equal(p.render().sharedClass,null);
 assert.ok(dom.window.document.querySelector('[data-gym-calendar-event]'));dom.window.close();
});

test('schedule class selection is sent to the server and retained for date changes and All',async()=>{
  const p=hook();
  const select=p.render().loadClasses('2026-10-30',false,'muay');
  assert.ok(p.scripts.at(-1).includes('"class_code":"muay"'));
  p.reply(p.lastId(),{classes:[p.klass],total:1,next:1});await select;
  assert.equal(p.render().context.classCode,'muay');
  const next=p.render().loadClasses('2026-10-31');
  assert.ok(p.scripts.at(-1).includes('"class_code":"muay"'));
  p.reply(p.lastId(),{classes:[],total:0,next:0});await next;
  const all=p.render().loadClasses('2026-10-31',false,'');
  assert.ok(p.scripts.at(-1).includes('"class_code":""'));
  p.reply(p.lastId(),{classes:[],total:0,next:0});await all;
  assert.equal(p.render().context.classCode,'');
});
test('admin dashboard enters the native date and class schedule without a secondary tap', () => {
  const p=hook();
  assert.equal(p.render().screen,'classes');assert.equal(p.render().context.classes[0].class_name,'Muay-Thai');
  p.render().showDashboard();
  p.send({event:'ready',date:p.klass.date,classes:[p.klass],total:1});
  assert.equal(p.render().screen,'web','background snapshots preserve an explicitly chosen summary');
  p.render().onNavigation(base+'memberships');assert.equal(p.render().screen,'web');
  p.render().onNavigation(base+'dashboard-gym');
  p.send({event:'ready',date:p.klass.date,classes:[],total:0});
  assert.equal(p.render().screen,'classes','returning to Dashboard also opens an empty native schedule');
});

test('a reminder opens its protected class roster once after the requested date is ready',async()=>{
 const p=hook();p.render().onNavigation(base+'dashboard-gym/index?date='+p.klass.date+'&schedule_id=1&_push_class=1');
 p.send({event:'ready',date:p.klass.date,classes:[p.klass],total:1});
 assert.ok(p.render().rosterOpen);assert.ok(p.render().rosterLoading);
 const id=p.lastId();p.reply(id,{class:p.klass,participants:[]});await new Promise(setImmediate);
 assert.equal(p.render().roster.class.schedule_id,1);p.render().closeRoster();
 p.send({event:'ready',date:p.klass.date,classes:[p.klass],total:1});
 assert.equal(p.render().rosterOpen,false,'Background snapshots must not reopen the dismissed reminder');
});

test('class tab uses already-loaded data and returns to dashboard without any navigation request', () => {
  const p = hook(), requests = p.scripts.length;
  p.render().showClasses(); assert.equal(p.render().screen, 'classes'); assert.equal(p.scripts.length, requests);
  p.render().showDashboard(); assert.equal(p.render().screen, 'web'); assert.equal(p.scripts.length, requests);
});

test('class sharing uses company search, sends only the selected occurrence, and does not clear admin on sharing denial',async()=>{
 const p=hook(),search=p.render().searchShareClients('Al');
 assert.ok(p.scripts.at(-1).includes('/class-invitations/recipients'));
 p.reply(p.lastId(),{clients:[{id:2,name:'Alice'}]});assert.equal((await search)[0].name,'Alice');
 const send=p.render().sendClassInvitation(p.klass,2,'11111111-1111-4111-8111-111111111111');
 assert.ok(p.scripts.at(-1).includes('"recipient_id":"2"'));assert.ok(p.scripts.at(-1).includes('"schedule_id":"1"'));
 p.reply(p.lastId(),{},403);await assert.rejects(send,/access_denied/);assert.ok(p.render().context);
});

test('invitation rejection retains the server class-started reason',async()=>{
 const p=hook(),send=p.render().sendClassInvitation(p.klass,2,'11111111-1111-4111-8111-111111111111');
 p.reply(p.lastId(),{reason:'class_started'},409);
 await assert.rejects(send,error=>error.reason==='class_started');assert.ok(p.render().context);
});
test('attendance patches one member in place with stable IDs, without reloading the page', async () => {
  const p = hook(), load = p.render().loadRoster(1, p.klass.date);
  const rows = [{ booking_id: 2, member_name: 'Test One', status: 'pending' }, { booking_id: 3, member_name: 'Test Two', status: 'pending' }];
  p.reply(p.lastId(), { class: p.klass, participants: rows }); await load;
  const second = p.render().roster.participants[1];
  const update = p.render().mutate('attendance', { booking_id: 2, status: 'attended' });
  const duplicate = p.render().mutate('attendance', { booking_id: 2, status: 'missed' });
  const requestId = p.lastId(); await duplicate;
  p.reply(requestId, { class: p.klass, participant: { ...rows[0], status: 'attended' } }); await update;
  assert.equal(p.render().roster.participants[0].status, 'attended');
  assert.equal(p.render().roster.participants[1], second);
  assert.ok(p.render().rosterOpen); assert.ok(!p.scripts.some(script => /location\.(?:assign|reload|replace)/.test(script)));
});
test('adding a member preserves calendar and share actions while updating the class card', async () => {
  const p = hook();
  const links = {calendarUrl:'https://calendar.google.com/calendar/render?action=TEMPLATE',
    calendarEvent:{title:'Muay Thai'},shareUrl:base+'dashboard-gym-client/index?date='+p.klass.date+'&schedule_id=1&company_code=ftx'};
  p.send({event:'ready',date:p.klass.date,classes:[{...p.klass,...links}],total:1});
  const load=p.render().loadRoster(1,p.klass.date);
  p.reply(p.lastId(),{class:p.klass,participants:[]});await load;
  const add=p.render().mutate('add',{member_guid:'member-one'});
  p.reply(p.lastId(),{class:{...p.klass,stats:{registered:2}},participants:[]});await add;
  const card=p.render().context.classes[0];
  assert.equal(card.stats.registered,2);
  for(const key of Object.keys(links))assert.equal(JSON.stringify(card[key]),JSON.stringify(links[key]),key);
  const remove=p.render().mutate('remove',{booking_id:2});
  p.reply(p.lastId(),{class:{...p.klass,shareUrl:null,calendarEvent:null,calendarUrl:null},participants:[]});await remove;
  assert.equal(p.render().context.classes[0].shareUrl,null,'explicitly removed actions stay removed');
  assert.equal(p.render().context.classes[0].calendarEvent,null);
});

test('read-only rosters cannot submit mutations and stale roster replies cannot reopen a closed modal', async () => {
  const p = hook(), load = p.render().loadRoster(1, p.klass.date);
  p.reply(p.lastId(), { class: { ...p.klass, can_manage: false }, participants: [] }); await load;
  const before = p.scripts.length; await p.render().mutate('remove', { booking_id: 2 }); assert.equal(p.scripts.length, before);
  const pending = p.render().loadRoster(1, p.klass.date), id = p.lastId();
  p.render().closeRoster(); p.reply(id, { class: p.klass, participants: [] }); await pending;
  assert.equal(p.render().roster, null); assert.equal(p.render().rosterOpen, false);
});
test('logout clears in-memory admin data, cancels outstanding requests and rejects late replies', async () => {
  const p = hook(), pending = p.render().loadRoster(1, p.klass.date), id = p.lastId();
  p.render().onNavigation(base + 'login'); await pending;
  p.reply(id, { class: p.klass, participants: [{ booking_id: 2 }] });
  assert.equal(p.render().context, null); assert.equal(p.render().roster, null); assert.equal(p.timers.size, 0);
});
test('a forbidden admin response clears native caches and returns control to the website', async () => {
  const p = hook(), pending = p.render().loadRoster(1, p.klass.date);
  p.reply(p.lastId(), {}, 403); await pending;
  assert.equal(p.render().context, null); assert.equal(p.render().rosterOpen, false);
});
test('Portuguese and English provide matching native admin labels', () => {
  assert.deepEqual(Object.keys(core.adminTranslations('pt')), Object.keys(core.adminTranslations('en')));
});
