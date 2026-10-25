const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test');
const babel=require('@babel/core');
function load(name,mocks){
 const code=babel.transformSync(fs.readFileSync(path.join(__dirname,'../src/utils',name),'utf8'),{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code;
 const exports={};vm.runInNewContext(code,{exports,URL,console:{warn(){}},require(name){assert.ok(mocks[name],`Unexpected dependency: ${name}`);return mocks[name];}});return exports;
}
test('installation identity is cryptographically generated once and stored only in native secure storage',async()=>{
 let saved=null,writes=0,randomCalls=0;
 const module=load('pushInstallation.js',{'expo-secure-store':{getItemAsync:async()=>saved,setItemAsync:async(key,value)=>{saved=value;writes++;}},'expo-crypto':{getRandomBytesAsync:async size=>{randomCalls++;return new Uint8Array(size).fill(randomCalls);}}});
 const [a,b]=await Promise.all([module.getPushInstallation(),module.getPushInstallation()]);
 assert.equal(a,b);assert.match(a.installationId,/^[a-f0-9]{32}$/);assert.match(a.installationSecret,/^[a-f0-9]{64}$/);assert.equal(writes,1);assert.equal(randomCalls,2);
 const restored=load('pushInstallation.js',{'expo-secure-store':{getItemAsync:async()=>saved},'expo-crypto':{}});
 assert.equal((await restored.getPushInstallation()).installationSecret,a.installationSecret);
});
test('registration injection only runs on the trusted document origin',()=>{
 const module=load('pushInstallation.js',{});const calls=[];
 const code=module.pushRegistrationScript({installationSecret:'synthetic-secret'},'request-one','https://specialcalendar.com');
 for(const origin of ['https://evil.example','https://specialcalendar.com'])vm.runInNewContext(code,{window:{location:{origin},SpecialCalendarPush:{execute:command=>calls.push(command)}}});
 assert.equal(calls.length,1);assert.equal(calls[0].action,'register');assert.equal(calls[0].payload.installationSecret,'synthetic-secret');
});
test('native token, app identity and secure installation are registered after bridge readiness and page load',async()=>{
 const effects=[],scripts=[],commands=[];
 const installation={installationId:'a'.repeat(32),installationSecret:'b'.repeat(64)};
 const module=load('usePushNotifications.js',{
  react:{useCallback:fn=>fn,useEffect:fn=>effects.push(fn),useRef:current=>({current})},
  'react-native':{Platform:{OS:'ios'},AppState:{addEventListener:()=>({remove(){}})}},
  'expo-constants':{easConfig:{projectId:'11111111-1111-4111-8111-111111111111'},expoConfig:{ios:{bundleIdentifier:'fixture.app'}}},
  './notificationModule':{getNotifications:()=>({getPermissionsAsync:async()=>({granted:true,status:'granted'}),getExpoPushTokenAsync:async()=>({data:'ExpoPushToken[synthetic_12345]'}),addNotificationResponseReceivedListener:()=>({remove(){}}),addPushTokenListener:()=>({remove(){}}),getLastNotificationResponseAsync:async()=>null})},
  'expo-device':{isDevice:true},
  './pushInstallation':{getPushInstallation:async()=>installation,pushRegistrationScript:(payload,id,origin)=>{commands.push({payload,id,origin});return 'register;';}},
 });
 const hook=module.default({current:{injectJavaScript:script=>scripts.push(script)}},'https://specialcalendar.com/login',()=>{});
 effects[0]();await new Promise(setImmediate);await new Promise(setImmediate);
 assert.equal(commands.length,1);assert.equal(commands[0].payload.installationSecret,installation.installationSecret);assert.equal(commands[0].payload.appId,'fixture.app');assert.equal(commands[0].payload.enabled,true);assert.equal(commands[0].payload.platform,'ios');
 assert.equal(hook.onMessage({type:'specialcalendar.push.ready',version:1}),true);await new Promise(setImmediate);assert.equal(commands.length,2);
 hook.onLoadEnd({nativeEvent:{url:'https://specialcalendar.com/dashboard-gym'}});await new Promise(setImmediate);assert.equal(commands.length,3);
 hook.onNavigation('https://evil.example');hook.onMessage({type:'specialcalendar.push.ready',version:1});await new Promise(setImmediate);assert.equal(commands.length,3);
});
test('temporary token refresh failure preserves a valid permitted device; explicit OS denial still disables it',async()=>{
 const effects=[],commands=[];let tokenCalls=0,permission='granted';
 const module=load('usePushNotifications.js',{
  react:{useCallback:fn=>fn,useEffect:fn=>effects.push(fn),useRef:current=>({current})},
  'react-native':{Platform:{OS:'ios'},AppState:{addEventListener:()=>({remove(){}})}},
  'expo-constants':{easConfig:{projectId:'11111111-1111-4111-8111-111111111111'},expoConfig:{ios:{bundleIdentifier:'fixture.app'}}},
  './notificationModule':{getNotifications:()=>({IosAuthorizationStatus:{PROVISIONAL:3,EPHEMERAL:4},getPermissionsAsync:async()=>({granted:permission==='granted',status:permission,canAskAgain:false}),getExpoPushTokenAsync:async()=>{if(++tokenCalls>1)throw Error('temporary network failure');return {data:'ExpoPushToken[valid_cached_123]'};},addNotificationResponseReceivedListener:()=>({remove(){}}),addPushTokenListener:()=>({remove(){}}),getLastNotificationResponseAsync:async()=>null})},
  'expo-device':{isDevice:true},
  './pushInstallation':{getPushInstallation:async()=>({installationId:'a'.repeat(32),installationSecret:'b'.repeat(64)}),pushRegistrationScript:payload=>{commands.push(payload);return 'true;';}},
 });
 const hook=module.default({current:{injectJavaScript(){}}},'https://specialcalendar.com/login',()=>{});
 const drain=async()=>{await new Promise(setImmediate);await new Promise(setImmediate);};
 effects[0]();await drain();assert.equal(commands.at(-1).enabled,true);
 hook.onMessage({type:'gym.notifications.request',version:1});await drain();
 assert.equal(commands.at(-1).enabled,true);assert.equal(commands.at(-1).token,'ExpoPushToken[valid_cached_123]');
 permission='denied';hook.onMessage({type:'gym.notifications.request',version:1});await drain();assert.equal(commands.at(-1).enabled,false);
});