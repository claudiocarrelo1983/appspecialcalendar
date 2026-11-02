(function () {
  if (window.__scLoginWarningInstalled) return;
  window.__scLoginWarningInstalled = true;
  let seen = '', busy = false, loggingOut = false, activeWarning = null, popup = null;
  async function post(action, token) {
    const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
    if (!csrf) throw new Error('Missing CSRF token');
    const response = await fetch('/account-login-warning/' + action, {method:'POST',credentials:'same-origin',
      headers:{'Content-Type':'application/x-www-form-urlencoded','X-CSRF-Token':csrf},
      body:new URLSearchParams({token}).toString()});
    if (!response.ok || (await response.json()).success !== true) throw new Error('Request failed');
  }
  async function acknowledge(token) { await post('acknowledge', token); }
  async function logout(token) {
    if (loggingOut || activeWarning?.token !== token) return;
    loggingOut = true;
    try {
      await post('logout', token);
      location.replace('/login');
    } catch (error) {
      window.alert(activeWarning.logoutError || 'Could not log out. Try again or use the account menu.');
    } finally { loggingOut = false; }
  }
  function showWarning(warning) {
    if (popup) popup.remove();
    const dialog = document.createElement('dialog');popup = dialog;
    dialog.setAttribute('aria-label', warning.title);
    dialog.style.cssText = 'border:0;border-radius:12px;padding:24px;max-width:420px;width:calc(100% - 48px);box-sizing:border-box;box-shadow:0 8px 40px #0005;color:#222;background:#fff;';
    const title = document.createElement('h2'), message = document.createElement('p'), actions = document.createElement('div');
    title.textContent = warning.title;title.style.cssText = 'font-size:20px;margin:0 0 16px;';
    message.textContent = warning.message;message.style.cssText = 'font-size:16px;line-height:1.5;';
    actions.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;justify-content:flex-end;';
    const keep = document.createElement('button'), leave = document.createElement('button');
    keep.type = leave.type = 'button';
    keep.textContent = warning.continueLabel || 'Continue';leave.textContent = warning.logoutLabel || 'Log out this device';
    for (const button of [keep, leave]) button.style.cssText = 'padding:10px 14px;border:1px solid #ccc;border-radius:6px;background:#fff;font:inherit;cursor:pointer;';
    leave.style.color = '#b42318';
    const dismiss = () => { dialog.remove();if (popup === dialog) popup = null;acknowledge(warning.token).catch(() => {}); };
    keep.onclick = dismiss;
    dialog.addEventListener('cancel', event => {event.preventDefault();dismiss();});
    leave.onclick = () => logout(warning.token);
    actions.append(keep, leave);dialog.append(title, message, actions);document.body.append(dialog);
    dialog.showModal();keep.focus();
  }
  async function check() {
    if (busy || document.hidden) return;
    busy = true;
    try {
      const response = await fetch('/account-login-warning/status', {credentials:'same-origin',cache:'no-store',headers:{'X-Requested-With':'XMLHttpRequest'}});
      if (!response.ok) return;
      const result = await response.json(), warning = result.data?.warning;
      if (!warning || warning.token === seen) return;
      seen = warning.token;activeWarning = warning;
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'sc.account.login-warning',documentUrl:location.href,...warning}));
      } else {
        showWarning(warning);
      }
    } catch (error) { /* Keep login and the current screen usable when offline. */ }
    finally { busy = false; }
  }
  window.__scAcknowledgeLoginWarning = acknowledge;
  window.__scLogoutLoginWarning = logout;
  check();
  let interval = setInterval(check, 30000);
  document.addEventListener('visibilitychange', check);
  window.addEventListener('pageshow', () => { clearInterval(interval);interval=setInterval(check,30000);check(); });
  window.addEventListener('pagehide', () => clearInterval(interval));
})();
