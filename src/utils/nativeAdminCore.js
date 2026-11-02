import { sameGymOrigin } from './nativeGymCore';

export const ADMIN_MESSAGE = 'sc.nativeAdmin';
export function validAdminDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export const isAdminDashboard = (url, base) => sameGymOrigin(url, base)
  && /^\/dashboard-gym(?:\/index)?\/?$/.test(new URL(url).pathname);

// Runs inside the existing authenticated WebView. No cookies or CSRF tokens cross the bridge.
const ADMIN_DOCUMENT_SOURCE = String.raw`function(c) {
  if (location.origin !== c.origin || !window.ReactNativeWebView) return;
  function send(value) { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'sc.nativeAdmin', ...value })); }
  function cards(root) {
    const text = (el, selector) => (el.querySelector(selector)?.textContent || '').trim().slice(0, 240);
    return Array.from(root.querySelectorAll('[data-class-item]')).slice(0, 24).map(item => {
      const card = item.querySelector('[data-class-card]');
      if (!card) return null;
      const meta = Array.from(card.querySelectorAll('.dashboard-class-meta span')).map(el => el.textContent.trim());
      const calendar = card.querySelector('[data-gym-calendar-event]');
      let calendarEvent = null;
      try { calendarEvent = JSON.parse(calendar?.getAttribute('data-gym-calendar-event') || 'null'); } catch {}
      return { schedule_id: Number(card.dataset.classCard), date: card.dataset.classDate,
        shareUrl: card.querySelector('[data-gym-share]')?.getAttribute('href') || null,
        calendarUrl: calendar?.getAttribute('href') || null, calendarEvent,
        class_name: text(card, 'h3'), start_time: card.dataset.classStartTime, end_time: card.dataset.classEndTime,
        coach: meta[0] || '', room: meta[1] || '', capacity: Number(item.dataset.classCapacity) || 0,
        stats: { registered: Number(item.dataset.classRegistered) || 0 },
        status: { label: text(card, '[data-class-status]') } };
    }).filter(item => item && Number.isSafeInteger(item.schedule_id) && item.schedule_id > 0);
  }
  function ready() {
    const section = document.querySelector('.dashboard-gym-today');
    if (!section || !/^\/dashboard-gym(?:\/index)?\/?$/.test(location.pathname)) return;
    send({ event: 'ready', language: document.documentElement.lang?.startsWith('pt') ? 'pt' : 'en',
      date: section.dataset.selectedDate, classCode: section.dataset.selectedClassCode || '', classes: cards(section),
      today: (()=>{try{return new URL(section.querySelector('.dashboard-month-today')?.href).searchParams.get('date');}catch{return null;}})(),
      classFilters: Array.from(section.querySelectorAll('[data-class-filter]')).filter(el=>el.dataset.classFilter).map(el=>({code:el.dataset.classFilter,label:el.textContent.trim().slice(0,240)})),
      next: Number(section.dataset.classNextOffset) || 0, total: Number(section.dataset.classTotal) || 0,
      hasMore: section.dataset.classHasMore === '1' });
  }
  if (c.action === 'install') {
    if (!window.__scAdminInstalled) {
      window.__scAdminInstalled = true;
      document.addEventListener('DOMContentLoaded', ready, { once: true });
      document.addEventListener('click', event => {
        const share=event.target.closest?.('[data-gym-share]');
        if(share&&/^\/dashboard-gym-client(?:\/index)?\/?$/.test(location.pathname)){
          try{
            const target=new URL(share.getAttribute('href'),location.href);
            if(target.origin!==c.origin)return;
            const schedule=Number(target.searchParams.get('schedule_id')),date=target.searchParams.get('date');
            if(!Number.isSafeInteger(schedule)||schedule<1||!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return;
            event.preventDefault();event.stopImmediatePropagation();
            send({event:'share',documentUrl:location.href,language:document.documentElement.lang?.startsWith('pt')?'pt':'en',
              item:{schedule_id:schedule,date,class_name:(share.getAttribute('data-share-title')||'Class').slice(0,240),start_time:'',shareUrl:target.href}});
          }catch{}
          return;
        }
        const button = event.target.closest?.('[data-manage-attendance]');
        if (!button || !window.__scAdminActive || !document.querySelector('.dashboard-gym-today')) return;
        event.preventDefault(); event.stopImmediatePropagation();
        send({ event: 'open', schedule: Number(button.dataset.scheduleId), date: button.dataset.classDate });
      }, true);
    }
    ready(); return;
  }
  const routes = { classes: ['/dashboard-gym/today-classes', false],
    'share-search':['/class-invitations/recipients',false], 'share-send':['/class-invitations/send',true],
    roster: ['/dashboard-gym/today-class-attendance', false], search: ['/dashboard-gym/search-class-members', false],
    attendance: ['/dashboard-gym/save-today-class-attendance', true],
    add: ['/dashboard-gym/add-today-class-member', true], remove: ['/dashboard-gym/remove-today-class-member', true] };
  if (!routes[c.action]) return;
  const [route, post] = routes[c.action];
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 12000);
  (async () => {
    const options = { credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } };
    let url = route;
    if (post) {
      const csrf = document.querySelector('meta[name="csrf-token"]')?.content
        || document.querySelector('.dashboard-gym-today')?.dataset.csrfToken;
      if (!csrf) throw Error('csrf_unavailable');
      options.method = 'POST'; options.headers['X-CSRF-Token'] = csrf;
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      options.body = new URLSearchParams(c.params).toString();
    } else url += '?' + new URLSearchParams(c.params).toString();
    const response = await fetch(url, options);
    if (response.url) {
      const final = new URL(response.url, c.origin);
      if (final.origin !== c.origin || (response.redirected && /^\/(?:site\/)?login\/?$/.test(final.pathname))) {
        send({ event: 'response', id: c.id, status: final.origin === c.origin ? 401 : 403, result: { success: false } }); return;
      }
    }
    let result;
    try { result = await response.json(); } catch { result = { success: false }; }
    if (c.action === 'classes' && result.success === true) {
      const root = new DOMParser().parseFromString(result.html || '', 'text/html');
      result = { success: true, classes: cards(root), summary: result.summary, next: result.next_offset,
        total: result.total, hasMore: result.has_more === true };
    }
    send({ event: 'response', id: c.id, status: response.status, result });
  })().catch(() => send({ event: 'response', id: c.id, status: 0, result: { success: false } }))
    .finally(() => clearTimeout(timeout));
}`;

export function adminScript(base, action = 'install', params = {}, id = '') {
  const allowed = {
    install: [], classes: ['date','offset','limit','class_code'], roster: ['schedule_id','date'], search: ['schedule_id','date','q'],
    'share-search':['q'],'share-send':['schedule_id','date','recipient_id','token'],
    attendance: ['booking_id','status'], remove: ['booking_id'],
    add: ['schedule_id','date','client_guid','member_query','experimental_guest','confirm_missing_membership'],
  };
  if (!Object.prototype.hasOwnProperty.call(allowed, action)) throw Error('Unsupported admin action');
  const clean = {};
  for (const key of allowed[action]) if (params[key] !== undefined) clean[key] = String(params[key]).slice(0, 255);
  for (const key of ['schedule_id','booking_id']) if (key in clean && !/^[1-9]\d{0,9}$/.test(clean[key])) throw Error('Invalid ID');
  if ('date' in clean && !validAdminDate(clean.date)) throw Error('Invalid date');
  if ('status' in clean && !['attended','missed'].includes(clean.status)) throw Error('Invalid attendance');
  return '(' + ADMIN_DOCUMENT_SOURCE + ')(' + JSON.stringify({ origin: new URL(base).origin, action, params: clean, id }) + ');true;';
}

export function validAdminClass(item) {
  return item && Number.isSafeInteger(Number(item.schedule_id)) && Number(item.schedule_id) > 0
    && typeof item.class_name === 'string' && validAdminDate(item.date);
}

export function validAdminParticipant(item) {
  return item && Number.isSafeInteger(Number(item.booking_id)) && Number(item.booking_id) > 0
    && typeof item.member_name === 'string' && ['pending','attended','missed'].includes(item.status);
}

export function adminTranslations(language) {
  return language === 'pt' ? {
    dashboard:'Resumo',classes:'Aulas',manage:'Gerir lista da aula',refresh:'Atualizar',back:'Voltar',close:'Fechar',
    capacity:'Capacidade',registered:'Inscritos',attended:'Presente',missed:'Faltou',pending:'Pendente',
    member:'Sócio',guest:'Experimental',empty:'Não há aulas nesta data.',noMembers:'Ainda não há inscritos.',
    search:'Procurar sócio',add:'Adicionar',addGuest:'Adicionar aluno experimental',remove:'Remover',
    removeConfirm:'Remover este participante da aula?',cancel:'Cancelar',confirm:'Confirmar',retry:'Tentar novamente',
    error:'Não foi possível atualizar. Tente novamente.',more:'Carregar mais',previous:'Dia anterior',next:'Dia seguinte',
  } : {
    dashboard:'Dashboard',classes:'Classes',manage:'Manage Class List',refresh:'Refresh',back:'Back',close:'Close',
    capacity:'Capacity',registered:'Registered',attended:'Attended',missed:'Missed',pending:'Pending',
    member:'Member',guest:'Experimental',empty:'No classes on this date.',noMembers:'No participants yet.',
    search:'Search member name',add:'Add',addGuest:'Add experimental student',remove:'Remove',
    removeConfirm:'Remove this participant from the class?',cancel:'Cancel',confirm:'Confirm',retry:'Try again',
    error:'Could not update. Please try again.',more:'Load more',previous:'Previous day',next:'Next day',
  };
}

// Only the footer is replaced while the native class screen is open. Website menus/QR tools stay available.
export function adminActivationScript(enabled) {
  return 'window.__scAdminActive=' + JSON.stringify(!!enabled) + ';true;';
}
