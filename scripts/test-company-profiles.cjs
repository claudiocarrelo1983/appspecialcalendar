const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),{getConfig}=require('@expo/config');
const {validate}=require('./validate-company-build.cjs');
const eas=JSON.parse(fs.readFileSync(path.join(root,'eas.json'),'utf8'));
function profile(name){const current=eas.build[name];if(!current)throw Error('Missing profile '+name);const base=current.extends?profile(current.extends):{};return {...base,...current,env:{...base.env,...current.env}};}
let expected,source,globalStructure,checks=0;
const old={...process.env};
try{
  for(const name of ['preview-demo','preview-ftx','production-demo','production-ftx']){
    const selected=profile(name);
    process.env.APP_DOMAIN=selected.env.APP_DOMAIN;
    process.env.EXPO_PUBLIC_SITE_URL=selected.env.EXPO_PUBLIC_SITE_URL;
    process.env.EAS_BUILD_PROFILE=name;
    const result=validate(),c=getConfig(root).exp;
    assert.equal(c.extra.siteUrl,result.url);checks++;
    assert.equal(c.android.package,result.package);checks++;
    assert.equal(c.ios.bundleIdentifier,result.package);checks++;
    assert.equal(c.extra.companyBrandColor,result.color);checks++;
    assert.equal(c.extra.companyDomain,new URL(result.url).hostname);checks++;
    assert(c.runtimeVersion.includes('-nativeui2-timeralerts2'));checks++;
    assert(selected.channel.startsWith(name.endsWith('ftx')?'ftx-':'demo-'));checks++;
    const structure=JSON.stringify({main:JSON.parse(fs.readFileSync(path.join(root,'package.json'))).main,
      base:c.extra.sharedMobileBase,orientation:c.orientation,platforms:c.platforms,userInterfaceStyle:c.userInterfaceStyle,
      tablet:c.ios.supportsTablet,permissions:c.android.permissions,blocked:c.android.blockedPermissions,
      plugins:c.plugins.map(p=>Array.isArray(p)?p[0]:p)});
    if(expected){assert.equal(structure,expected,'Company profiles must not change functionality/structure');checks++;assert.equal(result.source,source,'All profiles must bundle the same source files');checks++;}
    // Compare every generated setting except explicit company branding/identity.
    const full=JSON.parse(JSON.stringify(c));
    for(const key of ['name','icon','scheme','runtimeVersion'])delete full[key];
    for(const key of ['package','googleServicesFile','intentFilters'])delete full.android[key];
    for(const key of ['bundleIdentifier','googleServicesFile','associatedDomains'])delete full.ios[key];
    for(const key of ['NSCameraUsageDescription','NSPhotoLibraryUsageDescription','NSLocationWhenInUseUsageDescription'])delete full.ios.infoPlist[key];
    for(const key of ['companyBrandColor','companyDomain','companyPagecode','siteUrl','fitnessOAuthReturnUrl'])delete full.extra[key];
    full.plugins=full.plugins.map(plugin=>{
      if(!Array.isArray(plugin)||plugin[0]!=='expo-splash-screen')return plugin;
      delete plugin[1].image;if(plugin[1].dark)delete plugin[1].dark.image;return plugin;
    });
    if(globalStructure)assert.deepEqual(full,globalStructure,'Company selection must not change app structure or plugin options');
    else globalStructure=full;
    checks++;
    expected=structure;source=result.source;
    console.log(JSON.stringify(result));
  }
  const defaultDomain=require('../config/default-domain.json').domain;
  for(const name of ['development','preview','production']){
    assert.equal(eas.build[name].env.APP_DOMAIN,defaultDomain);checks++;
    assert.equal(eas.build[name].env.EXPO_PUBLIC_SITE_URL,'https://'+defaultDomain);checks++;
  }
  const selectDomain=require('../config/select-domain.cjs');
  assert.throws(()=>selectDomain({APP_DOMAIN:'c20260531125358085.specialcalendar.com',EXPO_PUBLIC_SITE_URL:'https://c20261027151705426.specialcalendar.com'}));checks++;
  assert.throws(()=>selectDomain({EAS_BUILD_PROFILE:'preview-ftx'}));checks++;
  console.log('Shared company profiles: '+checks+' checks passed.');
  const peer=path.resolve(root,'..',path.basename(root)==='Demo'?'FTXTeam':'Demo');
  if(fs.existsSync(path.join(peer,'src')))require('./check-source-parity.cjs');
}finally{for(const key of ['APP_DOMAIN','EXPO_PUBLIC_SITE_URL','EAS_BUILD_PROFILE']){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}}
