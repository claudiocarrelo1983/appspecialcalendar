import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

let NotificationsModule = undefined;
let handlerConfigured = false;

function getNotifications() {
  if (NotificationsModule !== undefined) return NotificationsModule;
  try {
    // Lazy require: a top-level import can abort the JS thread via RCTFatal
    // if native notification modules are missing or emit before the bridge is ready.
    // eslint-disable-next-line global-require
    NotificationsModule = require('expo-notifications');
  } catch (error) {
    console.warn('[PushNotifications] Native module unavailable:', error);
    NotificationsModule = null;
  }
  return NotificationsModule;
}

function configureNotificationHandler() {
  if (handlerConfigured) return;
  const Notifications = getNotifications();
  if (!Notifications?.setNotificationHandler) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    handlerConfigured = true;
  } catch (error) {
    console.warn('[PushNotifications] Failed to set notification handler:', error);
  }
}

export function notificationTarget(data, startUrl) {
  if (!data || typeof data.url !== 'string' || data.url.length > 4096) return null;
  try {
    const base = new URL(startUrl);
    const target = new URL(data.url, base);
    if (!['https:', 'http:'].includes(target.protocol) || target.origin !== base.origin || target.username || target.password) return null;
    return target.href;
  } catch {
    return null;
  }
}

export async function registerPushNotifications(requestPermission = false) {
  try {
    configureNotificationHandler();
    const Notifications = getNotifications();
    if (!Notifications) {
      return { permission: 'unavailable', canAskAgain: false, expoPushToken: null, error: 'notifications-unavailable' };
    }

    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'FTX Team',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
        });
      } catch (err) {
        console.warn('[PushNotifications] Failed to set notification channel:', err);
      }
    }
    let permission;
    try {
      permission = await Notifications.getPermissionsAsync();
    } catch (err) {
      console.warn('[PushNotifications] getPermissionsAsync failed:', err);
      permission = { status: 'undetermined', granted: false, canAskAgain: true };
    }
    if (!permission.granted && permission.canAskAgain && requestPermission) {
      try {
        permission = await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
      } catch (err) {
        console.warn('[PushNotifications] requestPermissionsAsync failed:', err);
      }
    }
    const allowed = permission.granted || (Platform.OS === 'ios' && [
      Notifications.IosAuthorizationStatus?.PROVISIONAL,
      Notifications.IosAuthorizationStatus?.EPHEMERAL,
    ].filter(Boolean).includes(permission.ios?.status));
    const state = { permission: permission.status, canAskAgain: permission.canAskAgain, expoPushToken: null };
    if (!allowed) return state;
    if (!Device.isDevice) return { ...state, error: 'physical-device-required' };
    const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return { ...state, error: 'missing-project-id' };
    try {
      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      return { ...state, expoPushToken: token.data };
    } catch {
      return { ...state, error: 'push-registration-failed' };
    }
  } catch {
    return { permission: 'unavailable', canAskAgain: false, expoPushToken: null, error: 'notifications-unavailable' };
  }
}

export function notificationStateScript(state, origin) {
  return `(function () {
    if (window.location.origin !== ${JSON.stringify(origin)}) return true;
    var state = ${JSON.stringify(state)};
    window.__specialCalendarNotifications = state;
    window.dispatchEvent(new CustomEvent('specialcalendar:notifications', { detail: state }));
    return true;
  })(); true;`;
}

export default function usePushNotifications(webViewRef, startUrl, onOpenUrl) {
  let origin = 'https://specialcalendar.com';
  try {
    origin = new URL(startUrl).origin;
  } catch {
    // Keep fallback
  }

  const currentUrl = useRef(startUrl);
  const state = useRef({ permission: 'undetermined', expoPushToken: null });
  const registration = useRef(null);

  const publish = useCallback(() => {
    try {
      if (new URL(currentUrl.current).origin !== origin) return;
      webViewRef.current?.injectJavaScript(notificationStateScript(state.current, origin));
    } catch { /* A navigation can finish after the WebView unmounts. */ }
  }, [origin, webViewRef]);

  const register = useCallback(async (requestPermission) => {
    if (registration.current) return registration.current;
    registration.current = registerPushNotifications(requestPermission).then((result) => {
      const previousToken = state.current.expoPushToken || state.current.previousExpoPushToken;
      state.current = { ...result, previousExpoPushToken: result.expoPushToken ? null : (previousToken || null) };
      publish();
      return result;
    }).catch(() => {
      return state.current;
    }).finally(() => { registration.current = null; });
    return registration.current;
  }, [publish]);

  useEffect(() => {
    let mounted = true;
    let responseSubscription = null;
    let tokenSubscription = null;
    let appSubscription = null;

    // Defer until after first paint so the RN bridge is fully up.
    const timer = setTimeout(() => {
      if (!mounted) return;
      try {
        configureNotificationHandler();
        const Notifications = getNotifications();
        if (!Notifications) {
          state.current = { permission: 'unavailable', canAskAgain: false, expoPushToken: null, error: 'notifications-unavailable' };
          publish();
          return;
        }

        const handled = new Set();
        const handleResponse = (response) => {
          if (!mounted || !response?.notification) return;
          const key = response.notification.request.identifier + ':' + response.actionIdentifier;
          if (handled.has(key)) return;
          handled.add(key);
          const url = notificationTarget(response.notification.request.content.data, startUrl);
          if (url) onOpenUrl(url);
          try {
            Notifications.clearLastNotificationResponseAsync?.().catch(() => {});
          } catch {}
        };

        try {
          responseSubscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
        } catch (err) {
          console.warn('[PushNotifications] addNotificationResponseReceivedListener failed:', err);
        }

        try {
          tokenSubscription = Notifications.addPushTokenListener(() => { register(false); });
        } catch (err) {
          console.warn('[PushNotifications] addPushTokenListener failed:', err);
        }

        try {
          appSubscription = AppState.addEventListener('change', (status) => {
            if (status === 'active') register(false);
          });
        } catch (err) {
          console.warn('[PushNotifications] AppState.addEventListener failed:', err);
        }

        try {
          Notifications.getLastNotificationResponseAsync?.().then(handleResponse).catch(() => {});
        } catch {}

        register(true).catch(() => {});
      } catch (err) {
        console.warn('[PushNotifications] Error in hook effect:', err);
      }
    }, 750);

    return () => {
      mounted = false;
      clearTimeout(timer);
      try { responseSubscription?.remove?.(); } catch {}
      try { tokenSubscription?.remove?.(); } catch {}
      try { appSubscription?.remove?.(); } catch {}
    };
  }, [onOpenUrl, publish, register, startUrl]);

  const onLoadEnd = useCallback((event) => {
    currentUrl.current = event.nativeEvent.url || startUrl;
    publish();
  }, [publish, startUrl]);

  const onNavigation = useCallback((url) => {
    currentUrl.current = url;
  }, []);

  const onMessage = useCallback((message) => {
    if (message?.version !== 1) return false;
    if (message.type === 'gym.notifications.request') {
      register(true);
      return true;
    }
    if (message.type === 'gym.notifications.status') {
      register(false);
      return true;
    }
    return false;
  }, [register]);

  return { onLoadEnd, onNavigation, onMessage };
}
