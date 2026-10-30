const domains = require('./app-domains.json');
const DEFAULT_DOMAIN = require('./default-domain.json').domain;

module.exports = function selectDomain(env = process.env) {
  const site = env.EXPO_PUBLIC_SITE_URL ? new URL(env.EXPO_PUBLIC_SITE_URL) : null;
  const domain = env.APP_DOMAIN || site?.hostname || DEFAULT_DOMAIN;
  if (env.EAS_BUILD_PROFILE && env.EAS_BUILD_PROFILE !== 'development' && !env.APP_DOMAIN && !site) {
    throw new Error('A company EAS profile must set EXPO_PUBLIC_SITE_URL or APP_DOMAIN.');
  }
  if (!Object.prototype.hasOwnProperty.call(domains, domain)) {
    throw new Error(`No app configuration for domain: ${domain}`);
  }
  if (site && (site.origin !== `https://${domain}` || site.pathname !== '/' || site.search || site.hash)) {
    throw new Error('APP_DOMAIN and EXPO_PUBLIC_SITE_URL must identify the same HTTPS company domain.');
  }
  const app = domains[domain];
  if (!/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/i.test(app.appId || '')
      || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(app.projectId || '')
      || !['title', 'icon', 'splash', 'androidGoogleServicesFile', 'iosGoogleServicesFile']
        .every(key => typeof app[key] === 'string' && app[key].length > 0)) {
    throw new Error(`Incomplete app configuration for domain: ${domain}`);
  }
  if (domain !== `${app.pagecode}.specialcalendar.com`) {
    throw new Error(`Company pagecode does not match domain: ${domain}`);
  }
  if (!/^#[a-f0-9]{6}$/i.test(app.brandColor || '')) throw new Error(`Missing company brand color: ${domain}`);
  return { ...app, domain, siteUrl: `https://${domain}` };
};
