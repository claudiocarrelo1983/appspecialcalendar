import { sameGymOrigin } from './nativeGymCore';

export function userLevelLabel(value) {
  const level=String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  if(!level)return '';
  if(['admin','administrator','administrador','owner','proprietario'].includes(level))return 'Admin';
  if(['client','cliente','member','socio'].includes(level))return 'Member';
  return 'Team';
}

export function menuCategoryIcon(item) {
  const firstTarget=node=>node.url||(node.children||[]).map(firstTarget).find(Boolean);
  let route;try{route=new URL(firstTarget(item)).pathname;}catch{return 'more';}
  if(/notification|inbox|message/.test(route))return 'bell';
  if(/revenue-reports|membership-reports|attendance-reports|coach-performance/.test(route))return 'reports';
  if(/performance|fitness-assessments|body-measurements|fitness-goals|personal-records|progress-photos/.test(route))return 'progress';
  if(/events|event-clients|challenges|competitions/.test(route))return 'events';
  if(/workout-timer|gym-sessions/.test(route))return 'health';
  if(/team-members|task-operations|vacations|permissions|hotel-clock|shift-planner/.test(route))return 'team';
  if(/clients-list|members-debts/.test(route))return 'members';
  if(/profile/.test(route))return 'profile';
  if(/memberships/.test(route))return 'pass';
  if(/classes|personal-classes|company-locations/.test(route))return 'bookings';
  if(/dashboard-gym/.test(route))return 'home';
  if(/company|preferences|payments-setup|my-plan|legal-documents/.test(route))return 'settings';
  return 'more';
}

export function adminCandidateUrl(value, base) {
  if (!sameGymOrigin(value,base)) return false;
  return /^\/(?:dashboard-gym|clients-list|memberships|gym-classes)(?:\/|$)/.test(new URL(value,base).pathname);
}
export function publicOrClientUrl(value, base) {
  if (!sameGymOrigin(value,base)) return true;
  return /^\/(?:$|(?:site\/)?(?:login|logout)(?:\/|$)|dashboard-gym-client(?:\/|$)|form-signup(?:\/|$))/.test(new URL(value,base).pathname);
}

// Android's WebMessageListener supplies sourceOrigin as nativeEvent.url;
// the legacy Android bridge and iOS can supply a complete document URL.
// The injected document generation and URL identify the actual loaded page.
export function adminDocumentMessageMatches(sender, message, committed, base, generation) {
  try {
    if (!sameGymOrigin(sender||committed,base) || !sameGymOrigin(committed,base)
      || !sameGymOrigin(message.documentUrl,base) || message.documentId!==generation) return false;
    const current=new URL(committed),document=new URL(message.documentUrl),event=new URL(sender||committed);
    const pathname=url=>url.pathname.replace(/\/$/,'');
    if (pathname(current)!==pathname(document)) return false;
    const originOnly=event.pathname==='/'&&!event.search&&!event.hash;
    if (!originOnly&&pathname(event)!==pathname(document)) return false;
    if (message.event==='document'&&message.page&&new URL(message.page.url).href!==document.href) return false;
    return true;
  } catch { return false; }
}
