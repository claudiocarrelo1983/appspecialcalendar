const fs = require('node:fs');
const path = require('node:path');
const selectDomain = require('./config/select-domain.cjs');

module.exports = ({ config }) => {
  const app = selectDomain();
  const root = path.resolve(__dirname);
  const iosGoogleServices = app.iosGoogleServicesFile && fs.existsSync(path.join(root, app.iosGoogleServicesFile)) ? app.iosGoogleServicesFile : undefined;
  const androidGoogleServices = app.androidGoogleServicesFile && fs.existsSync(path.join(root, app.androidGoogleServicesFile)) ? app.androidGoogleServicesFile : undefined;

  const iosConfig = { ...config.ios };
  if (iosGoogleServices) {
    iosConfig.googleServicesFile = iosGoogleServices;
  } else {
    delete iosConfig.googleServicesFile;
  }

  const androidConfig = { ...config.android };
  if (androidGoogleServices) {
    androidConfig.googleServicesFile = androidGoogleServices;
  } else {
    delete androidConfig.googleServicesFile;
  }

  return {
    ...config,
    name: app.title,
    scheme: `specialcalendar-${app.pagecode}`,
    icon: app.icon,
    // Keep updates for different installed company apps separate, even when
    // they share an EAS project and marketing version.
    runtimeVersion: `${config.version}-${app.appId}-health1-calendar1-oauth1-nativeui2-timeralerts3-adminui4-mobile1-branding1-camera1-clipboard1-fitness4-healthauto1-auth1`,
    ios: {
      ...iosConfig,
      bundleIdentifier: app.appId,
      associatedDomains: [`applinks:${app.domain}`],
      infoPlist: {
        ...config.ios.infoPlist,
        NSCameraUsageDescription: `A ${app.title} utiliza a câmara para ler o QR dos sócios e atualizar a foto de perfil.`,
        NSPhotoLibraryUsageDescription: `A ${app.title} permite escolher uma fotografia da sua biblioteca para atualizar a sua foto de perfil.`,
        NSLocationWhenInUseUsageDescription: `A ${app.title} utiliza a sua localização enquanto usa a aplicação para confirmar o local dos registos de presença.`,
      },
    },
    android: {
      ...androidConfig,
      blockedPermissions:(config.android.blockedPermissions||[]).filter(permission=>!['android.permission.READ_CALENDAR','android.permission.WRITE_CALENDAR'].includes(permission)),
      permissions:[...new Set([...(config.android.permissions||[]),'android.permission.SCHEDULE_EXACT_ALARM'])],
      package: app.appId,
      intentFilters: [{
        autoVerify: true,
        action: 'VIEW',
        data: ['/dashboard-gym','/login','/site/login','/form-signup','/request-password-reset','/site/request-password-reset','/reset-password','/site/reset-password',`/${app.pagecode}/login`,`/${app.pagecode}/request-password-reset`,`/${app.pagecode}/reset-password`].map(pathPrefix=>({scheme:'https',host:app.domain,pathPrefix})),
        category: ['BROWSABLE', 'DEFAULT'],
      }],
    },
    plugins: config.plugins.map(plugin => {
      if (!Array.isArray(plugin) || plugin[0] !== 'expo-splash-screen') return plugin;
      return [plugin[0], {
        ...plugin[1], image: app.splash,
        dark: { ...plugin[1].dark, image: app.splash },
      }];
    }).concat(['./plugins/with-health-tools.cjs','./plugins/with-workout-activity.cjs', ['expo-calendar', {
      calendarPermission: 'Allow this app to add fitness events and view or delete only the events it added to your calendar.',
      writeOnlyAccess: false,
      writeOnlyCalendarPermission: 'Allow this app to add the class you choose to your calendar.',
      remindersPermission: false,
    }], ['expo-camera', {
      cameraPermission: `A ${app.title} utiliza a câmara para ler o QR dos sócios e atualizar a foto de perfil.`,
      recordAudioAndroid: false,
      microphonePermission: false,
      barcodeScannerEnabled: true,
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
