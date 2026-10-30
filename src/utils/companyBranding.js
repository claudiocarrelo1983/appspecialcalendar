import companyAppConfig from './companyAppConfig';

// Metro requires literal asset paths. Add a local splash here when adding a domain.
const splashImages = {
  'c20261027151705426.specialcalendar.com': require('../../assets/logo/specialcalendar-splash.png'),
  'c20260531125358085.specialcalendar.com': require('../../assets/logo/ftx-splash.png'),
};

export function companySplashImage() {
  const domain = companyAppConfig().domain;
  if (!splashImages[domain]) throw new Error('Missing splash image for configured company domain.');
  return splashImages[domain];
}
