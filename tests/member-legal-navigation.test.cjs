const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{test}=require('node:test'),babel=require('@babel/core'),{JSDOM}=require('jsdom');
const exportsCore={};vm.runInNewContext(babel.transformSync(fs.readFileSync(require.resolve('../src/utils/nativeGymCore.js'),'utf8'),{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code,{exports:exportsCore,URL});
const base='https://c20260531125358085.specialcalendar.com';
const legal=`<main class="company-legal-page"><header class="company-legal-header"><a class="company-legal-logo-link" href="/site/login?pagecode=club"><img></a><a href="/site/login?pagecode=club">Voltar ao início de sessão</a></header><article class="company-legal-card"><h1>Privacy</h1><p>Legal text must remain intact.</p><nav class="public-legal-links"><a href="/privacy-policy?pagecode=club">Privacy</a><a href="/terms-and-conditions?pagecode=club">Terms</a><a href="/account-deletion/index?pagecode=club">Deletion</a></nav><div class="text-center mt-3"><a href="/site/login?pagecode=club">Voltar ao início de sessão</a></div></article></main>`;
function page(body,path,enabled=true,language='pt',app=true,origin=base){
 const dom=new JSDOM(`<html lang="${language}"><body>${body}</body></html>`,{url:origin+path,runScripts:'outside-only'});
 if(app)dom.window.ReactNativeWebView={};
 dom.window.__scNativeShellConfig={enabled};
 const before=dom.window.document.body.innerHTML;
 dom.window.eval(exportsCore.memberLegalNavigationScript(enabled,base));
 return {dom,doc:dom.window.document,before};
}
test('signed-in app legal pages hide the entire public footer without rewriting login links',()=>{
 for(const route of ['/privacy-policy?pagecode=club','/terms-and-conditions?pagecode=club','/account-deletion/index?pagecode=club'])for(const language of ['pt','en']){
  const p=page(legal,route,true,language);
  const back=p.doc.querySelector('.company-legal-card > div');
  assert.ok(back.hidden);assert.equal(back.style.getPropertyValue('display'),'none');assert.equal(back.style.getPropertyPriority('display'),'important');
  assert.equal(back.querySelector('a').getAttribute('href'),'/site/login?pagecode=club');
  assert.ok(p.doc.querySelector('.public-legal-links').hidden);
  assert.ok(p.doc.querySelector('.company-legal-header').hidden);
  assert.equal(p.doc.querySelector('article p').textContent,'Legal text must remain intact.');
  assert.deepEqual([...p.doc.querySelectorAll('.public-legal-links a')].map(a=>a.getAttribute('href')),['/privacy-policy?pagecode=club','/terms-and-conditions?pagecode=club','/account-deletion/index?pagecode=club']);
  p.dom.window.close();
 }
});
test('login, registration, public legal pages, ordinary browsers and foreign origins are unchanged',()=>{
 for(const [route,enabled,app,origin] of [['/login',true,true,base],['/form-signup',true,true,base],['/privacy-policy',false,true,base],['/privacy-policy',true,false,base],['/privacy-policy',true,true,'https://specialcalendar.com']]){
  const p=page(legal,route,enabled,'pt',app,origin);
  assert.equal(p.doc.body.innerHTML,p.before,route);p.dom.window.close();
 }
});
test('app settings groups legal documents under Privacy and keeps actual account deletion separate',()=>{
 const settings=`<section id="client-settings-account"><a class="client-settings-account-link" href="/profile">Profile</a><a class="client-settings-account-link" href="/privacy-policy?pagecode=club"><span>Política de privacidade</span></a></section><a id="delete" href="/profile/delete-account">Delete my account</a>`;
 const p=page(settings,'/client-settings');
 const group=p.doc.querySelector('details');assert.ok(group);assert.equal(group.open,false);
 assert.equal(group.querySelector('summary').textContent,'Política de privacidade');
 assert.deepEqual([...group.querySelectorAll('nav a')].map(a=>a.getAttribute('href')),[base+'/privacy-policy?pagecode=club&legal_context=member-settings',base+'/terms-and-conditions?pagecode=club&legal_context=member-settings',base+'/account-deletion/index?pagecode=club&legal_context=member-settings']);
 assert.equal(p.doc.querySelector('#delete').getAttribute('href'),'/profile/delete-account');
 p.dom.window.eval(exportsCore.memberLegalNavigationScript(true,base));assert.equal(p.doc.querySelectorAll('details').length,1);
 p.dom.window.close();
 const publicPage=page(settings,'/client-settings',false);assert.equal(publicPage.doc.body.innerHTML,publicPage.before);publicPage.dom.window.close();
});
