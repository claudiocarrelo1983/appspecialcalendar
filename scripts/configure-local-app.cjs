// Set the folder's default identity without changing the shared application code.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const domains = require('../config/app-domains.json');
const kind = process.argv[2];
const ids = { demo: 'com.demoteam.app', ftx: 'com.ftxteam.app' };
if (!ids[kind]) throw new Error('Usage: node scripts/configure-local-app.cjs demo|ftx');
const [domain, app] = Object.entries(domains).find(([, app]) => app.appId === ids[kind]);
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const write = (file, value) => fs.writeFileSync(path.join(root, file), JSON.stringify(value, null, 2) + '\n');
const settings = read('app.json');
const base = settings.expo;
base.name = app.title;
base.icon = app.icon;
base.scheme = `specialcalendar-${app.pagecode}`;
base.ios.bundleIdentifier = app.appId;
base.ios.googleServicesFile = app.iosGoogleServicesFile;
base.ios.associatedDomains = [`applinks:${domain}`];
base.ios.infoPlist.NSCameraUsageDescription = `A ${app.title} utiliza a câmara para tirar uma fotografia e atualizar a sua foto de perfil.`;
base.ios.infoPlist.NSPhotoLibraryUsageDescription = `A ${app.title} permite escolher uma fotografia da sua biblioteca para atualizar a sua foto de perfil.`;
base.ios.infoPlist.NSLocationWhenInUseUsageDescription = `A ${app.title} utiliza a sua localização enquanto usa a aplicação para confirmar o local dos registos de presença.`;
base.android.package = app.appId;
base.android.googleServicesFile = app.androidGoogleServicesFile;
base.android.intentFilters = [{ autoVerify: true, action: 'VIEW',
  data: [{ scheme: 'https', host: domain, pathPrefix: '/dashboard-gym' }],
  category: ['BROWSABLE', 'DEFAULT'] }];
base.plugins = base.plugins.map(plugin => {
  if (!Array.isArray(plugin) || plugin[0] !== 'expo-splash-screen') return plugin;
  return [plugin[0], { ...plugin[1], image: app.splash,
    dark: { ...plugin[1].dark, image: app.splash } }];
});
// Keep the EAS project already used for signing and installed builds.
base.extra.eas.projectId = app.projectId;
process.env.APP_DOMAIN = domain;
process.env.EXPO_PUBLIC_SITE_URL = `https://${domain}`;
base.runtimeVersion = require('../app.config.js')({ config: base }).runtimeVersion;
write('app.json', settings);
write('config/default-domain.json', { domain });
const eas = read('eas.json');
for (const name of ['development', 'preview', 'production']) {
  eas.build[name].env = { ...eas.build[name].env,
    APP_DOMAIN: domain, EXPO_PUBLIC_SITE_URL: `https://${domain}` };
  eas.build[name].channel = `${kind}-${name}`;
}
write('eas.json', eas);
fs.writeFileSync(path.join(root, 'BUILDING.txt'), [
  `${app.title} (${app.appId})`, `Website: https://${domain}`, '',
  'This folder defaults to this company for local development and EAS builds.',
  'npm start',
  'npx eas-cli@latest build --platform android --profile preview',
  'npx eas-cli@latest build --platform android --profile production',
  'npx eas-cli@latest build --platform ios --profile production --auto-submit-with-profile production', '',
  'The explicit demo/ftx profiles remain available for compatibility.',
  'After changing shared functionality, apply the same source changes to the other folder.', ''
].join('\n'));
console.log(`Configured ${app.title}: ${root}`);
