import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Platform, StyleSheet, View } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { WebView } from 'react-native-webview';
import usePushNotifications from '../utils/usePushNotifications';
import { CALENDAR_MESSAGE_TYPE, calendarEventFromMessage, trustedCalendarOrigin } from '../utils/calendarBridge';

const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || 'https://c20260531125358085.specialcalendar.com').replace(/\/$/, '');
const START_URL = `${SITE_URL}/`;
const GYM_BOOKING_PATH = '/c20260531125358085/booking';
const GYM_DASHBOARD_URL = `${SITE_URL}/dashboard-gym`;
const NATIVE_CALENDAR_AVAILABLE = Boolean(requireOptionalNativeModule('ExpoCalendar'));
const CALENDAR_BRIDGE_SCRIPT = `window.__specialCalendarNativeCalendar = ${NATIVE_CALENDAR_AVAILABLE}; true;\n`;
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

export default function WebViewScreen() {
  const webViewRef = useRef(null);
  const calendarDialogOpen = useRef(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState(START_URL);
  const notifications = usePushNotifications(webViewRef, START_URL, setWebViewUrl);

  const onWebViewMessage = useCallback(async ({ nativeEvent }) => {
    if (!trustedCalendarOrigin(nativeEvent.url, START_URL) || typeof nativeEvent.data !== 'string' || nativeEvent.data.length > 50000) return;
    let message;
    try { message = JSON.parse(nativeEvent.data); } catch { return; }
    if (notifications.onMessage(message)) return;
    if (message?.type !== CALENDAR_MESSAGE_TYPE || calendarDialogOpen.current) return;
    const portuguese = String(message.language || '').toLowerCase().startsWith('pt');
    calendarDialogOpen.current = true;
    try {
      const event = calendarEventFromMessage(message);
      if (!NATIVE_CALENDAR_AVAILABLE) throw new Error('Calendar module unavailable');
      const Calendar = require('expo-calendar');
      if (Platform.OS === 'ios' && parseInt(String(Platform.Version), 10) < 17) {
        const permission = await Calendar.requestCalendarPermissionsAsync();
        if (permission.status !== 'granted') {
          Alert.alert(portuguese ? 'Calendário' : 'Calendar', portuguese
            ? 'Permite o acesso ao calendário nas definições da aplicação para adicionar a aula.'
            : 'Allow calendar access in the app settings to add this class.');
          return;
        }
      }
      await Calendar.createEventInCalendarAsync(event);
    } catch {
      Alert.alert(portuguese ? 'Calendário' : 'Calendar', portuguese
        ? 'Não foi possível abrir o calendário. Confirma que tens uma aplicação de calendário instalada e a versão mais recente desta app.'
        : 'Could not open the calendar. Check that a calendar app is installed and that this app is up to date.');
    } finally {
      calendarDialogOpen.current = false;
    }
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
      injectedJavaScript={CALENDAR_BRIDGE_SCRIPT + GYM_REDIRECT_SCRIPT}
      injectedJavaScriptBeforeContentLoaded={CALENDAR_BRIDGE_SCRIPT + GYM_REDIRECT_SCRIPT}
      onMessage={onWebViewMessage}
      onLoadEnd={notifications.onLoadEnd}
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
