let pending;

export function getPushInstallation() {
  if (!pending) pending = (async () => {
    const store = require('expo-secure-store');
    const crypto = require('expo-crypto');
    const key = 'specialcalendar.push.installation.v1';
    const saved = await store.getItemAsync(key);
    if (saved) {
      const identity = JSON.parse(saved);
      if (/^[a-f0-9]{32}$/.test(identity.installationId)
        && /^[a-f0-9]{64}$/.test(identity.installationSecret)) return identity;
      throw new Error('Invalid stored push installation');
    }
    const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    const identity = {
      installationId: hex(await crypto.getRandomBytesAsync(16)),
      installationSecret: hex(await crypto.getRandomBytesAsync(32)),
    };
    await store.setItemAsync(key, JSON.stringify(identity));
    return identity;
  })().catch(error => { pending = null; throw error; });
  return pending;
}

export function pushRegistrationScript(payload, id, origin) {
  const command = {version: 1, id, action: 'register', payload};
  return `(function () {
    if (window.location.origin !== ${JSON.stringify(origin)} || !window.SpecialCalendarPush) return true;
    window.SpecialCalendarPush.execute(${JSON.stringify(command)});
    return true;
  })(); true;`;
}
