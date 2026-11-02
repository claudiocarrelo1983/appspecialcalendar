const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{test}=require('node:test'),babel=require('@babel/core');
function load(name,mocks={}){
 const code=babel.transformSync(fs.readFileSync(require.resolve('../src/utils/'+name),'utf8'),{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code;
 const exports={};vm.runInNewContext(code,{exports,URL,require:key=>{assert.ok(key in mocks,key);return mocks[key];}});return exports;
}
const errors=load('calendarErrors.js'),bridge=load('calendarBridge.js');
test('calendar errors distinguish permission denial from other failures in both languages',()=>{
 for(const language of ['pt','en'])for(const platform of ['ios','android']){
  for(const error of [Error('calendar_permission'),{code:'E_MISSING_PERMISSIONS',message:'CALENDAR permission is required to do this operation.'}]){
   const result=errors.calendarFailure(error,language,platform);assert.equal(result.kind,'permission');assert.equal(result.settings,true);assert.match(result.message,language==='pt'?/Sem permissão/:/not allowed/);
  }
  for(const [message,kind] of [['calendar_unavailable','no_calendar'],['native_unavailable','unsupported'],['Invalid class URL','invalid_event'],['network failure','unknown']]){
   const result=errors.calendarFailure(Error(message),language,platform);assert.equal(result.kind,kind);assert.equal(result.settings,false);
  }
 }
});
test('permission failure offers Settings only after an explicit action; cancellation stays silent',async()=>{
 const alerts=[];let settings=0;
 const module=load('calendarAlerts.js',{'./calendarErrors':errors,'react-native':{Platform:{OS:'android'},Alert:{alert:(...args)=>alerts.push(args)},Linking:{openSettings:async()=>{settings++;}}}});
 module.showCalendarFailure(Error('calendar_permission'),'pt');assert.equal(settings,0);assert.equal(alerts.length,1);
 assert.equal(alerts[0][2][1].text,'Abrir definições');await alerts[0][2][1].onPress();assert.equal(settings,1);
 module.showCalendarFailure(Error('user_cancel'),'pt');assert.equal(alerts.length,1);
 module.showCalendarFailure(Error('calendar_unavailable'),'pt');assert.equal(alerts[1][2].length,1);
});
test('calendar bridge requires a fresh explicit calendar tap rather than a push/page message',()=>{
 const action={type:'gym.calendar.create',version:1,userInitiated:true,interactionAt:100000};assert.equal(bridge.isUserCalendarAction(action,100100),true);
 for(const message of [{...action,userInitiated:false},{...action,interactionAt:undefined},{...action,interactionAt:0},{...action,interactionAt:100101},{...action,type:'class-reminder'}])assert.equal(bridge.isUserCalendarAction(message,100100),false);
 const source=fs.readFileSync(require.resolve('../src/screens/WebViewScreen.js'),'utf8');assert.match(source,/if\(isUserCalendarAction\(message\)\)/);
});
test('native calendar permission failures reach the specific alert once and unrelated push messages do nothing',async()=>{
 const failures=[];let operations=0;
 const native=load('nativeCalendar.js',{'react-native':{Platform:{OS:'android'},Alert:{alert(){assert.fail('Unexpected success alert');}},Linking:{}},'expo-modules-core':{requireOptionalNativeModule:()=>({})},'./calendarBridge':bridge,'./classLinks':load('classLinks.js'),'./calendarAlerts':{showCalendarFailure:(error,language)=>failures.push(errors.calendarFailure(error,language,'android'))},'./fitnessCalendar':{fitnessCalendar:()=>({add:async()=>{operations++;throw Error('calendar_permission');}})}});
 const handler=native.createCalendarMessageHandler('https://club.example');
 assert.equal(await handler({type:'class-reminder'},'https://club.example','account'),false);assert.equal(operations,0);
 await handler({type:'gym.calendar.create',version:1,language:'pt',event:{title:'HIIT',startDate:'2026-11-02T12:00:00Z',endDate:'2026-11-02T13:00:00Z',url:'https://club.example/class',location:'Studio',notes:'Class'}},'https://club.example','account');
 assert.equal(operations,1);assert.equal(failures.length,1);assert.equal(failures[0].kind,'permission');
});
test('push calendar export links open information instead of launching a calendar operation',()=>{
 const {notificationTarget}=load('pushNotificationNavigation.js'),base='https://c20260531125358085.specialcalendar.com';
 for(const path of ['/gym-class-calendar/event?id=1','/gym-class-calendar/class.ics?id=1'])assert.equal(notificationTarget({url:path},base),base+'/dashboard-gym');
 assert.equal(notificationTarget({url:'/mobile-notifications/open?code=abc'},base),base+'/mobile-notifications/open?code=abc');
 assert.equal(notificationTarget({url:'https://other.example/gym-class-calendar/event'},base),null);
});
test('website calendar bridge ignores synthetic clicks and marks actual user taps',()=>{
 const handlers={},messages=[],source=fs.readFileSync(require.resolve('../deployment/calendar-push-permission-fix/frontend/web/js/gym-class-share.js'),'utf8');
 vm.runInNewContext(source,{jQuery:()=>({on:(event,selector,fn)=>{handlers[selector]=fn;}}),document:{documentElement:{lang:'pt'}},navigator:{userAgent:'Android'},window:{ReactNativeWebView:{postMessage:value=>messages.push(JSON.parse(value))},__specialCalendarNativeCalendar:true},Date});
 const click=handlers['[data-gym-calendar-event]'],element={dataset:{gymCalendarEvent:'{"title":"Test"}'}};
 click.call(element,{preventDefault(){}});click.call(element,{preventDefault(){},originalEvent:{isTrusted:false}});assert.equal(messages.length,0);
 click.call(element,{preventDefault(){},originalEvent:{isTrusted:true}});assert.equal(messages.length,1);assert.equal(bridge.isUserCalendarAction(messages[0]),true);
});
