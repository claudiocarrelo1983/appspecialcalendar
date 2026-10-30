import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import { cancelTimerAlert } from './nativeTimerAlerts';
import { gymRequestScript, nativeShellStyleScript, NATIVE_GYM_MESSAGE, sameGymOrigin, isClientDashboard, validSnapshot, WEB_ROUTES } from './nativeGymCore';

export default function useNativeGym(webViewRef, startUrl, setWebViewUrl) {
  const [data, setData] = useState(null);
  const [screen, setScreen] = useState('web');
  const [webSection,setWebSection]=useState('bookings');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [bootstrapState,setBootstrapState] = useState('idle');
  const [bootstrapError,setBootstrapError] = useState('');
  const pending = useRef(new Map()), sequence = useRef(0), generation = useRef(0);
  const documentUrl = useRef(startUrl), mounted = useRef(true), dataRef = useRef(null);
  const screenRef = useRef('web'), refreshSequence = useRef(0);
  const authenticated = useRef(false);
  const changeScreen = useCallback((next) => { screenRef.current = next; setScreen(next); }, []);
  const clear = useCallback(() => {
    const old = dataRef.current;
    if(sameGymOrigin(documentUrl.current,startUrl))webViewRef.current?.injectJavaScript(nativeShellStyleScript(false,startUrl));
    refreshSequence.current++; generation.current++;
    pending.current.forEach(item => { clearTimeout(item.timeout); item.reject(new Error('signedOut')); });
    pending.current.clear();
    dataRef.current = null; authenticated.current = false; setData(null); changeScreen('web'); setError('');setBootstrapState('idle');setBootstrapError('');
    if (old?.accountKey) {
      cancelTimerAlert(old.accountKey).catch(() => {});
      SecureStore.deleteItemAsync('native-gym-timer-' + old.accountKey).catch(() => {});
    }
  }, [changeScreen,startUrl,webViewRef]);
  const request = useCallback((action, params = {}) => new Promise((resolve, reject) => {
    if (!sameGymOrigin(documentUrl.current, startUrl) || !webViewRef.current) {
      reject(new Error('offline')); return;
    }
    const id = generation.current + ':' + (++sequence.current);
    const timeout = setTimeout(() => {
      pending.current.delete(id); reject(new Error('offline'));
    }, 15000);
    pending.current.set(id, {resolve, reject, timeout, action});
    webViewRef.current.injectJavaScript(gymRequestScript(id, action, params, startUrl));
  }), [startUrl, webViewRef]);
  const accept = useCallback((next) => {
    if (!validSnapshot(next)) { clear(); return false; }
    if (dataRef.current?.accountKey && dataRef.current.accountKey !== next.accountKey) {
      cancelTimerAlert(dataRef.current.accountKey).catch(() => {});
      SecureStore.deleteItemAsync('native-gym-timer-' + dataRef.current.accountKey).catch(() => {});
    }
    dataRef.current = next; authenticated.current = true; setData(next); setError('');setBootstrapState('idle');setBootstrapError('');
    webViewRef.current?.injectJavaScript(nativeShellStyleScript(true,startUrl,next.company.color));
    return true;
  }, [clear,startUrl,webViewRef]);
  const refresh = useCallback(async (autoOpen = false) => {
    const revision = ++refreshSequence.current;
    if (!dataRef.current && isClientDashboard(documentUrl.current,startUrl)) setBootstrapState('loading');
    try {
      const next = await request('context');
      if (!mounted.current || revision !== refreshSequence.current) return;
      if (accept(next)) {
        if (autoOpen) { setWebSection('bookings'); changeScreen('web'); }
      } else if (next?.enabled !== false && isClientDashboard(documentUrl.current,startUrl)) {setBootstrapError('invalid_context');setBootstrapState('failed');}
    } catch (failure) {
      if (!mounted.current || revision !== refreshSequence.current) return;
      if (mounted.current && dataRef.current && failure.message !== 'navigating') setError('offline');
      if (mounted.current && !dataRef.current && failure.message !== 'navigating'
        && isClientDashboard(documentUrl.current,startUrl)) {
        setBootstrapError(failure.diagnostic || 'connection');setBootstrapState('failed');
      }
    }
  }, [request, accept, changeScreen, startUrl]);
  const onMessage = useCallback((nativeEvent) => {
    let message;
    try { message = JSON.parse(nativeEvent.data); } catch { return false; }
    if (message?.type !== NATIVE_GYM_MESSAGE) return false;
    if (!sameGymOrigin(nativeEvent.url || documentUrl.current, startUrl)) return true;
    const item = pending.current.get(message.id);
    if (!item) return true;
    clearTimeout(item.timeout); pending.current.delete(message.id);
    if ([401,403].includes(message.status)) {
      clear();
      const diagnostic='HTTP_'+message.status+([4101,4102,4103,4104,4105].includes(message.result?.code)?'_'+message.result.code:'');
      if (message.status === 401) {
        webViewRef.current?.injectJavaScript('location.replace('+JSON.stringify(new URL('/login',startUrl).href)+');true;');
      } else if (isClientDashboard(documentUrl.current,startUrl)) {
        setBootstrapError(diagnostic);setBootstrapState('failed');
      }
      const failure=new Error(message.status===401?'signedOut':'forbidden');failure.diagnostic=diagnostic;
      item.reject(failure); return true;
    }
    if (message.status >= 200 && message.status < 300 && message.result?.success === true) {
      item.resolve(message.result.data);
    } else {
      const failure=new Error(message.result?.message || 'offline');
      failure.diagnostic=message.status>0?'HTTP_'+message.status+(message.reason==='invalid_response'?'_invalid_response':''):'connection';
      item.reject(failure);
    }
    return true;
  }, [startUrl, clear, webViewRef]);
  const onNavigation = useCallback((url) => {
    documentUrl.current = url || '';
    if (!isClientDashboard(url,startUrl)) setBootstrapState('idle');
    if(sameGymOrigin(url,startUrl)){
      const pathname=new URL(url).pathname.replace(/\/$/,'');
      setWebSection(Object.keys(WEB_ROUTES).find(key=>WEB_ROUTES[key]===pathname||pathname.startsWith(WEB_ROUTES[key]+'/'))||'bookings');
    }
    if(dataRef.current && sameGymOrigin(url,startUrl))changeScreen('web');
    generation.current++; refreshSequence.current++;
    pending.current.forEach(item => { clearTimeout(item.timeout); item.reject(new Error('navigating')); });
    pending.current.clear();
    if (!sameGymOrigin(url, startUrl) || /\/(?:login|site\/login|site\/logout|logout)(?:[/?#]|$)/.test(url || '')) clear();
  }, [startUrl, clear, changeScreen]);
  const onLoadEnd = useCallback((event) => {
    const url = event?.nativeEvent?.url || documentUrl.current;
    documentUrl.current = url;
    if (!sameGymOrigin(url, startUrl)) return;
    if (/\/(?:login|site\/login|site\/logout|logout)(?:[/?#]|$)/.test(url)) {
      webViewRef.current?.injectJavaScript(nativeShellStyleScript(false,startUrl));return;
    }
    // Keep shared classes and notification details visible in the web booking flow.
    const target = new URL(url);
    // The company's root is its login page. Wait for the authenticated redirect
    // instead of treating the initial login document as a failed client session.
    if (target.pathname === '/') return;
    const dashboard = /^\/dashboard-gym(?:-client)?(?:\/index)?\/?$/.test(target.pathname);
    const detail = target.searchParams.has('schedule_id') || target.searchParams.has('_push_open');
    if (detail) changeScreen('web');
    refresh(dashboard && !detail && !authenticated.current);
  }, [startUrl, refresh, changeScreen, webViewRef]);
  const openWeb = useCallback((route,params={}) => {
    if (!WEB_ROUTES[route]) return;
    setWebSection(route);
    changeScreen('web');
    const target=route==='notifications'&&Number.isSafeInteger(params.id)&&params.id>0?WEB_ROUTES[route]+'/view?id='+params.id:WEB_ROUTES[route];
    const url=new URL(target, startUrl).href;
    if(webViewRef.current && sameGymOrigin(documentUrl.current,startUrl)) {
      webViewRef.current.injectJavaScript('location.assign('+JSON.stringify(url)+');true;');
    } else setWebViewUrl(url);
  }, [startUrl, changeScreen, setWebViewUrl, webViewRef]);
  const mutate = useCallback(async (action, params) => {
    if (busy) return;
    setBusy(true); setError('');
    try { accept(await request(action, params)); }
    catch (failure) {
      if (!['signedOut','navigating'].includes(failure.message)) {
        if(failure.message!=='offline')await refresh();
        if(mounted.current && dataRef.current)setError(failure.message);
      }
    }
    finally { if (mounted.current) setBusy(false); }
  }, [busy, accept, request, refresh]);
  const logout = useCallback(async () => {
    if(busy)return;
    setBusy(true);
    try {
      try{await request('logout');}catch(failure){if(failure.message!=='signedOut')throw failure;}
      clear();
      if(webViewRef.current&&sameGymOrigin(documentUrl.current,startUrl)){
        webViewRef.current.injectJavaScript('location.replace('+JSON.stringify(startUrl)+');true;');
      }else setWebViewUrl(startUrl);
    }finally{if(mounted.current)setBusy(false);}
  },[busy,request,clear,startUrl,setWebViewUrl,webViewRef]);
  const select = useCallback((next) => {
    changeScreen(next);
    // Profile edits may save with AJAX without a WebView load event.
    if (next === 'home' || next === 'pass') refresh();
  }, [changeScreen,refresh]);
  const signIn = useCallback(() => {
    clear();
    const url=new URL('/login',startUrl).href;
    if(webViewRef.current&&sameGymOrigin(documentUrl.current,startUrl))webViewRef.current.injectJavaScript('location.replace('+JSON.stringify(url)+');true;');
    else setWebViewUrl(url);
  }, [clear,startUrl,webViewRef,setWebViewUrl]);
  const setLanguage = useCallback(async (language) => {
    if (busy || !['en','pt'].includes(language) || language === dataRef.current?.language) return;
    setBusy(true); setError('');
    try {
      const next = await request('language', {language});
      if (!mounted.current || !accept(next)) return;
      // A web page needs new translated HTML; native views update from the DTO.
      if (screenRef.current === 'web' && sameGymOrigin(documentUrl.current,startUrl)) {
        webViewRef.current?.injectJavaScript('location.reload();true;');
      }
    } finally { if (mounted.current) setBusy(false); }
  }, [busy,request,accept,startUrl,webViewRef]);
  useEffect(() => {
    mounted.current = true;
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active' && (dataRef.current || isClientDashboard(documentUrl.current,startUrl))) refresh();
    });
    const received=Notifications.addNotificationReceivedListener(()=>{if(dataRef.current)refresh();});
    return () => {
      mounted.current = false; listener.remove();received.remove();
      pending.current.forEach(item => { clearTimeout(item.timeout); item.reject(new Error('navigating')); });
      pending.current.clear();
    };
  }, [refresh,startUrl]);
  return {data, screen, webSection, busy, error, request, refresh, onMessage, onNavigation, onLoadEnd, openWeb,
    injectedScript:nativeShellStyleScript(!!data,startUrl,data?.company.color),
    bootstrapState,bootstrapError,signIn,logout,select,setLanguage, checkin: () => mutate('checkin'), checkout: () => mutate('checkout', {id: data?.session?.id})};
}
