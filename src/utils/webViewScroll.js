// Keep the page as the scroll container without overriding an open modal/menu.
export const WEBVIEW_SCROLL_SCRIPT = `
(function () {
  if (window.__ftxScrollInstalled) return true;
  var root = document.documentElement;
  if (!root) return true;
  window.__ftxScrollInstalled = true;
  var marker = 'ftx-native-page-scroll';
  var style = document.createElement('style');
  style.id = '__ftx_page_scroll';
  style.textContent = [
    'html.' + marker + ' {',
    '  height: auto !important;',
    '  min-height: 100%;',
    '  overflow-y: auto !important;',
    '  overflow-x: hidden !important;',
    '  touch-action: manipulation !important;',
    '  -webkit-overflow-scrolling: touch;',
    '}',
    'html.' + marker + ' body {',
    '  position: relative !important;',
    '  height: auto !important;',
    '  max-height: none !important;',
    '  overflow: visible !important;',
    '  touch-action: manipulation !important;',
    '}',
    'html.' + marker + ' body > .body,',
    'html.' + marker + ' #layout-wrapper,',
    'html.' + marker + ' .main-content {',
    '  height: auto !important;',
    '  max-height: none !important;',
    '  overflow: visible !important;',
    '}'
  ].join('\\n');
  (document.head || root).appendChild(style);

  function syncScroll() {
    var body = document.body;
    if (!body) return;
    var candidates = document.querySelectorAll('.modal.show, .modal.showing, .offcanvas.show, .offcanvas.showing, .mfp-wrap, .right-bar, .vertical-menu');
    var locked = false;
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      if (el.classList.contains('right-bar') && !body.classList.contains('right-bar-enabled')) continue;
      if (el.classList.contains('vertical-menu') && (!body.classList.contains('sidebar-enable') || window.innerWidth >= 992)) continue;
      var css = window.getComputedStyle(el);
      if (css.display !== 'none' && css.visibility !== 'hidden' && el.getClientRects().length > 0) {
        locked = true;
        break;
      }
    }
    if (root.classList.contains(marker) === !locked) return;
    if (locked) root.classList.remove(marker);
    else root.classList.add(marker);
  }

  var observer;
  function ready() {
    syncScroll();
    if (!observer && document.body && window.MutationObserver) {
      observer = new MutationObserver(syncScroll);
      // Attribute-only observation: never watch the entire page subtree.
      observer.observe(root, { attributes: true, attributeFilter: ['class', 'style'] });
      observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
    }
  }
  ready();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true });
  window.addEventListener('load', ready, { once: true });
  document.addEventListener('shown.bs.modal', syncScroll);
  document.addEventListener('hidden.bs.modal', syncScroll);
  document.addEventListener('shown.bs.offcanvas', syncScroll);
  document.addEventListener('hidden.bs.offcanvas', syncScroll);
  return true;
})(); true;
`;
