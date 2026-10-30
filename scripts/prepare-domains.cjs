const fs = require('node:fs');
const path = require('node:path');
const domains = require('../config/app-domains.json');
const selectDomain = require('../config/select-domain.cjs');
const root = path.join(__dirname, '..');
const branding = fs.readFileSync(path.join(root, 'src/utils/companyBranding.js'), 'utf8');
for (const domain of Object.keys(domains)) {
  const app = selectDomain({ APP_DOMAIN: domain });
  for (const asset of [app.icon, app.splash]) {
    if (!fs.existsSync(path.join(root, asset))) throw new Error(`Missing company asset: ${asset}`);
  }
  if (!branding.includes(`'${domain}': require(`)) {
    throw new Error(`Add the bundled splash image for ${domain} to src/utils/companyBranding.js.`);
  }
}
const target = path.join(root, 'deployment/domain-push/common/config/mobile-push-domains.json');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(domains, null, 2) + '\n');
console.log(`Prepared ${Object.keys(domains).length} company domains for mobile builds and website deployment.`);
