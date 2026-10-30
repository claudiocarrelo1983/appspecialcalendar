export const NATIVE_GYM_MESSAGE = 'sc.nativeGym.response';
export const WEB_ROUTES = {
  bookings: '/dashboard-gym-client', settings: '/client-settings',
  profile: '/profile', performance: '/performance-dashboard-client',
  packages: '/personal-classes/client-index', notifications: '/group-notifications',
};
export function nativeShellStyleScript(enabled,startUrl,color) {
  const primary=/^#[a-f0-9]{6}$/i.test(color||'')?color:'#0d6efd';
  const css=[
    'html.sc-native-shell,html.sc-native-shell body{background:#fff!important}',
    '.sc-native-shell #page-topbar,.sc-native-shell .vertical-menu,.sc-native-shell .mobile-bottom-nav,.sc-native-shell .footer,.sc-native-shell .footer-space,.sc-native-shell .footer-space-mobile{display:none!important}',
    '.sc-native-shell .main-content{margin-left:0!important;margin-top:0!important}',
    '.sc-native-shell .main-content>.page-content{padding-top:0!important;margin-top:0!important;min-height:0!important}',
    '.sc-native-shell .gym-menu-content{padding:16px 16px 24px!important}',
    '.sc-native-shell .gym-client-portal{padding-bottom:0!important}',
    '.sc-native-shell{--sc-primary:'+primary+';--sc-primary-rgb:'+ [1,3,5].map(i=>parseInt(primary.slice(i,i+2),16)).join(',')+'}',
  ].join('');
  return '(function(c){if(location.origin!==c.origin)return;function apply(){var root=document.documentElement;if(!root)return;root.classList.toggle("sc-native-shell",c.enabled);var style=document.getElementById("sc-native-shell-style");if(!style){style=document.createElement("style");style.id="sc-native-shell-style";(document.head||root).appendChild(style);}style.textContent=c.css;}apply();document.addEventListener("DOMContentLoaded",apply,{once:true});})('
    +JSON.stringify({enabled,origin:new URL(startUrl).origin,css})+');true;';
}
const API_ROUTES = {
  context: '/native-gym', sessions: '/native-gym/sessions',
  checkin: '/native-gym/checkin', checkout: '/native-gym/checkout',
  logout: '/native-gym/logout',
  language: '/native-gym/language',
  birthdays: '/native-gym/birthdays',
  notifications:'/native-gym/notifications', 'notification-read':'/native-gym/notification-read',
};

export function isClientDashboard(url, startUrl) {
  return sameGymOrigin(url,startUrl) && /^\/dashboard-gym-client(?:\/index)?\/?$/.test(new URL(url).pathname);
}

export function sameGymOrigin(url, startUrl) {
  try {
    const target = new URL(url), base = new URL(startUrl);
    return target.origin === base.origin && ['http:', 'https:'].includes(base.protocol)
      && !target.username && !target.password;
  } catch { return false; }
}

/** Execute same-origin requests in the existing authenticated cookie jar.
 * Native views receive DTOs; credentials and CSRF tokens never cross the bridge. */
export function gymRequestScript(id, action, params, startUrl) {
  if (!API_ROUTES[action]) throw new Error('Unsupported native gym action');
  const body = {};
  for (const key of ['id', 'from', 'to', 'page', 'checked', 'language']) {
    if (params?.[key] !== undefined) body[key] = String(params[key]);
  }
  const config = JSON.stringify({id, path: API_ROUTES[action], legacyPath: API_ROUTES[action].replace('/native-gym','/api/v1/native-gym'), body,
    post: ['checkin', 'checkout', 'logout','notification-read','language'].includes(action), origin: new URL(startUrl).origin});
  return '(function(c){if(location.origin!==c.origin||!window.ReactNativeWebView)return;'
    + 'var controller=new AbortController();var timeout=setTimeout(function(){controller.abort();},12000);'
    + 'async function run(){var options={credentials:"same-origin",cache:"no-store",signal:controller.signal,headers:{Accept:"application/json"}};'
    + 'async function endpoint(primary,legacy,settings){var response=await fetch(primary,settings);if(response.status===404)response=await fetch(legacy,settings);return response;}'
    + 'var url=c.path;if(c.post){var csrfResponse=await endpoint("/native-gym/csrf","/api/v1/csrf",options);'
    + 'if(!csrfResponse.ok&&csrfResponse.status!==200)return {status:csrfResponse.status,result:{success:false}};var csrf=await csrfResponse.json();'
    + 'if(!csrf.success||!csrf.data.token)throw Error("csrf");options={...options,method:"POST",'
    + 'headers:{...options.headers,"X-CSRF-Token":csrf.data.token,"Content-Type":"application/x-www-form-urlencoded"},'
    + 'body:new URLSearchParams(c.body).toString()};}else if(Object.keys(c.body).length){url+="?"+new URLSearchParams(c.body).toString();}'
    + 'var legacy=c.legacyPath;if(!c.post&&Object.keys(c.body).length)legacy+="?"+new URLSearchParams(c.body).toString();'
    + 'var r=await endpoint(url,legacy,options);var result;try{result=await r.json();}catch(e){return {status:r.status,result:{success:false},reason:"invalid_response"};}return {status:r.status,result:result};}'
    + 'run().then(function(reply){window.ReactNativeWebView.postMessage(JSON.stringify({type:"'
    + NATIVE_GYM_MESSAGE + '",id:c.id,...reply}));}).catch(function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:"'
    + NATIVE_GYM_MESSAGE + '",id:c.id,status:0}));}).finally(function(){clearTimeout(timeout);});'
    + '})(' + config + ');true;';
}

export function timerElapsed(timer, now = Date.now()) {
  return Math.max(0, Math.min(86400, Number(timer.elapsed || 0)
    + (timer.status === 'running' ? Math.max(0, now - timer.startedAt) / 1000 : 0)));
}
export function timerFrame(timer, now = Date.now()) {
  const elapsed = Math.floor(timerElapsed(timer, now));
  const planned = timer.mode === 'stopwatch' ? 86400
    : timer.work * timer.rounds + timer.rest * (timer.rounds - 1);
  let phase = 'work', remaining = Math.max(0, planned - elapsed), round = 1;
  if (timer.mode === 'interval' && elapsed < planned) {
    round = Math.min(timer.rounds, Math.floor(elapsed / (timer.work + timer.rest)) + 1);
    const cycle = elapsed % (timer.work + timer.rest);
    phase = cycle < timer.work ? 'work' : 'rest';
    remaining = phase === 'work' ? timer.work - cycle : timer.work + timer.rest - cycle;
  }
  return {elapsed, planned, phase, remaining, round,
    finished: elapsed >= planned, display: timer.mode === 'stopwatch' ? elapsed : remaining};
}
export function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const value = Math.max(0, Math.floor(seconds));
  return [Math.floor(value / 3600), Math.floor(value % 3600 / 60), value % 60]
    .map(n => String(n).padStart(2, '0')).join(':');
}
export function validSnapshot(value) {
  return value?.enabled === true && /^[a-f0-9]{64}$/.test(value.accountKey || '')
    && typeof value.client?.name === 'string' && Number.isInteger(value.client?.number)
    && typeof value.company?.name === 'string' && ['en','pt'].includes(value.language)
    && Number.isFinite(Date.parse(value.serverTime))
    && ['pass','sessions','week','timer'].every(key=>typeof value.features?.[key] === 'boolean')
    && Array.isArray(value.bookings) && value.bookings.length <= 5
    && (!value.week || (Array.isArray(value.week.days) && value.week.days.length === 7))
    && (!value.pass || qrRuns(value.pass.matrix).length > 0);
}
export function validTimer(timer) {
  return timer && ['stopwatch', 'countdown', 'interval'].includes(timer.mode)
    && ['idle', 'running', 'paused', 'completed'].includes(timer.status)
    && Number.isFinite(timer.elapsed) && timer.elapsed >= 0 && timer.elapsed <= 86400
    && Number.isFinite(timer.startedAt) && timer.startedAt >= 0
    && Number.isInteger(timer.work) && timer.work >= 1 && timer.work <= 3600
    && Number.isInteger(timer.rest) && timer.rest >= 0 && timer.rest <= 3600
    && Number.isInteger(timer.rounds) && timer.rounds >= 1 && timer.rounds <= 100
    && (timer.mode === 'stopwatch' || timer.work * timer.rounds + timer.rest * (timer.rounds - 1) <= 86400);
}
export function qrRuns(matrix) {
  if (!Array.isArray(matrix) || matrix.length < 21 || matrix.length > 177
    || !matrix.every(row => typeof row === 'string' && row.length === matrix.length && /^[01]+$/.test(row))) return [];
  const runs = [];
  matrix.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      if (row[x] !== '1') { x++; continue; }
      const from = x; while (row[x] === '1') x++;
      runs.push({x: from + 4, y: y + 4, width: x - from});
    }
  });
  return runs;
}
