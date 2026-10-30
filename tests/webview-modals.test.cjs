const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const babel = require('@babel/core');
const source = fs.readFileSync(path.join(__dirname, '../src/utils/webViewModals.js'), 'utf8');
const { code } = babel.transformSync(source, { babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'] });
const exported = {};
vm.runInNewContext(code, { exports: exported });

function fixture({ blocked = true, modalZ = '1055', backdropZ = '1050', bodyReady = true } = {}) {
  const listeners = {};
  const jqueryListeners = {};
  const frames = [];
  const observations = [];
  function element() {
    const classes = new Set();
    const styles = new Map();
    return {
      children: [], parentNode: null,
      classList: { contains: c => classes.has(c), add: c => classes.add(c), remove: c => classes.delete(c) },
      style: {
        getPropertyValue: key => styles.get(key)?.value || '',
        getPropertyPriority: key => styles.get(key)?.priority || '',
        setProperty: (key, value, priority = '') => styles.set(key, { value, priority }),
        removeProperty: key => styles.delete(key),
      },
      appendChild(node) {
        if (node.parentNode) node.parentNode.children.splice(node.parentNode.children.indexOf(node), 1);
        this.children.push(node); node.parentNode = this;
      },
      insertBefore(node, before) { this.children.splice(this.children.indexOf(before), 0, node); node.parentNode = this; },
      replaceChild(node, old) {
        if (node.parentNode) node.parentNode.children.splice(node.parentNode.children.indexOf(node), 1);
        this.children.splice(this.children.indexOf(old), 1, node); node.parentNode = this; old.parentNode = null;
      },
    };
  }
  const body = element(), wrapper = element(), modal = element(), content = element(), backdrop = element();
  const sibling = element();
  body.appendChild(wrapper); wrapper.appendChild(modal); wrapper.appendChild(sibling); body.appendChild(backdrop);
  modal.classList.add('show');
  modal.querySelector = () => content;
  let rect = { left: 0, right: 390, top: 0, bottom: 750 };
  content.getBoundingClientRect = () => rect;
  backdrop.closest = selector => selector === '.modal-backdrop' ? backdrop : null;
  content.closest = () => null;
  const document = {
    body: bodyReady ? body : null,
    querySelectorAll: () => modal.classList.contains('show') ? [modal] : [],
    createComment: element,
    elementFromPoint: () => blocked ? backdrop : content,
    addEventListener: (name, fn) => { listeners[name] = fn; },
  };
  const window = {
    innerWidth: 390, innerHeight: 844,
    requestAnimationFrame: fn => frames.push(fn),
    getComputedStyle: node => ({ zIndex: node.style.getPropertyValue('z-index') || (node === modal ? modalZ : backdropZ) }),
    addEventListener: (name, fn) => { listeners[name] = fn; },
    MutationObserver: function (callback) { this.observe = (target, options) => observations.push({ callback, target, options }); },
  };
  const context = vm.createContext({ window, document, MutationObserver: window.MutationObserver });
  function jquery() {
    return { on(name, fn) { jqueryListeners[name] = fn; return this; } };
  }
  return { body, wrapper, modal, sibling, document, window, observations, frames,
    run: () => vm.runInContext(exported.WEBVIEW_MODAL_SCRIPT, context),
    flush: () => { while (frames.length) frames.shift()(); },
    emit: (name, target = modal) => listeners[name]({ target }),
    emitJQuery: name => jqueryListeners[name]({ target: modal }),
    loadJQuery: () => { window.jQuery = jquery; listeners.load(); },
    setBlocked: value => { blocked = value; }, setRect: value => { rect = value; },
  };
}

test('a backdrop covering a nested class dialog is repaired without removing its backdrop', () => {
  const p = fixture(); p.run(); p.flush();
  assert.equal(p.modal.parentNode, p.body);
  assert.equal(p.body.children.length, 3); // wrapper, original backdrop, dialog
  assert.equal(p.modal.style.getPropertyValue('z-index'), ''); // existing Bootstrap order suffices
});

test('working dialogs are left in their original DOM and retain their styles', () => {
  const p = fixture({ blocked: false }); p.modal.style.setProperty('z-index', '1200'); p.run(); p.flush();
  assert.equal(p.modal.parentNode, p.wrapper);
  assert.equal(p.modal.style.getPropertyValue('z-index'), '1200');
});

test('closing restores DOM order and original inline z-index before the next opening', () => {
  const p = fixture({ backdropZ: '2000' });
  p.modal.style.setProperty('z-index', '1050', 'important'); p.run(); p.flush();
  assert.equal(p.modal.style.getPropertyValue('z-index'), '2001');
  p.modal.classList.remove('show'); p.emit('hidden.bs.modal'); p.flush();
  assert.equal(p.modal.parentNode, p.wrapper);
  assert.deepEqual(p.wrapper.children, [p.modal, p.sibling]);
  assert.equal(p.modal.style.getPropertyValue('z-index'), '1050');
  assert.equal(p.modal.style.getPropertyPriority('z-index'), 'important');
  p.modal.classList.add('show'); p.emit('shown.bs.modal'); p.flush();
  assert.equal(p.modal.parentNode, p.body);
});

test('Bootstrap 4 jQuery events work when jQuery loads after early injection', () => {
  const p = fixture({ blocked: false }); p.run(); p.flush(); p.loadJQuery();
  p.setBlocked(true); p.emitJQuery('shown.bs.modal'); p.flush();
  assert.equal(p.modal.parentNode, p.body);
  p.modal.classList.remove('show'); p.emitJQuery('hidden.bs.modal'); p.flush();
  assert.equal(p.modal.parentNode, p.wrapper);
});

test('both injection phases install only one shallow observer and coalesce body updates', () => {
  const p = fixture(); p.run(); p.run();
  assert.equal(p.observations.length, 1);
  assert.equal(p.observations[0].target, p.body);
  assert.equal(p.observations[0].options.subtree, undefined);
  for (let i = 0; i < 20; i++) p.observations[0].callback();
  assert.equal(p.frames.length, 1); p.flush();
});

test('an early injection without a body can retry at the later injection phase', () => {
  const p = fixture({ bodyReady: false }); p.run();
  assert.equal(p.window.__ftxModalInstalled, undefined);
  p.document.body = p.body; p.run(); p.flush();
  assert.equal(p.modal.parentNode, p.body);
});

test('offscreen dialogs are never hit-tested or moved', () => {
  const p = fixture(); p.setRect({ left: 0, right: 390, top: 900, bottom: 1100 }); p.run(); p.flush();
  assert.equal(p.modal.parentNode, p.wrapper);
});
