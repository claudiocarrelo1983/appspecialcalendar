const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),selectDomain=require('../config/select-domain.cjs');
const files=['index.js','App.js','src/screens/WebViewScreen.js','src/screens/NativeGymShell.js',
  'src/screens/NativeAdminShell.js','src/utils/nativeAdminCore.js','src/utils/useNativeAdmin.js','src/utils/webViewPosition.js',
  'src/screens/NativeAdminFrame.js','src/screens/NativeAdminScanner.js','src/utils/nativeAdminPages.js','src/utils/useNativeAdminPages.js',
  'src/screens/NativeAdminHeader.js',
  'src/utils/nativeAdminNavigation.js',
  'src/screens/NativeWorkoutTimer.js','src/screens/NativeNotifications.js','src/screens/NativeBirthdays.js',
  'src/utils/useNativeGym.js','src/utils/usePushNotifications.js','src/utils/nativeGymCore.js',
  'src/utils/companyAppConfig.js','src/utils/nativeCompanyBranding.js','src/assets/gym-ui-theme.json'];
function validatePreviewProfiles(profiles=JSON.parse(fs.readFileSync(path.join(root,'eas.json'),'utf8')).build){
  function resolve(name,seen=[]){
    if(seen.includes(name))throw Error('Circular EAS profile inheritance.');
    const current=profiles[name];if(!current)throw Error('Missing profile '+name);
    const base=current.extends?resolve(current.extends,[...seen,name]):{};
    const result={...base,...current,env:{...base.env,...current.env},android:{...base.android,...current.android}};
    delete result.extends;return result;
  }
  function structure(name){
    const result=resolve(name);delete result.channel;
    delete result.env.APP_DOMAIN;delete result.env.EXPO_PUBLIC_SITE_URL;
    return result;
  }
  require('node:assert/strict').deepEqual(structure('preview-ftx'),structure('preview-demo'),
    'FTX and Demo previews must have identical build options except company URL/domain and channel.');
}
function validate(env=process.env){
  validatePreviewProfiles();
  const app=selectDomain(env),hash=crypto.createHash('sha256');
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  if(pkg.main!=='index.js')throw Error('All company builds must use the shared index.js entry point.');
  // Native projects skip Expo prebuild; missing raw sounds silently fall back to default.
  const raw=path.join(root,'android/app/src/main/res/raw');
  if(fs.existsSync(raw))for(const phase of ['work','rest','finished']){
    const name='gym_timer_'+phase+'.wav',source=fs.readFileSync(path.join(root,'src/assets/audio',name)),target=path.join(raw,name);
    if(!fs.existsSync(target)||!fs.readFileSync(target).equals(source))throw Error('Missing/outdated native timer sound: '+target+'. Sync native timer sound resources before building.');
  }
  for(const file of files){hash.update(file+'\0');hash.update(fs.readFileSync(path.join(root,file)));}
  for(const file of [app.icon,app.splash,app.androidGoogleServicesFile]){
    if(!fs.existsSync(path.join(root,file)))throw Error('Missing company asset: '+file);
  }
  const firebase=JSON.parse(fs.readFileSync(path.join(root,app.androidGoogleServicesFile),'utf8'));
  if(!firebase.client?.some(client=>client.client_info?.android_client_info?.package_name===app.appId))throw Error('Firebase configuration does not contain '+app.appId);
  return {base:'native-gym-v2',source:hash.digest('hex').slice(0,16),profile:env.EAS_BUILD_PROFILE||'local',
    name:app.title,package:app.appId,url:app.siteUrl,color:app.brandColor};
}
module.exports={validate,validatePreviewProfiles};
if(require.main===module)console.log('Company build checked: '+JSON.stringify(validate()));
