const CLASS_PATHS = new Set(['/dashboard-gym', '/dashboard-gym/index', '/dashboard-gym-client', '/dashboard-gym-client/index']);

// Only accept this branded app's HTTPS class links, never an arbitrary WebView destination.
export function classLinkTarget(value, siteUrl) {
  try {
    if (typeof value !== 'string' || value.length > 2048) return null;
    const url = new URL(value);
    const site = new URL(siteUrl);
    if (url.protocol !== 'https:' || url.origin !== site.origin || url.username || url.password
      || !CLASS_PATHS.has(url.pathname)) return null;
    const query = new URLSearchParams();
    for (const key of ['company_code', 'date', 'schedule_id']) {
      if (url.searchParams.getAll(key).length > 1) return null;
      if (url.searchParams.has(key)) query.set(key, url.searchParams.get(key));
    }
    if (query.has('company_code') && !/^[a-zA-Z0-9_-]{1,255}$/.test(query.get('company_code'))) return null;
    if (query.has('date') !== query.has('schedule_id')) return null;
    if (query.has('date')) {
      const date = query.get('date');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date) return null;
      const id = query.get('schedule_id');
      if (!/^[1-9]\d{0,9}$/.test(id) || Number(id) > 2147483647) return null;
    }
    const encoded = query.toString();
    return site.origin + url.pathname + (encoded ? '?' + encoded : '');
  } catch (error) {
    return null;
  }
}
