const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const babel = require('@babel/core');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/utils/webViewScroll.js'), 'utf8');
const { code } = babel.transformSync(source, { babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'] });
const exportsObject = {};
vm.runInNewContext(code, { exports: exportsObject });
function page(loading = false) {
  const listeners = {};
  const observed = [];
  const nodes = [];
  let dialog = false;
  let dialogVisible = true;
  function element() {
    const classes = new Set();
    return { classList: { contains: c => classes.has(c), add: c => classes.add(c), remove: c => classes.delete(c) }, appendChild: n => nodes.push(n) };
  }
  const document = { documentElement: element(), head: element(), body: loading ? null : element(), readyState: loading ? 'loading' : 'complete',
    createElement: () => ({}), querySelectorAll: () => dialog ? [{classList:{contains:()=>false},getClientRects:()=>dialogVisible?[{}]:[]}] : [],
    addEventListener: (event, fn) => { listeners[event] = fn; } };
  const window = { innerWidth:390, getComputedStyle:()=>({display:dialogVisible?'block':'none',visibility:'visible'}), addEventListener() {}, MutationObserver: function(callback) { this.observe = (node, options) => observed.push({ node, options, callback }); } };
  const context = vm.createContext({ document, window, MutationObserver: window.MutationObserver });
  return { document, window, nodes, observed, listeners, element, setDialog: v => { dialog = v; }, hideDialog:()=>{dialogVisible=false;},
    run: () => vm.runInContext(exportsObject.WEBVIEW_SCROLL_SCRIPT, context),
    sync: () => observed[0].callback(), enabled: () => document.documentElement.classList.contains('ftx-native-page-scroll') };
}
test('page scroll recovery installs once across both WebView injection phases', () => {
  const p = page(); p.run(); p.run();
  assert.equal(p.nodes.length, 1); assert.equal(p.observed.length, 2); assert.ok(p.enabled());
  assert.match(p.nodes[0].textContent, /overflow-y: auto !important/);
  assert.match(p.nodes[0].textContent, /height: auto !important/);
  assert.equal(p.observed[0].options.subtree, undefined);
});
test('early injection waits for the body before enabling scroll', () => {
  const p = page(true); p.run(); assert.equal(p.observed.length, 0);
  p.document.body = p.element(); p.listeners.DOMContentLoaded();
  assert.ok(p.enabled()); assert.equal(p.observed.length, 2);
});
test('open modals preserve their scroll lock and closing restores page scroll', () => {
  const p = page(); p.run(); p.setDialog(true); p.document.body.classList.add('modal-open'); p.sync(); assert.ok(!p.enabled());
  p.setDialog(false); p.document.body.classList.remove('modal-open'); p.sync(); assert.ok(p.enabled());
  p.setDialog(true); p.listeners['shown.bs.offcanvas'](); assert.ok(!p.enabled());
  p.setDialog(false); p.listeners['hidden.bs.offcanvas'](); assert.ok(p.enabled());
});
test('stale sidebar and overflow classes do not lock the document without a visible overlay', () => {
  const p = page(); p.run(); p.document.body.classList.add('sidebar-enable'); p.sync(); assert.ok(p.enabled());
  p.document.body.classList.remove('sidebar-enable'); p.document.documentElement.classList.add('overflow-hidden'); p.sync(); assert.ok(p.enabled());
  p.document.documentElement.classList.remove('overflow-hidden'); p.sync(); assert.ok(p.enabled());
});
test('injection before the HTML element exists can retry after document creation',()=>{
  const p=page(); const html=p.document.documentElement; p.document.documentElement=null;
  p.run(); assert.equal(p.window.__ftxScrollInstalled,undefined);
  p.document.documentElement=html; p.run(); assert.ok(p.enabled()); assert.equal(p.nodes.length,1);
});
test('a hidden modal with a stale show class cannot block page scrolling',()=>{
  const p=page();p.setDialog(true);p.hideDialog();p.run();assert.ok(p.enabled());
});
test('native WebView allows scrolling and never cancels ordinary touch events globally', () => {
  const screen = fs.readFileSync(path.join(root, 'src/screens/WebViewScreen.js'), 'utf8');
  assert.match(screen, /scrollEnabled=\{true\}/); assert.match(screen, /nestedScrollEnabled=\{true\}/);
  assert.match(screen, /if \(window\.__ftxNativeFeelInstalled\) return true/);
  assert.ok(!/addEventListener\('touch(?:start|move|end)'/.test(screen));
  assert.equal((screen.match(/NATIVE_FEEL_SCRIPT \+ WEBVIEW_SCROLL_SCRIPT/g) || []).length, 2);
});
