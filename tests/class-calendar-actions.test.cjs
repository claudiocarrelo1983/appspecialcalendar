const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {test}=require('node:test'),babel=require('@babel/core');
function load(name,mocks={}){
 const {code}=babel.transformSync(fs.readFileSync(require.resolve('../src/utils/'+name),'utf8'),{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']});
 const exports={};vm.runInNewContext(code,{exports,URL,URLSearchParams,require:key=>{assert.ok(key in mocks,key);return mocks[key];}});return exports;
}
const base='https://c20260531125358085.specialcalendar.com',bridge=load('calendarBridge.js'),links=load('classLinks.js');
const item={calendarUrl:'https://calendar.google.com/calendar/render?action=TEMPLATE',calendarEvent:{title:'Muay Thai',startDate:'2026-10-30T09:00:00Z',endDate:'2026-10-30T10:30:00Z',location:'Studio',notes:'Class',url:base+'/dashboard-gym-client/index?date=2026-10-30&schedule_id=7'}};
test('sharing opens client booking for the exact occurrence and preserves company scope through login',()=>{
 const klass={date:'2026-10-30',schedule_id:7,shareUrl:base+'/dashboard-gym?company_code=ftx&date=2026-10-30&schedule_id=7'};
 const target=links.classBookingShareTarget(klass,base);
 assert.equal(new URL(target).pathname,'/dashboard-gym-client/index');
 assert.equal(new URL(target).searchParams.get('company_code'),'ftx');
 assert.equal(links.classLinkTarget(target,base),target);
 for(const shareUrl of [base+'/dashboard-gym',klass.shareUrl.replace('schedule_id=7','schedule_id=8'),klass.shareUrl.replace('company_code=ftx&',''),klass.shareUrl.replace(base,'https://other.example')])assert.equal(links.classBookingShareTarget({...klass,shareUrl},base),null);
});
function harness(os){
 const opened=[],events=[];
 const module=load('nativeCalendar.js',{'react-native':{Platform:{OS:os,Version:'18'},Alert:{alert(){}},Linking:{openURL:async url=>opened.push(url)}},'expo-modules-core':{requireOptionalNativeModule:()=>({})},'./calendarAlerts':{showCalendarFailure(){}},'./calendarBridge':bridge,'./classLinks':links,'./fitnessCalendar':{fitnessCalendar:()=>({add:async()=>{}})},'expo-calendar/legacy':{createEventInCalendarAsync:async event=>events.push(event)}});
 return {opened,events,open:module.createClassCalendarHandler(base)};
}
test('Android calendar uses the server calendar link outside the app',async()=>{
 const h=harness('android');await h.open(item,'en');assert.equal(h.opened[0],item.calendarUrl);assert.equal(h.events.length,0);
 await assert.rejects(h.open({...item,calendarUrl:'https://other.example/calendar'}));
 await assert.rejects(h.open({...item,calendarEvent:{...item.calendarEvent,startDate:'invalid'}}));
});
test('iPhone calendar editor receives exact server UTC times, location and class link',async()=>{
 const h=harness('ios');await h.open(item,'pt');assert.equal(h.opened.length,0);assert.equal(h.events.length,1);
 assert.equal(h.events[0].startDate.toISOString(),'2026-10-30T09:00:00.000Z');assert.equal(h.events[0].timeZone,'Europe/Lisbon');assert.equal(h.events[0].url,item.calendarEvent.url);
 await assert.rejects(h.open({...item,calendarEvent:{...item.calendarEvent,url:'https://other.example/class'}}));
});
