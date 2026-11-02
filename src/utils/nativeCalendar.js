import { Alert, Linking, Platform } from 'react-native';
import { classLinkTarget } from './classLinks';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { CALENDAR_MESSAGE_TYPE, calendarEventFromMessage, trustedCalendarOrigin } from './calendarBridge';
import {fitnessCalendar} from './fitnessCalendar';
import {showCalendarFailure} from './calendarAlerts';

const available = !!requireOptionalNativeModule('ExpoCalendar');
export const CALENDAR_BRIDGE_SCRIPT = `window.__specialCalendarNativeCalendar = ${available}; true;\n`;

// Use the server's UTC event rather than reinterpreting club times on the phone.
export function createClassCalendarHandler(startUrl) {
  const native = createCalendarMessageHandler(startUrl);
  return async (item, language = 'en', accountKey) => {
    const message = { type: CALENDAR_MESSAGE_TYPE, version: 1, language, event: item.calendarEvent };
    calendarEventFromMessage(message);
    if (!classLinkTarget(item.calendarEvent.url, startUrl)) throw Error('Invalid class URL');
    if (available && (accountKey || Platform.OS==='ios')) return native(message, startUrl, accountKey);
    const url = new URL(item.calendarUrl, startUrl), base = new URL(startUrl);
    if (url.protocol !== 'https:' || url.username || url.password || !(
      (url.origin === 'https://calendar.google.com' && url.pathname === '/calendar/render') ||
      (url.origin === base.origin && url.pathname === '/gym-class-calendar/event')
    )) throw Error('Invalid calendar URL');
    await Linking.openURL(url.href);
    return true;
  };
}

export function createCalendarMessageHandler(startUrl) {
  let busy = false;
  return async (message, pageUrl, accountKey) => {
    if (message?.type !== CALENDAR_MESSAGE_TYPE) return false;
    if (!available || !trustedCalendarOrigin(pageUrl, startUrl) || busy) return true;
    busy = true;
    const portuguese = typeof message.language === 'string' && message.language.toLowerCase().startsWith('pt');
    const title = portuguese ? 'Adicionar ao calendário' : 'Add to calendar';
    try {
      const event = calendarEventFromMessage(message);
      if(accountKey){
        await fitnessCalendar(accountKey).add(event);
        Alert.alert(title,portuguese?'Aula adicionada. Pode consultar e eliminar em O meu calendário.':'Class added. View or delete it in My calendar.');
        return true;
      }
      // SDK 57's root exports intentionally throw for the old function names.
      // The supported legacy entry point opens EventKitUI without calendar reads.
      const calendar = require('expo-calendar/legacy');
      if (Number.parseInt(String(Platform.Version), 10) < 17) {
        const permission = await calendar.requestCalendarPermissionsAsync();
        if (!permission.granted) {
          throw Error('calendar_permission');
        }
      }
      // iOS 17+ shows the system Add Event form without asking to read calendars.
      // Saving or cancelling is always the user's choice in Apple's editor.
      await calendar.createEventInCalendarAsync(event);
    } catch (error) {
      showCalendarFailure(error,message.language);
    } finally { busy = false; }
    return true;
  };
}
