import * as WebBrowser from 'expo-web-browser';

export const FITNESS_OAUTH_BRIDGE_SCRIPT = 'window.__specialCalendarFitnessOAuthBridge = true; true;\n';

export function fitnessOAuthAllowed(value, siteUrl) {
  try {
    const url = new URL(value), site = new URL(siteUrl);
    return url.origin === site.origin && !url.username && !url.password
      && /^\/fitness-integrations(?:\/index)?\/?$/.test(url.pathname);
  } catch { return false; }
}

export function fitnessOAuthReplyScript(value) {
  const json = JSON.stringify(value).replace(/</g, '\u003c').replace(/\u2028/g, '\u2028').replace(/\u2029/g, '\u2029');
  return `window.dispatchEvent(new CustomEvent('sc.fitness.oauth.result',{detail:${json}}));true;`;
}

export function createFitnessOAuthHandler(siteUrl, returnUrl) {
  let busy = false;
  return async function (message, documentUrl, reply) {
    if (message?.type !== 'sc.fitness.oauth') return false;
    if (!fitnessOAuthAllowed(documentUrl, siteUrl)) return true;
    if (message.version !== 1 || typeof message.requestId !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(message.requestId)) return true;
    const send = value => reply({requestId: message.requestId, ...value});
    if (busy) { send({error: 'busy'}); return true; }
    try {
      if (typeof message.url !== 'string' || message.url.length > 4096 || message.returnUrl !== returnUrl
          || !/^specialcalendar-c[0-9]{1,40}:\/\/fitness-oauth\/callback$/.test(returnUrl)) throw new Error('request');
      const url = new URL(message.url), redirect = new URL(url.searchParams.get('redirect_uri'));
      const keys = ['client_id','redirect_uri','response_type','approval_prompt','scope','state'];
      if (url.origin !== 'https://www.strava.com' || url.pathname !== '/oauth/mobile/authorize'
          || url.username || url.password || url.hash || keys.some(key => url.searchParams.getAll(key).length !== 1)
          || !/^\d+$/.test(url.searchParams.get('client_id')) || url.searchParams.get('response_type') !== 'code'
          || url.searchParams.get('scope') !== 'read,activity:read' || !/^[a-f0-9]{64}$/.test(url.searchParams.get('state'))
          || redirect.protocol !== 'https:' || redirect.username || redirect.password || redirect.port || redirect.hash || redirect.search
          || !/^(?:c[0-9]+\.)?specialcalendar\.(?:com|pt|co\.uk)$/.test(redirect.hostname)
          || redirect.pathname !== '/fitness-oauth/callback') throw new Error('request');
      busy = true;
      const result = await WebBrowser.openAuthSessionAsync(url.toString(), returnUrl);
      if (result.type !== 'success') { send({error:'cancelled'}); return true; }
      const callback = new URL(result.url), expected = new URL(returnUrl);
      if (callback.protocol !== expected.protocol || callback.host !== expected.host || callback.pathname !== expected.pathname
          || callback.username || callback.password || callback.hash || callback.searchParams.getAll('state').length !== 1
          || callback.searchParams.get('state') !== url.searchParams.get('state')) throw new Error('request');
      send({data:{url:result.url}});
    } catch { send({error:'request'}); }
    finally { busy = false; }
    return true;
  };
}
