// Keep the page as the scroll container without overriding an open modal/menu.
export const WEBVIEW_SCROLL_SCRIPT = `
(function () {
  if (window.__ftxScrollInstalled) return true;
  window.__ftxScrollInstalled = true;
  var root = document.documentElement;
  if (!root) return true;
  var marker = 'ftx-native-page-scroll';
  var style = document.createElement('style');
  style.id = '__ftx_page_scroll';
  style.textContent = [
    'html.' + marker + ', html.' + marker + ' body {',
    '  height: auto !important;',
    '  min-height: 100%;',
    '  overflow-y: auto !important;',
    '  touch-action: manipulation !important;',
    '  -webkit-overflow-scrolling: touch;',
    '}'
  ].join('\\n');
  (document.head || root).appendChild(style);

  function syncScroll() {
    var body = document.body;
    if (!body) return;
    var locked = body.classList.contains('modal-open') ||
      body.classList.contains('offcanvas-open') ||
      body.classList.contains('right-bar-enabled') ||
      body.classList.contains('sidebar-enable') ||
      root.classList.contains('mfp-ready') || root.classList.contains('overflow-hidden') ||
      !!document.querySelector('.modal.show, .modal.showing, .offcanvas.show, .offcanvas.showing, .mfp-wrap');
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
