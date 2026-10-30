import { Alert, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { CALENDAR_MESSAGE_TYPE, calendarEventFromMessage, trustedCalendarOrigin } from './calendarBridge';

const available = Platform.OS === 'ios' && !!requireOptionalNativeModule('ExpoCalendar');
export const CALENDAR_BRIDGE_SCRIPT = `window.__specialCalendarNativeCalendar = ${available}; true;\n`;

export function createCalendarMessageHandler(startUrl) {
  let busy = false;
  return async (message, pageUrl) => {
    if (message?.type !== CALENDAR_MESSAGE_TYPE) return false;
    if (!available || !trustedCalendarOrigin(pageUrl, startUrl) || busy) return true;
    busy = true;
    const portuguese = typeof message.language === 'string' && message.language.toLowerCase().startsWith('pt');
    const title = portuguese ? 'Adicionar ao calendário' : 'Add to calendar';
    try {
      const event = calendarEventFromMessage(message);
      // SDK 57's root exports intentionally throw for the old function names.
      // The supported legacy entry point opens EventKitUI without calendar reads.
      const calendar = require('expo-calendar/legacy');
      if (Number.parseInt(String(Platform.Version), 10) < 17) {
        const permission = await calendar.requestCalendarPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(title, portuguese
            ? 'Permita o acesso ao Calendário nas definições do iPhone para adicionar esta aula.'
            : 'Allow Calendar access in iPhone Settings to add this class.');
          return true;
        }
      }
      // iOS 17+ shows the system Add Event form without asking to read calendars.
      // Saving or cancelling is always the user's choice in Apple's editor.
      await calendar.createEventInCalendarAsync(event);
    } catch (_) {
      Alert.alert(title, portuguese
        ? 'Não foi possível abrir o Calendário. Feche qualquer janela aberta e tente novamente.'
        : 'Could not open Calendar. Close any open dialog and try again.');
    } finally { busy = false; }
    return true;
  };
}
