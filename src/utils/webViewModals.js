// WKWebView can put a nested Bootstrap modal below its body-level backdrop.
// Repair only an actually blocked dialog; preserve Bootstrap's dismissal/scroll lock.
export const WEBVIEW_MODAL_SCRIPT = `
(function () {
  if (window.__ftxModalInstalled) return true;
  if (!document.body) return true;
  window.__ftxModalInstalled = true;
  var repairs = new Map();
  var pending = false;
  var jqueryBound = false;

  function restore(modal) {
    var repair = repairs.get(modal);
    if (!repair) return;
    if (repair.placeholder.parentNode) {
      repair.placeholder.parentNode.replaceChild(modal, repair.placeholder);
    }
    if (repair.zIndex) modal.style.setProperty('z-index', repair.zIndex, repair.priority);
    else modal.style.removeProperty('z-index');
    repairs.delete(modal);
  }

  function check() {
    pending = false;
    repairs.forEach(function (_, modal) {
      if (!modal.classList.contains('show')) restore(modal);
    });
    var modals = document.querySelectorAll('.modal.show');
    for (var i = 0; i < modals.length; i++) {
      var modal = modals[i];
      var content = modal.querySelector('.modal-content');
      if (!content) continue;
      var rect = content.getBoundingClientRect();
      var left = Math.max(0, rect.left);
      var right = Math.min(window.innerWidth, rect.right);
      var top = Math.max(0, rect.top);
      var bottom = Math.min(window.innerHeight, rect.bottom);
      if (right <= left || bottom <= top) continue;
      var hit = document.elementFromPoint((left + right) / 2, top + Math.min(24, (bottom - top) / 2));
      if (!hit || !hit.closest('.modal-backdrop')) continue;

      if (!repairs.has(modal)) {
        var placeholder = document.createComment('ftx-modal-position');
        modal.parentNode.insertBefore(placeholder, modal);
        repairs.set(modal, {
          placeholder: placeholder,
          zIndex: modal.style.getPropertyValue('z-index'),
          priority: modal.style.getPropertyPriority('z-index')
        });
      }
      // A larger z-index alone cannot escape an ancestor's stacking context.
      if (modal.parentNode !== document.body) document.body.appendChild(modal);
      var backdropZ = parseInt(window.getComputedStyle(hit).zIndex, 10);
      var modalZ = parseInt(window.getComputedStyle(modal).zIndex, 10);
      if (isFinite(backdropZ) && (!isFinite(modalZ) || modalZ <= backdropZ)) {
        modal.style.setProperty('z-index', String(backdropZ + 1), 'important');
      }
    }
  }

  function schedule() {
    if (pending) return;
    pending = true;
    window.requestAnimationFrame(check);
  }

  function hidden(event) {
    restore(event.target);
    schedule();
  }

  function bindJQuery() {
    // Bootstrap 4 emits jQuery events; Bootstrap 5 also supports native events.
    if (jqueryBound || !window.jQuery) return;
    jqueryBound = true;
    window.jQuery(document).on('shown.bs.modal', schedule).on('hidden.bs.modal', hidden);
  }

  document.addEventListener('shown.bs.modal', schedule);
  document.addEventListener('hidden.bs.modal', hidden);
  document.addEventListener('DOMContentLoaded', bindJQuery, { once: true });
  window.addEventListener('load', bindJQuery, { once: true });
  bindJQuery();
  if (window.MutationObserver) {
    // Body-level backdrop insertion only; never observe the full page subtree.
    new MutationObserver(schedule).observe(document.body, {
      childList: true, attributes: true, attributeFilter: ['class']
    });
  }
  schedule();
  return true;
})(); true;
`;
