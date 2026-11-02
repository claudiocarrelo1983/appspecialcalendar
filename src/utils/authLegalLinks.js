// Public information only. Deletion still uses the website's authenticated
// confirmation flow; tapping this link never deletes or submits account data.
export function authLegalLinks(base,language='en') {
  const site=new URL(base);
  if(site.protocol!=='https:'||site.username||site.password||!/^c[0-9]+\.specialcalendar\.com$/.test(site.hostname))return [];
  const pt=language==='pt',pagecode=site.hostname.split('.')[0];
  return [
    ['privacy','/privacy-policy',pt?'Política de privacidade':'Privacy Policy'],
    ['terms','/terms-and-conditions',pt?'Termos e condições':'Terms and Conditions'],
    ['deletion','/account-deletion/index',pt?'Eliminação da conta e dos dados':'Account and Data Deletion'],
  ].map(([id,path,label])=>{const url=new URL(path,site);url.searchParams.set('pagecode',pagecode);return {id,label,url:url.href};});
}
