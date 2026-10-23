import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import usePushNotifications from '../utils/usePushNotifications';
import { trustedCalendarOrigin } from '../utils/calendarBridge';

const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || 'https://c20260531125358085.specialcalendar.com').replace(/\/$/, '');
const START_URL = `${SITE_URL}/`;
const GYM_BOOKING_PATH = '/c20260531125358085/booking';
const GYM_DASHBOARD_URL = `${SITE_URL}/dashboard-gym`;
const CALENDAR_BRIDGE_SCRIPT = 'window.__specialCalendarNativeCalendar = false; true;\n';
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
        ].join('\\n')));
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
    // 1. WebKit Engine Gesture & Multi-Touch Zoom Prevention
    function preventZoomGesture(e) {
      if (e.preventDefault) e.preventDefault();
    }

    try {
      window.addEventListener('gesturestart', preventZoomGesture, { passive: false, capture: true });
      window.addEventListener('gesturechange', preventZoomGesture, { passive: false, capture: true });
      window.addEventListener('gestureend', preventZoomGesture, { passive: false, capture: true });
      document.addEventListener('gesturestart', preventZoomGesture, { passive: false, capture: true });
      document.addEventListener('gesturechange', preventZoomGesture, { passive: false, capture: true });
      document.addEventListener('gestureend', preventZoomGesture, { passive: false, capture: true });
    } catch (err) {}

    function handleTouchMulti(e) {
      if (e.touches && e.touches.length > 1) {
        if (e.preventDefault) e.preventDefault();
      }
    }

    try {
      window.addEventListener('touchstart', handleTouchMulti, { passive: false, capture: true });
      window.addEventListener('touchmove', handleTouchMulti, { passive: false, capture: true });
      document.addEventListener('touchstart', handleTouchMulti, { passive: false, capture: true });
      document.addEventListener('touchmove', handleTouchMulti, { passive: false, capture: true });
    } catch (err) {}

    // Prevent double-tap to zoom
    var lastTouchEnd = 0;
    try {
      document.addEventListener('touchend', function (e) {
        var now = Date.now();
        if (now - lastTouchEnd <= 300) {
          if (e.preventDefault) e.preventDefault();
        }
        lastTouchEnd = now;
      }, { passive: false, capture: true });
    } catch (err) {}

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
          '  touch-action: pan-x pan-y !important;',
          '  -webkit-text-size-adjust: 100% !important;',
          '  -webkit-overflow-scrolling: touch;',
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
        ].join('\\n');

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
const GYM_REDIRECT_SCRIPT = `
  (function () {
    if (window.__gymRedirectInstalled) return true;
    window.__gymRedirectInstalled = true;

    var dashboardUrl = '${GYM_DASHBOARD_URL}';
    var dashboardPath = '/dashboard-gym';

    function normalize(value) {
      return String(value || '').trim().toLowerCase();
    }

    function readStoredValue(names) {
      var queryParams = new URLSearchParams(window.location.search);
      var stores = [window.sessionStorage, window.localStorage];

      for (var i = 0; i < names.length; i += 1) {
        var queryValue = queryParams.get(names[i]);
        if (queryValue) return queryValue;
      }

      for (var j = 0; j < stores.length; j += 1) {
        var store = stores[j];
        if (!store) continue;

        for (var k = 0; k < names.length; k += 1) {
          var directValue = store.getItem(names[k]);
          if (directValue) return directValue;
        }

        for (var index = 0; index < store.length; index += 1) {
          try {
            var itemValue = store.getItem(store.key(index));
            var parsedValue = JSON.parse(itemValue);

            for (var nameIndex = 0; nameIndex < names.length; nameIndex += 1) {
              var nestedValue = parsedValue && parsedValue[names[nameIndex]];
              if (nestedValue !== undefined && nestedValue !== null && nestedValue !== '') {
                return nestedValue;
              }
            }
          } catch (error) {
            continue;
          }
        }
      }

      return '';
    }

    function readObjectValue(names) {
      var sources = [
        window.user,
        window.currentUser,
        window.authUser,
        window.loggedUser,
        window.appUser
      ];

      for (var i = 0; i < sources.length; i += 1) {
        var source = sources[i];
        if (!source) continue;

        for (var j = 0; j < names.length; j += 1) {
          var value = source[names[j]];
          if (value !== undefined && value !== null && value !== '') return value;
        }
      }

      return '';
    }

    function readCookieValue(names) {
      var cookies = document.cookie ? document.cookie.split('; ') : [];

      for (var i = 0; i < cookies.length; i += 1) {
        var parts = cookies[i].split('=');
        var name = decodeURIComponent(parts.shift() || '');

        if (names.indexOf(name) !== -1) {
          return decodeURIComponent(parts.join('=') || '');
        }
      }

      return '';
    }

    function readValue(names) {
      return (
        readStoredValue(names) ||
        readObjectValue(names) ||
        readCookieValue(names)
      );
    }

    function shouldRedirect() {
      var level = normalize(readValue(['level', 'user_level', 'userLevel', 'role', 'user_role', 'userRole']));
      return level === 'gym';
    }

    function redirectGym() {
      if (window.location.pathname === dashboardPath) return;
      if (shouldRedirect()) window.location.replace(dashboardUrl);
    }

    redirectGym();
    window.addEventListener('load', redirectGym);
    setTimeout(redirectGym, 500);
    setTimeout(redirectGym, 1500);

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
  const webViewRef = useRef(null);
  const initialLoadFired = useRef(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState(START_URL);
  const notifications = usePushNotifications(webViewRef, START_URL, setWebViewUrl);

  const markReady = useCallback(() => {
    if (initialLoadFired.current) return;
    initialLoadFired.current = true;
    if (onInitialLoadComplete) onInitialLoadComplete();
  }, [onInitialLoadComplete]);

  const handleLoadEnd = useCallback((syntheticEvent) => {
    notifications.onLoadEnd(syntheticEvent);
    // Fallback only — prefer CONTENT_READY from the page after overlay is gone.
    setTimeout(markReady, 2500);
  }, [notifications.onLoadEnd, markReady]);

  const onWebViewMessage = useCallback(async ({ nativeEvent }) => {
    if (!nativeEvent || typeof nativeEvent.data !== 'string' || nativeEvent.data.length > 50000) return;
    let message;
    try { message = JSON.parse(nativeEvent.data); } catch { return; }
    if (message.type === 'CONTENT_READY') {
      markReady();
      return;
    }
    if (message.type === 'THEME_CHANGE' && onThemeChange) {
      onThemeChange(message.isDark, message.isLoginPage);
      return;
    }
    if (!trustedCalendarOrigin(nativeEvent.url || webViewUrl, START_URL)) return;
    notifications.onMessage(message);
  }, [markReady, notifications.onMessage, onThemeChange, webViewUrl]);

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
    if (canGoBack) {
      webViewRef.current?.goBack();
      return true;
    }
    return false;
  }, [canGoBack]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onAndroidBackPress
    );

    return () => subscription.remove();
  }, [onAndroidBackPress]);

  return (
  <View style={styles.container}>
    <WebView
      ref={webViewRef}
      key={webViewUrl}
      source={{ uri: webViewUrl }}
      style={styles.webView}
      containerStyle={styles.container}
      injectedJavaScript={CALENDAR_BRIDGE_SCRIPT + SITE_OVERLAY_HIDE_SCRIPT + GYM_REDIRECT_SCRIPT + NATIVE_FEEL_SCRIPT}
      injectedJavaScriptBeforeContentLoaded={CALENDAR_BRIDGE_SCRIPT + SITE_OVERLAY_HIDE_SCRIPT + GYM_REDIRECT_SCRIPT + NATIVE_FEEL_SCRIPT}
      onMessage={onWebViewMessage}
      onLoadEnd={handleLoadEnd}
      onError={(syntheticEvent) => {
        const { nativeEvent } = syntheticEvent;
        console.warn('[WebView] load error', nativeEvent?.description || nativeEvent);
        markReady();
      }}
      onHttpError={(syntheticEvent) => {
        console.warn('[WebView] HTTP error', syntheticEvent?.nativeEvent?.statusCode);
      }}
      bounces={false}
      overScrollMode="never"
      scalesPageToFit={false}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      setBuiltInZoomControls={false}
      displayZoomControls={false}
      originWhitelist={['*']}
      onShouldStartLoadWithRequest={(request) => {
        if (shouldRedirectToGymDashboard(request.url)) {
          redirectToGymDashboard();
          return false;
        }

        return true;
      }}
      onNavigationStateChange={(navState) => {
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
      sharedCookiesEnabled
      thirdPartyCookiesEnabled
      cacheEnabled
      incognito={false}
      geolocationEnabled
      javaScriptEnabled
      domStorageEnabled
      allowsBackForwardNavigationGestures
    />
  </View>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  webView: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});
