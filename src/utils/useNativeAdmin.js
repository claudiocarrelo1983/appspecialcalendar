import { useCallback, useEffect, useRef, useState } from 'react';
import { sameGymOrigin } from './nativeGymCore';
import { ADMIN_MESSAGE, adminScript, adminActivationScript, isAdminDashboard, validAdminClass, validAdminParticipant, validAdminDate } from './nativeAdminCore';
const cacheKey = (date, code = '') => date + ':' + code;

export default function useNativeAdmin(webViewRef, base) {
  const [context, setContext] = useState(null), [screen, setScreen] = useState('web');
  const [sharedClass,setSharedClass]=useState(null);
  const [onDashboard, setOnDashboard] = useState(false);
  const [roster, setRoster] = useState(null), [rosterLoading, setRosterLoading] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [members, setMembers] = useState([]);
  const contextRef = useRef(null), rosterRef = useRef(null), url = useRef(base);
  const pending = useRef(new Map()), sequence = useRef(0), version = useRef(0), active = useRef(true);
  const rosterRevision = useRef(0), searchRevision = useRef(0), classRevision = useRef(0), busyRef = useRef(false);
  const cache = useRef(new Map()), dashboard = useRef(false);
  const enterSchedule = useRef(false);
  const lastRoster = useRef(null);
  const applyContext = useCallback(value => { contextRef.current = value; setContext(value); }, []);
  const applyRoster = useCallback(value => { rosterRef.current = value; setRoster(value); }, []);
  const reset = useCallback(() => {
    setSharedClass(null);
    version.current++;
    pending.current.forEach(item => { clearTimeout(item.timeout); item.reject(Error('navigating')); }); pending.current.clear();
    rosterRevision.current++; searchRevision.current++; classRevision.current++;
    applyContext(null); applyRoster(null); cache.current.clear(); setMembers([]); setScreen('web'); setError('');
    busyRef.current = false; setBusy(false); setRosterLoading(false); setRosterOpen(false); lastRoster.current = null;
  }, [applyContext, applyRoster]);
  const request = useCallback((action, params = {}) => new Promise((resolve, reject) => {
    if (!sameGymOrigin(url.current, base) || !webViewRef.current) { reject(Error('offline')); return; }
    const id = 'admin:' + version.current + ':' + (++sequence.current);
    let script;
    try { script = adminScript(base, action, params, id); } catch (failure) { reject(failure); return; }
    const timeout = setTimeout(() => { pending.current.delete(id); reject(Error('offline')); }, 15000);
    pending.current.set(id, { resolve, reject, timeout, action }); webViewRef.current.injectJavaScript(script);
  }), [base, webViewRef]);
  const loadRoster = useCallback(async (schedule, date) => {
    if (!Number.isSafeInteger(Number(schedule)) || Number(schedule) <= 0) return;
    const revision = ++rosterRevision.current;
    lastRoster.current = { schedule, date }; setRosterOpen(true);
    setError(''); setMembers([]); applyRoster(null); setRosterLoading(true);
    try {
      const result = await request('roster', { schedule_id: schedule, date });
      if (!active.current || revision !== rosterRevision.current) return;
      if (!validAdminClass(result.class) || !Array.isArray(result.participants)) throw Error('invalid_response');
      applyRoster({ class: result.class, participants: result.participants.filter(validAdminParticipant) });
    } catch (failure) { if (active.current && revision === rosterRevision.current) setError(failure.message); }
    finally { if (active.current && revision === rosterRevision.current) setRosterLoading(false); }
  }, [request, applyRoster]);
  const closeRoster = useCallback(() => {
    rosterRevision.current++; searchRevision.current++; applyRoster(null); setRosterLoading(false); setRosterOpen(false); setMembers([]); setError('');
  }, [applyRoster]);
  const loadClasses = useCallback(async (date = contextRef.current?.date, more = false, selectedCode = contextRef.current?.classCode || '') => {
    if (!date || busyRef.current) return;
    const revision = ++classRevision.current;
    const classCode = selectedCode;
    const existing = cache.current.get(cacheKey(date, classCode));
    if (!more && existing) applyContext(existing);
    setBusy(true); busyRef.current = true; setError('');
    try {
      const result = await request('classes', { date, class_code: classCode, offset: more ? contextRef.current?.next || 0 : 0, limit: 24 });
      if (!active.current || revision !== classRevision.current) return;
      if (!Array.isArray(result.classes)) throw Error('invalid_response');
      const previous = more ? contextRef.current?.classes || [] : [];
      const values = new Map([...previous, ...result.classes.filter(validAdminClass)].map(item => [String(item.schedule_id), item]));
      const next = { ...contextRef.current, date, classCode, classes: [...values.values()], next: result.next,
        total: result.total, hasMore: result.hasMore === true };
      cache.current.set(cacheKey(date, classCode), next); if (cache.current.size > 7) cache.current.delete(cache.current.keys().next().value);
      applyContext(next);
    } catch (failure) { if (active.current && revision === classRevision.current) setError(failure.message); }
    finally { if (active.current && revision === classRevision.current) { setBusy(false); busyRef.current = false; } }
  }, [request, applyContext]);
  const searchMembers = useCallback(async query => {
    const current = rosterRef.current, revision = ++searchRevision.current;
    setMembers([]);
    if (!current || query.trim().length < 2) return;
    try {
      const result = await request('search', { schedule_id: current.class.schedule_id, date: current.class.date, q: query.trim() });
      if (active.current && revision === searchRevision.current && rosterRef.current === current) {
        setMembers(Array.isArray(result.members) ? result.members.filter(item => item && typeof item.guid === 'string' && typeof item.name === 'string') : []);
      }
    } catch (failure) { if (active.current && revision === searchRevision.current) setError(failure.message); }
  }, [request]);
  const mutate = useCallback(async (action, params) => {
    const current = rosterRef.current;
    if (!current || current.class.can_manage !== true || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    const documentVersion = version.current, rosterVersion = rosterRevision.current;
    try {
      const result = await request(action, { schedule_id: current.class.schedule_id, date: current.class.date, ...params });
      if (!active.current || documentVersion !== version.current || rosterVersion !== rosterRevision.current) return;
      if (action === 'attendance' && !validAdminParticipant(result.participant)) throw Error('invalid_response');
      const participants = Array.isArray(result.participants) ? result.participants.filter(validAdminParticipant)
        : current.participants.map(item => Number(item.booking_id) === Number(result.participant?.booking_id) ? result.participant : item);
      if (validAdminClass(result.class)) {
        applyRoster({ class: result.class, participants });
        const previous = contextRef.current;
        if (previous) {
          const next = { ...previous, classes: previous.classes.map(item => Number(item.schedule_id) === Number(result.class.schedule_id) ? result.class : item) };
          applyContext(next); cache.current.set(cacheKey(next.date, next.classCode), next);
        }
      }
      setMembers([]); return result;
    } catch (failure) {
      if (active.current && documentVersion === version.current && rosterVersion === rosterRevision.current) setError(failure.message);
      throw failure;
    } finally { if (active.current && documentVersion === version.current) { busyRef.current = false; setBusy(false); } }
  }, [request, applyRoster, applyContext]);
  const onNavigation = useCallback(target => {
    url.current = target || ''; version.current++; classRevision.current++; rosterRevision.current++; searchRevision.current++;
    pending.current.forEach(item => { clearTimeout(item.timeout); item.reject(Error('navigating')); }); pending.current.clear();
    dashboard.current = isAdminDashboard(target, base); enterSchedule.current=dashboard.current;
    setOnDashboard(dashboard.current); setScreen('web'); applyRoster(null); setRosterLoading(false); setRosterOpen(false);
    busyRef.current = false; setBusy(false); setError('');
    if (!sameGymOrigin(target, base) || /^\/(?:site\/)?(?:login|logout)\/?$/.test(new URL(target, base).pathname)
      || new URL(target, base).pathname === '/') reset();
  }, [base, reset, applyRoster]);
  const onMessage = useCallback(event => {
    let message;
    if (typeof event.data !== 'string' || event.data.length > 250000) return false;
    try { message = JSON.parse(event.data); } catch { return false; }
    if (message.type !== ADMIN_MESSAGE) return false;
    if (!sameGymOrigin(event.url || url.current, base)) return true;
    if(message.event==='share'){
      // Client day/class filters can replace the query string without a page load.
      if(sameGymOrigin(message.documentUrl,base)&&/^\/dashboard-gym-client(?:\/index)?\/?$/.test(new URL(message.documentUrl).pathname)
          &&/^\/dashboard-gym-client(?:\/index)?\/?$/.test(new URL(url.current,base).pathname)&&validAdminClass(message.item))
        setSharedClass({...message.item,language:message.language==='pt'?'pt':'en'});
      return true;
    }
    if (message.event === 'ready' && dashboard.current && validAdminDate(message.date) && Array.isArray(message.classes)) {
      const next = { language: message.language === 'pt' ? 'pt' : 'en', date: message.date, classCode: String(message.classCode || '').slice(0, 255),
        today: validAdminDate(message.today) ? message.today : (contextRef.current?.today || message.date),
        classFilters: Array.isArray(message.classFilters) ? message.classFilters.filter(row=>row&&typeof row.code==='string'&&typeof row.label==='string').slice(0,100) : [],
        classes: message.classes.filter(validAdminClass), next: message.next, total: message.total, hasMore: message.hasMore === true };
      applyContext(next); cache.current.set(cacheKey(next.date, next.classCode), next); webViewRef.current?.injectJavaScript(adminActivationScript(true));
      if(enterSchedule.current){enterSchedule.current=false;setScreen('classes');}
    } else if (message.event === 'open' && dashboard.current && contextRef.current) {
      loadRoster(message.schedule, message.date);
    } else if (message.event === 'response') {
      const item = pending.current.get(message.id); if (!item) return true;
      clearTimeout(item.timeout); pending.current.delete(message.id);
      if (message.status === 401 || message.status === 403) {
        if(message.status===403&&item.action?.startsWith('share-')){item.reject(Error('access_denied'));return true;}
        reset(); webViewRef.current?.injectJavaScript(adminActivationScript(false)); item.reject(Error('access_denied'));
      } else if (message.status >= 200 && message.status < 300 && message.result?.success === true) item.resolve(message.result);
      else { const failure = Error(message.result?.message || 'offline'); failure.reason = message.result?.reason;
        failure.confirmation = message.result?.requires_confirmation === true; item.reject(failure); }
    }
    return true;
  }, [base, applyContext, loadRoster, reset, webViewRef]);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; pending.current.forEach(item => { clearTimeout(item.timeout); item.reject(Error('navigating')); }); pending.current.clear(); };
  }, []);
  const showClasses = useCallback(() => { if (contextRef.current) setScreen('classes'); }, []);
  const showDashboard = useCallback(() => setScreen('web'), []);
  const retryRoster = useCallback(() => { if (lastRoster.current) loadRoster(lastRoster.current.schedule, lastRoster.current.date); }, [loadRoster]);
  const searchShareClients=useCallback(async q=>{
    const result=await request('share-search',{q});
    if(!Array.isArray(result.clients))throw Error('invalid_response');
    return result.clients.filter(row=>Number.isSafeInteger(row.id)&&row.id>0&&typeof row.name==='string').slice(0,20);
  },[request]);
  const sendClassInvitation=useCallback(async(item,recipient,token)=>{
    const result=await request('share-send',{schedule_id:item.schedule_id,date:item.date,recipient_id:recipient,token});
    if(result.success!==true)throw Error('invalid_response');
    return result;
  },[request]);
  return { context, screen, roster, rosterLoading, rosterOpen, error, busy, members, onNavigation, onMessage, loadClasses,
    sharedClass,closeShareClass:()=>setSharedClass(null),
    loadRoster, closeRoster, searchMembers, mutate, showClasses, retryRoster,searchShareClients,sendClassInvitation,
    showDashboard, onDashboard, injectedScript: adminScript(base) };
}
