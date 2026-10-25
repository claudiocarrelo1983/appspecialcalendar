import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { getNotifications } from './notificationModule';
import { getPushInstallation, pushRegistrationScript } from './pushInstallation';

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
    const Notifications = getNotifications();
    if (!Notifications) throw new Error('Notification module unavailable');
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('class-reminders', {
        name: 'FTX Team',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });
    }
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && permission.canAskAgain && requestPermission) {
      permission = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
    }
    const allowed = permission.granted || (Platform.OS === 'ios' && [
      Notifications.IosAuthorizationStatus.PROVISIONAL,
      Notifications.IosAuthorizationStatus.EPHEMERAL,
    ].includes(permission.ios?.status));
    const state = { permission: permission.status, permissionGranted: Boolean(allowed), canAskAgain: permission.canAskAgain, expoPushToken: null };
    if (!allowed) return state;
    const Device = require('expo-device');
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
  const origin = new URL(startUrl).origin;
  const currentUrl = useRef(startUrl);
  const state = useRef({ permission: 'undetermined', expoPushToken: null });
  const registration = useRef(null);
  const sequence = useRef(0);
  const pendingCommand = useRef(null);

  const syncWithServer = useCallback(async (result) => {
    try {
      if (new URL(currentUrl.current).origin !== origin) return;
      const token = result.expoPushToken || result.previousExpoPushToken;
      if (!token) return;
      // A native/network failure is not permission revocation. Do not disable a
      // known installation unless the OS explicitly reports denied permission.
      if (!result.expoPushToken && result.error && result.permission !== 'denied') return;
      const installation = await getPushInstallation();
      if (new URL(currentUrl.current).origin !== origin) return;
      const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
      const appId = Platform.OS === 'ios'
        ? Constants.expoConfig?.ios?.bundleIdentifier : Constants.expoConfig?.android?.package;
      if (!appId || !projectId) return;
      const id = `native-register-${Date.now()}-${++sequence.current}`;
      pendingCommand.current = id;
      webViewRef.current?.injectJavaScript(pushRegistrationScript({
        ...installation, appId, projectId, token, platform: Platform.OS,
        enabled: Boolean(result.expoPushToken),
      }, id, origin));
    } catch {
      // Never expose native credentials or tokens in logs or WebView status.
      state.current = {...state.current, registrationError: 'installation-unavailable'};
    }
  }, [origin, webViewRef]);

  const publish = useCallback(() => {
    try {
      if (new URL(currentUrl.current).origin !== origin) return;
      webViewRef.current?.injectJavaScript(notificationStateScript(state.current, origin));
    } catch { /* A navigation can finish after the WebView unmounts. */ }
  }, [origin, webViewRef]);

  const register = useCallback(async (requestPermission) => {
    if (registration.current) return registration.current;
    registration.current = registerPushNotifications(requestPermission).then(async (result) => {
      const previousToken = state.current.expoPushToken || state.current.previousExpoPushToken;
      const currentToken = result.expoPushToken || (result.permissionGranted ? previousToken : null);
      state.current = { ...result, expoPushToken: currentToken || null,
        previousExpoPushToken: currentToken ? null : (previousToken || null) };
      publish();
      await syncWithServer(state.current);
      return result;
    }).finally(() => { registration.current = null; });
    return registration.current;
  }, [publish, syncWithServer]);

  useEffect(() => {
    const Notifications = getNotifications();
    if (!Notifications) {
      register(false);
      return;
    }
    let mounted = true;
    const handled = new Set();
    const handleResponse = (response) => {
      if (!mounted || !response?.notification) return;
      const key = response.notification.request.identifier + ':' + response.actionIdentifier;
      if (handled.has(key)) return;
      handled.add(key);
      const url = notificationTarget(response.notification.request.content.data, startUrl);
      if (url) onOpenUrl(url);
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
    };
    const subscriptions = [];
    try {
      subscriptions.push(Notifications.addNotificationResponseReceivedListener(handleResponse));
      subscriptions.push(Notifications.addPushTokenListener(() => { register(false); }));
      subscriptions.push(AppState.addEventListener('change', (status) => {
        if (status === 'active') register(false);
      }));
      Promise.resolve(Notifications.getLastNotificationResponseAsync()).then(handleResponse).catch(() => {});
    } catch (error) {
      console.warn('Could not initialize notification listeners:', error);
    }
    register(true);
    return () => {
      mounted = false;
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [onOpenUrl, register, startUrl]);

  const onLoadEnd = useCallback((event) => {
    currentUrl.current = event.nativeEvent.url || startUrl;
    publish();
    syncWithServer(state.current);
  }, [publish, startUrl, syncWithServer]);

  const onNavigation = useCallback((url) => {
    currentUrl.current = url;
  }, []);

  const onMessage = useCallback((message) => {
    if (message?.version !== 1) return false;
    if (message.type === 'specialcalendar.push.ready') {
      syncWithServer(state.current);
      return true;
    }
    if (message.type === 'specialcalendar.push.result') {
      if (message.id === pendingCommand.current) pendingCommand.current = null;
      return true;
    }
    if (message.type === 'gym.notifications.request') {
      register(true);
      return true;
    }
    if (message.type === 'gym.notifications.status') {
      register(false);
      return true;
    }
    return false;
  }, [register, syncWithServer]);

  return { onLoadEnd, onNavigation, onMessage };
}
