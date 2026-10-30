import Constants from 'expo-constants';

// One application, configured by the selected EAS profile. Company configuration
// may change branding and origin; it must never select a different set of screens.
export function configuredCompany(extra) {
  if (!extra || typeof extra.companyDomain !== 'string' || typeof extra.siteUrl !== 'string') {
    throw new Error('Missing company build configuration. Use a company EAS profile.');
  }
  const url = new URL(extra.siteUrl);
  if (url.protocol !== 'https:' || url.hostname !== extra.companyDomain || url.port || url.username || url.password
      || !/^c[0-9]+\.specialcalendar\.com$/.test(url.hostname) || url.pathname !== '/' || url.search || url.hash
      || extra.companyPagecode !== url.hostname.split('.')[0]) {
    throw new Error('Company URL and pagecode do not match the selected build profile.');
  }
  return {domain:url.hostname, siteUrl:url.origin, pagecode:extra.companyPagecode,
    color:/^#[a-f0-9]{6}$/i.test(extra.companyBrandColor||'') ? extra.companyBrandColor : '#0d6efd'};
}
export default function companyAppConfig() {
  return configuredCompany(Constants.expoConfig?.extra);
}
