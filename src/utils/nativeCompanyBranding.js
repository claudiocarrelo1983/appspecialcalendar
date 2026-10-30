import companyAppConfig from './companyAppConfig';

const logos = {
  'c20261027151705426.specialcalendar.com': require('../assets/company-logo-default.png'),
  'c20260531125358085.specialcalendar.com': require('../assets/company-logo-ftx.png'),
};
export function companyLogoImage() {
  const {domain} = companyAppConfig();
  if (!logos[domain]) throw new Error('Missing bundled logo for configured company.');
  return logos[domain];
}
