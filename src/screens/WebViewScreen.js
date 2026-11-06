import {LoadingIndicator as ActivityIndicator} from './NativeGymTypography';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Linking, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import NativeGymShell from './NativeGymShell';
import NativeAdminShell from './NativeAdminShell';
import useNativeAdmin from '../utils/useNativeAdmin';
import NativeAdminFrame from './NativeAdminFrame';
import useNativeAdminPages from '../utils/useNativeAdminPages';
import useWebViewSource from '../utils/useWebViewSource';
import useWebViewRecovery from '../utils/useWebViewRecovery';
import { createAccountLoginWarningHandler } from '../utils/accountLoginWarnings';
import nativeGymTranslations from '../utils/nativeGymTranslations';
import { positionRestoreScript } from '../utils/webViewPosition';
import companyAppConfig from '../utils/companyAppConfig';
import useCompanyColor from '../utils/useCompanyColor';
import useNativeGym from '../utils/useNativeGym';
import useWorkoutSync from '../utils/useWorkoutSync';
import * as SecureStore from 'expo-secure-store';
import NativeOfflineWorkouts from './NativeOfflineWorkouts';
import offlinePass from '../utils/offlinePass';
import useNativeAuth from '../utils/useNativeAuth';
import NativeAuthScreen from './NativeAuthScreen';
import {authLinkTarget} from '../utils/nativeAuthCore';
import {appLanguageScript} from '../utils/appLanguage';
import {isClientDashboard} from '../utils/nativeGymCore';
import useClientBookings from '../utils/useClientBookings';
import Constants from 'expo-constants';
import { FITNESS_OAUTH_BRIDGE_SCRIPT, createFitnessOAuthHandler, fitnessOAuthAllowed, fitnessOAuthReplyScript } from '../utils/fitnessOAuth';
import usePushNotifications from '../utils/usePushNotifications';
import { WEBVIEW_SCROLL_SCRIPT } from '../utils/webViewScroll';
import { WEBVIEW_MODAL_SCRIPT } from '../utils/webViewModals';
import { trustedCalendarOrigin,isUserCalendarAction } from '../utils/calendarBridge';
import { CALENDAR_BRIDGE_SCRIPT, createCalendarMessageHandler } from '../utils/nativeCalendar';
import { classLinkTarget } from '../utils/classLinks';
import { HEALTH_BRIDGE_SCRIPT, handleHealthMessage, healthReplyScript, healthBridgeAllowed } from '../utils/healthBridge';

const COMPANY_APP = companyAppConfig();
const SITE_URL = COMPANY_APP.siteUrl;
const START_URL = `${SITE_URL}/`;
const GYM_BOOKING_PATH = `/${COMPANY_APP.pagecode}/booking`;
const GYM_DASHBOARD_URL = `${SITE_URL}/dashboard-gym`;
// Porto keeps .loading-overlay up until theme.js fires ready. In WKWebView that
// often never happens → blank white screen after our splash. Kill it with CSS +
// a light poll (no MutationObserver — those flooded the bridge and froze paint).
const SITE_OVERLAY_HIDE_SCRIPT = `
  (function () {
    if (window.__ftxOverlayHideInstalled) return true;
    window.__ftxOverlayHideInstalled = true;
    var readyPosted = false;

    function ensureHideCss() {
      try {
        if (document.getElementById('__ftx_hide_loading_overlay')) return;
        var target = document.head || document.documentElement;
        if (!target) return;
        var style = document.createElement('style');
        style.id = '__ftx_hide_loading_overlay';
        style.type = 'text/css';
        style.appendChild(document.createTextNode([
          'div.loading-overlay, .loading-overlay, .bounce-loader, .cssload-speeding-wheel-container {',
          '  display: none !important;',
          '  opacity: 0 !important;',
          '  visibility: hidden !important;',
          '  pointer-events: none !important;',
          '  z-index: -1 !important;',
          '}',
          'body.loading-overlay-showing, html.loading-overlay-showing {',
          '  overflow: auto !important;',
          '}'
        ].join('')));
        target.appendChild(style);
      } catch (err) {}
    }

    function hideSiteLoadingOverlay() {
      try {
        ensureHideCss();
        var body = document.body;
        var html = document.documentElement;
        if (html) html.classList.remove('loading-overlay-showing');
        if (body) body.classList.remove('loading-overlay-showing');
        var overlays = document.querySelectorAll('div.loading-overlay');
        for (var i = 0; i < overlays.length; i++) {
          var el = overlays[i];
          if (!el) continue;
          el.style.setProperty('display', 'none', 'important');
          try { el.parentNode && el.parentNode.removeChild(el); } catch (err) {}
        }
        try {
          if (window.jQuery) {
            window.jQuery('body').removeClass('loading-overlay-showing');
            window.jQuery('div.loading-overlay').remove();
            window.jQuery(window).trigger('loading.overlay.ready');
          }
        } catch (err) {}
      } catch (err) {}
    }

    function hasVisibleAppContent() {
      try {
        return !!(
          document.querySelector('.pagecode-login-card') ||
          document.querySelector('.pagecode-login-page') ||
          document.querySelector('.pagecode-auth-topbar') ||
          document.querySelector('.topbar') ||
          document.querySelector('form')
        );
      } catch (err) {
        return false;
      }
    }

    function maybePostReady() {
      if (readyPosted) return;
      hideSiteLoadingOverlay();
      if (!hasVisibleAppContent()) return;
      readyPosted = true;
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CONTENT_READY' }));
        }
      } catch (err) {}
    }

    hideSiteLoadingOverlay();
    maybePostReady();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        hideSiteLoadingOverlay();
        maybePostReady();
      });
    }
    window.addEventListener('load', function () {
      hideSiteLoadingOverlay();
      maybePostReady();
    });

    var ticks = 0;
    var timer = setInterval(function () {
      ticks += 1;
      hideSiteLoadingOverlay();
      maybePostReady();
      if (readyPosted || ticks >= 40) clearInterval(timer);
    }, 250);

    return true;
  })();
`;
const NATIVE_FEEL_SCRIPT = `
  (function () {
    if (window.__ftxNativeFeelInstalled) return true;
    window.__ftxNativeFeelInstalled = true;

    // 2. Viewport Meta Tag Enforcer (with safe DOM checks)
    function applyViewport() {
      try {
        var desiredContent = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover';
        var metas = document.querySelectorAll('meta[name="viewport"]');
        if (metas && metas.length > 0) {
          for (var i = 0; i < metas.length; i++) {
            metas[i].setAttribute('content', desiredContent);
          }
        } else {
          var target = document.head || document.documentElement;
          if (target) {
            var meta = document.createElement('meta');
            meta.name = 'viewport';
            meta.content = desiredContent;
            target.appendChild(meta);
          }
        }
      } catch (err) {}
    }

    // 3. CSS Injection (Touch Action, Safe Area Insets, Artifact Removal)
    function applyNativeStyles() {
      try {
        var target = document.head || document.documentElement;
        if (!target) return;
        if (document.getElementById('__ftx_native_feel_styles')) return;

        var style = document.createElement('style');
        style.id = '__ftx_native_feel_styles';
        style.type = 'text/css';
        style.innerHTML = [
          'html, body {',
          '  touch-action: manipulation !important;',
          '  -webkit-text-size-adjust: 100% !important;',
          '  overscroll-behavior-y: none;',
          '  margin: 0 !important;',
          '  padding: 0 !important;',
          '}',
          '* {',
          '  -webkit-touch-callout: none !important;',
          '  -webkit-tap-highlight-color: transparent !important;',
          '}',
          '*:not(input):not(textarea):not([contenteditable="true"]) {',
          '  -webkit-user-select: none !important;',
          '  user-select: none !important;',
          '}',
          'input, textarea, [contenteditable="true"] {',
          '  -webkit-user-select: text !important;',
          '  user-select: text !important;',
          '  font-size: 16px !important;', /* Stops iOS auto-zoom on input focus */
          '}',
          /* Safe area insets so login screen content stays clear of Dynamic Island & Home Indicator */
          '.pagecode-login-page {',
          '  padding-top: max(1.5rem, calc(env(safe-area-inset-top, 44px) + 0.75rem)) !important;',
          '  padding-bottom: max(1.5rem, calc(env(safe-area-inset-bottom, 20px) + 0.75rem)) !important;',
          '  padding-left: max(1rem, env(safe-area-inset-left, 0px)) !important;',
          '  padding-right: max(1rem, env(safe-area-inset-right, 0px)) !important;',
          '  min-height: 100dvh !important;',
          '  box-sizing: border-box !important;',
          '}'
        ].join('');

        target.appendChild(style);
      } catch (err) {}
    }

    // 4. Dynamic Status Bar Theme Detector
    function detectTheme() {
      try {
        var path = ((window.location.pathname || '') + (window.location.search || '')).toLowerCase();
        var hasAuthTopbar = !!document.querySelector('.pagecode-auth-topbar');
        var hasAuthForm = !!document.querySelector('.pagecode-login-page') ||
                          !!document.querySelector('[class*="signup"]') ||
                          !!document.querySelector('[class*="register"]') ||
                          !!document.querySelector('form[action*="login"]') ||
                          !!document.querySelector('form[action*="signup"]') ||
                          !!document.querySelector('form[action*="register"]');
        var isAuthPath = path.indexOf('login') !== -1 ||
                         path.indexOf('signup') !== -1 ||
                         path.indexOf('register') !== -1 ||
                         path.indexOf('registo') !== -1 ||
                         path.indexOf('password') !== -1 ||
                         path.indexOf('auth') !== -1;

        var isLoginPage = hasAuthTopbar || hasAuthForm || isAuthPath;
        var isDark = isLoginPage;
        if (!isLoginPage && document.body) {
          var bg = window.getComputedStyle(document.body).backgroundColor;
          if (bg && (bg.indexOf('0, 0, 0') !== -1 || bg.indexOf('6, 18, 23') !== -1)) {
            isDark = true;
          }
        }
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'THEME_CHANGE',
            isDark: isDark,
            isLoginPage: isLoginPage
          }));
        }
      } catch (err) {}
    }

    applyViewport();
    applyNativeStyles();
    detectTheme();

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        applyViewport();
        applyNativeStyles();
        detectTheme();
      });
    }

    window.addEventListener('load', function () {
      applyViewport();
      applyNativeStyles();
      detectTheme();
    });

    // No MutationObserver here — observing the whole document while the page
    // boots posts theme messages on every node insert and can freeze WKWebView.

    return true;
  })();
`;

function isLoginUrl(url) {
  if (!url) return true;
  try {
    const path = url.split('?')[0].replace(/^https?:\/\/[^/]+/, '').toLowerCase().replace(/\/+$/, '') || '/';
    if (path.includes('dashboard') || path.includes('booking') || path.includes('client') || path.includes('aula') || path.includes('schedule')) {
      return false;
    }
    if (
      path === '/' ||
      path === '/login' ||
      path.includes('login') ||
      path.includes('signup') ||
      path.includes('register') ||
      path.includes('registo') ||
      path.includes('password') ||
      path.includes('auth')
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export default function WebViewScreen({ onInitialLoadComplete, onThemeChange }) {
  const screenRef = useRef(null);
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const [bottomExtension, setBottomExtension] = useState(0);
  const measureBottomSpace = useCallback(() => {
    // Keep Android's footer above the system gesture / three-button area.
    if (Platform.OS !== 'ios') { setBottomExtension(0); return; }
    // Measure the stable parent, not the extended WebView, so repeated layouts
    // cannot alternately add and remove the safe area.
    screenRef.current?.measureInWindow((_x, y, _width, height) => {
      const gap = windowHeight - y - height;
      // AppContent reserves 24px on iOS when the device reports no bottom inset.
      const reservedBottom = safeBottom > 0 ? safeBottom : (Platform.OS === 'ios' ? 24 : 0);
      setBottomExtension(gap > 0 && gap <= reservedBottom + 1 ? Math.min(gap, reservedBottom) : 0);
    });
  }, [windowHeight, safeBottom]);
  useEffect(() => {
    measureBottomSpace();
  }, [measureBottomSpace, windowWidth]);

  const webViewRef = useRef(null);
  const calendarHandler = useRef(null);
  if (!calendarHandler.current) calendarHandler.current = createCalendarMessageHandler(START_URL);
  const fitnessOAuthHandler = useRef(null);
  if (!fitnessOAuthHandler.current) fitnessOAuthHandler.current = createFitnessOAuthHandler(START_URL, Constants.expoConfig?.extra?.fitnessOAuthReturnUrl);
  const healthDocument = useRef({url: START_URL, version: 0});
  const accountWarnings=useRef(null);
  if(!accountWarnings.current)accountWarnings.current=createAccountLoginWarningHandler({base:START_URL,document:()=>healthDocument.current,
    show:(title,message,buttons)=>Alert.alert(title,message,buttons),inject:script=>webViewRef.current?.injectJavaScript(script)});
  const initialLoadFired = useRef(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [webViewUrl, setWebViewUrl, sourceRevision] = useWebViewSource(START_URL);
  const [classLinkRevision, setClassLinkRevision] = useState(0);
  const recovery=useWebViewRecovery(webViewRef,START_URL,setWebViewUrl);
  const navigateAuth=useCallback(url=>recovery.replace(url),[recovery.replace]);
  const nativeAuth=useNativeAuth(webViewRef,START_URL,navigateAuth);
  const navigateNativeClient=useCallback(url=>{
    let login=false;try{login=/^\/(?:site\/)?login\/?$/.test(new URL(url).pathname);}catch{}
    if(login)nativeAuth.open(url);else setWebViewUrl(url);
  },[nativeAuth.open]);
  const notifications = usePushNotifications(webViewRef, START_URL, setWebViewUrl);
  const nativeGym = useNativeGym(webViewRef, START_URL, navigateNativeClient);
  const clientBookings=useClientBookings(webViewRef,START_URL,nativeGym.data?.accountKey,!!nativeGym.data&&nativeGym.screen==='web'&&nativeGym.webSection==='bookings',nativeGym.data?.language);
  const nativeAdmin = useNativeAdmin(webViewRef, START_URL);
  const adminPages = useNativeAdminPages(webViewRef, START_URL, setWebViewUrl);
  const fitnessAccountKey=nativeGym.data?.accountKey||adminPages.document?.header?.accountKey;
  const workoutSync=useWorkoutSync(webViewRef,START_URL,fitnessAccountKey);
  const previousFitnessAccount=useRef(null);
  useEffect(()=>{
    if(nativeGym.data?.accountKey)offlinePass.save(nativeGym.data,new URL(START_URL).origin).catch(()=>{});
  },[nativeGym.data]);
  useEffect(()=>{
    if(/^[a-f0-9]{64}$/.test(fitnessAccountKey||''))SecureStore.setItemAsync('fitness-last-account',fitnessAccountKey).catch(()=>{});
    else if(previousFitnessAccount.current){SecureStore.deleteItemAsync('fitness-last-account').catch(()=>{});offlinePass.remove(previousFitnessAccount.current).catch(()=>{});}
    previousFitnessAccount.current=fitnessAccountKey;
  },[fitnessAccountKey]);
  const companyColor = useCompanyColor(COMPANY_APP.pagecode,
    adminPages.document?.header?.color || nativeGym.data?.company?.color, COMPANY_APP.color);
  const recoveryLabels=nativeGymTranslations(adminPages.document?.language||nativeGym.data?.language);

  useEffect(() => {
    let disposed = false;
    let receivedLink = false;
    const openClassLink = (url) => {
      const authTarget=authLinkTarget(url,SITE_URL);
      if(authTarget&&!disposed){nativeAuth.open(authTarget);return;}
      const target = classLinkTarget(url, SITE_URL);
      if (target && !disposed) {
        setWebViewUrl(target);
        // Opening the same class again must navigate even after browsing elsewhere in the WebView.
        setClassLinkRevision((revision) => revision + 1);
      }
    };
    const subscription = Linking.addEventListener('url', ({ url }) => {
      receivedLink = true;
      openClassLink(url);
    });
    Linking.getInitialURL().then((url) => {
      if (!receivedLink) openClassLink(url);
    }).catch(() => {});
    return () => { disposed = true; subscription.remove(); };
  }, []);

  const markReady = useCallback(() => {
    if (initialLoadFired.current) return;
    initialLoadFired.current = true;
    if (onInitialLoadComplete) onInitialLoadComplete();
  }, [onInitialLoadComplete]);
  useEffect(()=>{if(recovery.status!=='ready')markReady();},[recovery.status,markReady]);
  useEffect(()=>{if(nativeAuth.active&&!nativeAuth.checkingSession)markReady();},[nativeAuth.active,nativeAuth.checkingSession,markReady]);

  const handleLoadEnd = useCallback((syntheticEvent) => {
    if(!recovery.end(syntheticEvent?.nativeEvent?.url,recovery.revision))return;
    notifications.onLoadEnd(syntheticEvent);
    const finalUrl = syntheticEvent?.nativeEvent?.url;
    nativeAuth.onLoadEnd(finalUrl);
    if(nativeGym.data||isLoginUrl(finalUrl)||isClientDashboard(finalUrl,START_URL))nativeGym.onLoadEnd(syntheticEvent);
    clientBookings.onLoadEnd(finalUrl);
    nativeAdmin.onNavigation(finalUrl);
    webViewRef.current?.injectJavaScript(nativeAdmin.injectedScript);
    adminPages.onLoadEnd(finalUrl);
    // CONTENT_READY can reveal the form earlier; a finished document needs no fixed wait.
    markReady();
  }, [notifications.onLoadEnd, markReady, nativeAdmin.onNavigation, nativeAdmin.injectedScript, adminPages.onLoadEnd,recovery.end,recovery.revision,clientBookings.onLoadEnd,nativeGym.onLoadEnd,nativeAuth.onLoadEnd]);

  const onWebViewMessage = useCallback(async ({ nativeEvent }) => {
    if (!nativeEvent || typeof nativeEvent.data !== 'string') return;
    if(nativeAuth.onMessage(nativeEvent)){markReady();return;}
    if(recovery.message(nativeEvent)){markReady();return;}
    if(accountWarnings.current(nativeEvent))return;
    if(workoutSync.onMessage(nativeEvent))return;
    if(clientBookings.onMessage(nativeEvent))return;
    const adminEvent=adminPages.onMessage(nativeEvent);
    if (adminEvent) {
      if(adminEvent.documentRole==='client'&&!isClientDashboard(adminEvent.documentUrl,START_URL))nativeGym.onLoadEnd({nativeEvent:{...nativeEvent,url:adminEvent.documentUrl}});
      if(adminEvent.documentRole==='admin'&&nativeGym.data)nativeGym.suspendForAdmin();
      return;
    }
    if (nativeAdmin.onMessage(nativeEvent)) return;
    if (nativeEvent.data.length > 50000) return;
    if (nativeGym.onMessage(nativeEvent)) return;
    let message;
    try { message = JSON.parse(nativeEvent.data); } catch { return; }
    if (message.type === 'CONTENT_READY') {
      nativeGym.onAuthPageReady(nativeEvent.url);
      markReady();
      return;
    }
    if (message.type === 'THEME_CHANGE' && onThemeChange) {
      onThemeChange(message.isDark, message.isLoginPage);
      return;
    }
    if (message.type === 'sc.fitness.oauth') {
      const version = healthDocument.current.version;
      await fitnessOAuthHandler.current(message, nativeEvent.url || healthDocument.current.url, (reply) => {
        if (healthDocument.current.version === version && fitnessOAuthAllowed(healthDocument.current.url, START_URL)) {
          webViewRef.current?.injectJavaScript(fitnessOAuthReplyScript(reply));
        }
      });
      return;
    }
    if (message.type === 'sc.health') {
      const version = healthDocument.current.version;
      await handleHealthMessage(message, nativeEvent.url || healthDocument.current.url, START_URL, (reply) => {
        if (healthDocument.current.version === version && healthBridgeAllowed(healthDocument.current.url, START_URL)) {
          webViewRef.current?.injectJavaScript(healthReplyScript(reply));
        }
      });
      return;
    }
    if (message.type === 'gym.calendar.create') {
      if(isUserCalendarAction(message))await calendarHandler.current(message, nativeEvent.url || webViewUrl,fitnessAccountKey);
      return;
    }
    if (!trustedCalendarOrigin(nativeEvent.url || webViewUrl, START_URL)) return;
    notifications.onMessage(message);
  }, [markReady, notifications.onMessage, onThemeChange, webViewUrl, nativeGym.onMessage, nativeGym.onLoadEnd, nativeGym.onAuthPageReady, nativeGym.data, nativeGym.suspendForAdmin, nativeAdmin.onMessage, adminPages.onMessage,clientBookings.onMessage,workoutSync.onMessage,fitnessAccountKey,nativeAuth.onMessage]);

  const shouldRedirectToGymDashboard = useCallback((url) => {
    if (!url || url === GYM_DASHBOARD_URL) return false;

    const normalizedUrl = url.split('?')[0].replace(/\/$/, '');
    return normalizedUrl.endsWith(GYM_BOOKING_PATH);
  }, []);

  const redirectToGymDashboard = useCallback(() => {
    webViewRef.current?.stopLoading();
    setWebViewUrl(GYM_DASHBOARD_URL);
  }, []);

  const onAndroidBackPress = useCallback(() => {
    if(nativeAuth.active&&nativeAuth.kind!=='login'){nativeAuth.login();return true;}
    if (nativeAdmin.rosterOpen) { nativeAdmin.closeRoster(); return true; }
    if (nativeAdmin.screen === 'classes') { nativeAdmin.showDashboard(); return true; }
    if (adminPages.back()) return true;
    if (nativeGym.data) {
      if (nativeGym.screen === 'web' && nativeGym.webSection === 'bookings') return false;
      nativeGym.openWeb('bookings'); return true;
    }
    if (canGoBack) {
      webViewRef.current?.goBack();
      return true;
    }
    return false;
  }, [canGoBack, nativeGym.data, nativeGym.screen, nativeGym.webSection, nativeGym.openWeb,
    nativeAdmin.rosterOpen, nativeAdmin.closeRoster, nativeAdmin.screen, nativeAdmin.showDashboard, adminPages.back,nativeAuth.active,nativeAuth.kind,nativeAuth.login]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onAndroidBackPress
    );

    return () => subscription.remove();
  }, [onAndroidBackPress]);

  return (
  <View ref={screenRef} style={styles.container} onLayout={measureBottomSpace} collapsable={false}>
    <View style={nativeAuth.active?styles.authWeb:styles.container} pointerEvents={nativeAuth.active?'none':'auto'} accessibilityElementsHidden={nativeAuth.active} importantForAccessibility={nativeAuth.active?'no-hide-descendants':'auto'}>
    <NativeGymShell gym={nativeGym} bottomExtension={bottomExtension} brandColor={companyColor} bookings={clientBookings} sharing={nativeAdmin}>
    <NativeAdminFrame enabled={!nativeGym.data} pages={adminPages} admin={nativeAdmin} onBack={onAndroidBackPress} brandColor={companyColor}>
    <NativeAdminShell enabled={!nativeGym.data} admin={nativeAdmin} framed={!!adminPages.document} brandColor={companyColor} accountKey={fitnessAccountKey}>
    <WebView
      ref={webViewRef}
      key={`${webViewUrl}:${sourceRevision}:${classLinkRevision}:${recovery.revision}`}
      source={{ uri: webViewUrl }}
      style={styles.webView}
      containerStyle={styles.container}
      injectedJavaScript={appLanguageScript(START_URL) + nativeAuth.injectedScript + nativeGym.injectedScript + FITNESS_OAUTH_BRIDGE_SCRIPT + HEALTH_BRIDGE_SCRIPT + CALENDAR_BRIDGE_SCRIPT + SITE_OVERLAY_HIDE_SCRIPT + NATIVE_FEEL_SCRIPT + WEBVIEW_SCROLL_SCRIPT + (Platform.OS === 'ios' ? WEBVIEW_MODAL_SCRIPT : '') + nativeAdmin.injectedScript + positionRestoreScript(START_URL)}
      injectedJavaScriptBeforeContentLoaded={appLanguageScript(START_URL) + nativeAuth.injectedScript + nativeGym.injectedScript + FITNESS_OAUTH_BRIDGE_SCRIPT + HEALTH_BRIDGE_SCRIPT + CALENDAR_BRIDGE_SCRIPT + SITE_OVERLAY_HIDE_SCRIPT + NATIVE_FEEL_SCRIPT + WEBVIEW_SCROLL_SCRIPT + (Platform.OS === 'ios' ? WEBVIEW_MODAL_SCRIPT : '') + nativeAdmin.injectedScript + positionRestoreScript(START_URL)}
      onMessage={onWebViewMessage}
      onLoadStart={({ nativeEvent }) => { if(!recovery.start(nativeEvent.url,recovery.revision))return;nativeAuth.onNavigation(nativeEvent.url);clientBookings.onNavigation(nativeEvent.url);nativeGym.onNavigation(nativeEvent.url); nativeAdmin.onNavigation(nativeEvent.url); adminPages.onNavigation(nativeEvent.url); healthDocument.current = {url: nativeEvent.url || '', version: healthDocument.current.version + 1}; }}
      onLoadEnd={handleLoadEnd}
      onError={(syntheticEvent) => {
        const { nativeEvent } = syntheticEvent;
        nativeGym.onAuthLoadError(nativeEvent);
        nativeAuth.fail(nativeEvent);
        console.warn('[WebView] load error', nativeAuth.active?{code:nativeEvent?.code}:nativeEvent?.description || nativeEvent);
        recovery.error(nativeEvent||{},recovery.revision);
        markReady();
      }}
      onContentProcessDidTerminate={()=>recovery.terminated(recovery.revision)}
      onRenderProcessGone={()=>recovery.terminated(recovery.revision)}
      startInLoadingState={false}
      renderLoading={()=>null}
      renderError={()=>null}
      onHttpError={(syntheticEvent) => {
        nativeAuth.fail(syntheticEvent?.nativeEvent);
        nativeGym.onAuthLoadError(syntheticEvent?.nativeEvent);
        if (notifications.onHttpError(syntheticEvent)) return;
        console.warn('[WebView] HTTP error', syntheticEvent?.nativeEvent?.statusCode);
      }}
      scrollEnabled={true}
      nestedScrollEnabled={true}
      bounces={false}
      overScrollMode="never"
      scalesPageToFit={false}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      keyboardDisplayRequiresUserAction={true}
      setBuiltInZoomControls={false}
      displayZoomControls={false}
      originWhitelist={['*']}
      onShouldStartLoadWithRequest={(request) => {
        if (shouldRedirectToGymDashboard(request.url)) {
          redirectToGymDashboard();
          return false;
        }

        if(request.isTopFrame!==false)nativeAuth.onLocation(request.url);
        recovery.navigation(request);return true;
      }}
      onNavigationStateChange={(navState) => {
        recovery.location(navState.url,recovery.revision);
        nativeAuth.onLocation(navState.url);
        adminPages.onLocation(navState.url);
        healthDocument.current.url = navState.url || healthDocument.current.url;
        notifications.onNavigation(navState.url);
        setCanGoBack(navState.canGoBack);

        if (navState.url && onThemeChange) {
          const isLogin = isLoginUrl(navState.url);
          onThemeChange(isLogin, isLogin);
        }

        if (shouldRedirectToGymDashboard(navState.url)) {
          redirectToGymDashboard();
        }
      }}
      sharedCookiesEnabled={Platform.OS !== 'ios'}
      thirdPartyCookiesEnabled
      cacheEnabled
      incognito={false}
      geolocationEnabled
      javaScriptEnabled
      domStorageEnabled
      allowsBackForwardNavigationGestures
    />
    </NativeAdminShell>
    </NativeAdminFrame>
    </NativeGymShell>
    </View>
    {nativeAuth.active&&<NativeAuthScreen auth={nativeAuth} base={START_URL} color={/^#[a-f0-9]{6}$/i.test(nativeAuth.document?.color||'')?nativeAuth.document.color:companyColor}/>}
    {!nativeAuth.active&&recovery.status!=='ready'&&<View testID="webview-recovery" style={styles.recovery}>
      <Text style={styles.recoveryTitle}>{recovery.status==='recovering'?recoveryLabels.reconnecting:recoveryLabels.appLoadFailed}</Text>
      {recovery.status==='recovering'?<ActivityIndicator color={companyColor}/>:<>
        <Text style={styles.recoveryText}>{recoveryLabels.reconnectHelp}</Text>
        <Text selectable style={styles.recoveryText}>{recoveryLabels.errorReference}: {recovery.reference}</Text>
        <Pressable accessibilityRole="button" onPress={recovery.retry} style={[styles.retry,{backgroundColor:companyColor}]}><Text style={styles.retryText}>{recoveryLabels.retry}</Text></Pressable>
      </>}
    </View>}
    <NativeOfflineWorkouts base={START_URL} available={!fitnessAccountKey&&(nativeGym.bootstrapState==='failed'||recovery.status==='failed')} t={recoveryLabels} color={companyColor}/>
  </View>
);
}

const styles = StyleSheet.create({
  authWeb:{position:'absolute',left:-10000,top:0,width:'100%',height:'100%',opacity:0},
  recovery:{position:'absolute',top:0,right:0,bottom:0,left:0,zIndex:100,backgroundColor:'#fff',alignItems:'center',justifyContent:'center',padding:28,gap:18},
  recoveryTitle:{fontSize:23,fontWeight:'600',color:'#101828',textAlign:'center'},recoveryText:{fontSize:14,color:'#667085',textAlign:'center'},retry:{paddingVertical:14,paddingHorizontal:26,borderRadius:14,minHeight:48},retryText:{fontSize:16,fontWeight:'600',color:'#fff'},
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  webView: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});
