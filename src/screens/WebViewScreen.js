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
const NATIVE_FEEL_SCRIPT = `
  (function () {
    if (window.__nativeFeelInstalled) return true;
    window.__nativeFeelInstalled = true;

    // Enforce native viewport: fit to screen and disable user pinch-to-zoom
    var meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'viewport';
      document.head.appendChild(meta);
    }
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

    // Inject CSS to eliminate web-like artifacts
    var style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = [
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
      '}',
      'html, body {',
      '  -webkit-overflow-scrolling: touch;',
      '  touch-action: manipulation;',
      '  overscroll-behavior-y: none;',
      '}'
    ].join('\\n');

    if (document.head) {
      document.head.appendChild(style);
    } else {
      document.addEventListener('DOMContentLoaded', function () {
        if (document.head) document.head.appendChild(style);
      });
    }

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

export default function WebViewScreen({ onInitialLoadComplete }) {
  const webViewRef = useRef(null);
  const initialLoadFired = useRef(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState(START_URL);
  const notifications = usePushNotifications(webViewRef, START_URL, setWebViewUrl);

  const handleLoadEnd = useCallback((syntheticEvent) => {
    notifications.onLoadEnd(syntheticEvent);
    if (!initialLoadFired.current) {
      initialLoadFired.current = true;
      if (onInitialLoadComplete) {
        onInitialLoadComplete();
      }
    }
  }, [notifications.onLoadEnd, onInitialLoadComplete]);

  const onWebViewMessage = useCallback(async ({ nativeEvent }) => {
    if (!trustedCalendarOrigin(nativeEvent.url, START_URL) || typeof nativeEvent.data !== 'string' || nativeEvent.data.length > 50000) return;
    let message;
    try { message = JSON.parse(nativeEvent.data); } catch { return; }
    notifications.onMessage(message);
  }, [notifications.onMessage]);

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
      injectedJavaScript={CALENDAR_BRIDGE_SCRIPT + GYM_REDIRECT_SCRIPT + NATIVE_FEEL_SCRIPT}
      injectedJavaScriptBeforeContentLoaded={CALENDAR_BRIDGE_SCRIPT + GYM_REDIRECT_SCRIPT + NATIVE_FEEL_SCRIPT}
      onMessage={onWebViewMessage}
      onLoadEnd={handleLoadEnd}
      bounces={false}
      overScrollMode="never"
      scalesPageToFit={false}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      setBuiltInZoomControls={false}
      displayZoomControls={false}
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
    backgroundColor: '#fff',
  },
});
