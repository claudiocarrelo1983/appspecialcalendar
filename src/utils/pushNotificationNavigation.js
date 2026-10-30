// Keep notification navigation on the installed company's origin. Never follow
// a redirect or payload into another company's authenticated session.
export function notificationTarget(data, startUrl) {
  if (!data || typeof data.url !== 'string' || data.url.length > 4096) return null;
  try {
    const base = new URL(startUrl), target = new URL(data.url, base);
    if (!['https:', 'http:'].includes(target.protocol) || target.origin !== base.origin || target.username || target.password) return null;
    return target.href;
  } catch { return null; }
}

export function pushRecovery(event, pending, startUrl, now = Date.now()) {
  if (!pending || event?.statusCode !== 404 || now - pending.at > 30000) return null;
  const failed = notificationTarget({url:event.url}, startUrl);
  if (!failed) return null;
  // Only recover a navigation initiated by the current push tap. An unrelated
  // page failure must keep its normal error behavior.
  const path = new URL(failed).pathname;
  const original = new URL(pending.url).pathname;
  if (path !== original && !/^\/dashboard-gym(?:-client)?(?:\/index)?\/?$/.test(path)) return null;
  const fallback = new URL('/dashboard-gym', startUrl);
  fallback.searchParams.set('_push_open', pending.id);
  return {url:fallback.href, title:pending.title, body:pending.body};
}
