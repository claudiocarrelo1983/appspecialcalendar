const selectDomain = require('./config/select-domain.cjs');

module.exports = ({ config }) => {
  const app = selectDomain();
  return {
    ...config,
    name: app.title,
    scheme: `specialcalendar-${app.pagecode}`,
    icon: app.icon,
    // Keep updates for different installed company apps separate, even when
    // they share an EAS project and marketing version.
    runtimeVersion: `${config.version}-${app.appId}-health1-calendar1-oauth1-nativeui2-timeralerts2`,
    ios: {
      ...config.ios,
      bundleIdentifier: app.appId,
      googleServicesFile: app.iosGoogleServicesFile,
      associatedDomains: [`applinks:${app.domain}`],
      infoPlist: {
        ...config.ios.infoPlist,
        NSCameraUsageDescription: `A ${app.title} utiliza a câmara para tirar uma fotografia e atualizar a sua foto de perfil.`,
        NSPhotoLibraryUsageDescription: `A ${app.title} permite escolher uma fotografia da sua biblioteca para atualizar a sua foto de perfil.`,
        NSLocationWhenInUseUsageDescription: `A ${app.title} utiliza a sua localização enquanto usa a aplicação para confirmar o local dos registos de presença.`,
      },
    },
    android: {
      ...config.android,
      package: app.appId,
      googleServicesFile: app.androidGoogleServicesFile,
      intentFilters: [{
        autoVerify: true,
        action: 'VIEW',
        data: [{ scheme: 'https', host: app.domain, pathPrefix: '/dashboard-gym' }],
        category: ['BROWSABLE', 'DEFAULT'],
      }],
    },
    plugins: config.plugins.map(plugin => {
      if (!Array.isArray(plugin) || plugin[0] !== 'expo-splash-screen') return plugin;
      return [plugin[0], {
        ...plugin[1], image: app.splash,
        dark: { ...plugin[1].dark, image: app.splash },
      }];
    }).concat(['./plugins/with-health-tools.cjs', ['expo-calendar', {
      calendarPermission: 'Allow this app to add the class you choose to your calendar.',
      writeOnlyAccess: true,
      writeOnlyCalendarPermission: 'Allow this app to add the class you choose to your calendar.',
      remindersPermission: false,
    }]]),
    extra: {
      ...config.extra,
      eas: { ...config.extra?.eas, projectId: app.projectId },
      fontLicenses: require('./src/assets/fonts/licenses.json'),
      sharedMobileBase: 'native-gym-v2',
      companyBrandColor: app.brandColor,
      companyDomain: app.domain,
      companyPagecode: app.pagecode,
      siteUrl: app.siteUrl,
      fitnessOAuthReturnUrl: `specialcalendar-${app.pagecode}://fitness-oauth/callback`,
    },
  };
};
