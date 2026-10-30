import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

const native = requireOptionalNativeModule('SpecialCalendarHealth');
export const HEALTH_BRIDGE_SCRIPT = `window.__specialCalendarHealthBridge = {platform:${JSON.stringify(Platform.OS)}}; window.dispatchEvent(new Event("sc.health.ready")); true;\n`;
export function healthBridgeAllowed(url, startUrl) {
  try { const target = new URL(url); return target.origin === new URL(startUrl).origin && /^\/fitness-integrations(?:\/|$)/.test(target.pathname); }
  catch { return false; }
}
export async function handleHealthMessage(message, url, startUrl, reply) {
  if (message?.type !== 'sc.health') return false;
  if (!healthBridgeAllowed(url, startUrl) || message.version !== 1 || typeof message.requestId !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(message.requestId)) return true;
  const expected = Platform.OS === 'ios' ? 'apple_health' : Platform.OS === 'android' ? 'health_connect' : null;
  const operations = ['status', 'connect', 'sync', 'disconnect'];
  if (!operations.includes(message.operation) || message.provider !== expected || !native) {
    reply({requestId: message.requestId, error: 'native_unavailable'}); return true;
  }
  try {
    const days = Number(message.days);
    if (message.operation === 'sync' && ![7, 30, 90].includes(days)) throw new Error('invalid_data');
    const data = message.operation === 'sync' ? await native.sync(days) : await native[message.operation]();
    reply({requestId: message.requestId, data});
  } catch (error) {
    const code = String(error?.code || error?.message || 'native_unavailable');
    reply({requestId: message.requestId, error: ['permission', 'sync_limit', 'invalid_data', 'busy'].includes(code) ? code : 'native_unavailable'});
  }
  return true;
}
export function healthReplyScript(value) {
  const json = JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return `window.dispatchEvent(new CustomEvent('sc.health.result',{detail:${json}}));true;`;
}
