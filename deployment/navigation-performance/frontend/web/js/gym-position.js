// Shared mobile/web check-in position preservation. No form values are stored.
(function(origin) {
  if (location.origin !== origin || window.__scPositionInstalled) return;
  window.__scPositionInstalled = true;
  const key = 'sc-scroll:' + location.pathname + location.search;
  let cancelled = false, saved;
  try { saved = JSON.parse(sessionStorage.getItem(key)); } catch {}
  try { sessionStorage.removeItem(key); } catch {}
  function cancel() { cancelled = true; try { sessionStorage.removeItem(key); } catch {} }
  window.addEventListener('touchstart', cancel, { passive: true });
  window.addEventListener('wheel', cancel, { passive: true });
  function remember(form, explicitAction) {
    try {
      const action = new URL(explicitAction || form.action || location.href, location.href);
      if (action.origin !== origin || !/^\/(?:dashboard-gym(?:-client)?|dashboard-team|timesheet|gym-checkin|gym-attendance)(?:\/|$)/.test(location.pathname)
        || !/\/(?:check-?in|check-?out|clock-in|clock-out)(?:\/|$)/.test(action.pathname)) return;
      const containers=[];
      for(let node=form.parentElement;node&&node!==document.body;node=node.parentElement){
        if(node.id&&node.scrollHeight>node.clientHeight&&node.scrollTop>0)containers.push({id:node.id,y:node.scrollTop});
      }
      const position={ y: Math.max(0, window.scrollY || document.scrollingElement?.scrollTop || 0), at: Date.now() };
      if(containers.length)position.containers=containers.slice(0,5);
      sessionStorage.setItem(key, JSON.stringify(position));
    } catch {}
  }
  document.addEventListener('submit', event => remember(event.target,event.submitter?.hasAttribute('formaction')?event.submitter.formAction:undefined), true);
  // Yii data-method links can submit a generated form without a DOM submit event.
  document.addEventListener('click', event => {
    const link=event.target.closest?.('a[data-method="post"]');
    if(link)remember(link,link.href);
  }, true);
  if (!saved || !Number.isFinite(saved.y) || saved.y < 0 || !Number.isFinite(saved.at)
    || Date.now() - saved.at > 45000 || Date.now() < saved.at) return;
  let attempts = 0;
  function restore() {
    if (cancelled) return;
    attempts++;
    window.scrollTo(0, saved.y);
    for(const item of (Array.isArray(saved.containers)?saved.containers:[]).slice(0,5)){
      if(typeof item.id==='string'&&Number.isFinite(item.y)&&item.y>=0){const node=document.getElementById(item.id);if(node)node.scrollTop=item.y;}
    }
    // Fonts, images and AJAX panels can move content after the first layout.
    if (attempts < 20) setTimeout(restore, 150);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', restore, { once: true });
  else window.requestAnimationFrame(restore);
})(location.origin);true;
