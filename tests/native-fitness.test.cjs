const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),babel=require('@babel/core');
function load(name,mocks={}){const exports={},code=babel.transformSync(fs.readFileSync(path.join(__dirname,'../src/utils',name),'utf8'),{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code;vm.runInNewContext(code,{exports,URL,Date,Map,console,require:name=>{assert.ok(name in mocks,name);return mocks[name];}});return exports;}
const a='a'.repeat(64),b='b'.repeat(64);
const memory=()=>{const data=new Map();return {getItemAsync:async key=>data.get(key)||null,setItemAsync:async(key,value)=>data.set(key,value),data};};
test('workout history persists every completion, deduplicates retries and isolates accounts',async()=>{
 const store=memory(),factory=load('workoutHistory.js',{'expo-secure-store':store,'expo-crypto':{randomUUID:()=> 'unused'}}).createWorkoutHistory,h=factory(store),row={id:'one',mode:'interval',seconds:40,at:Date.now()};
 await Promise.all([h.add(a,row),h.add(a,row)]);assert.equal((await h.list(a)).length,1);assert.equal((await h.list(b)).length,0);
 await h.mark(a,'one',{synced:true});await h.mark(a,'one',{healthSaved:true});const saved=(await factory(store).list(a))[0];assert.equal(saved.synced,true);assert.equal(saved.healthSaved,true);
 await assert.rejects(h.add(a,{...row,seconds:0}));assert.throws(()=>h.list('../account'));
});
test('managed calendar never deletes an event outside its account registry and suppresses duplicate adds',async()=>{
 const store=memory(),events=new Map(),deleted=[];let created=0;
 const api={EntityTypes:{EVENT:'event'},requestCalendarPermissionsAsync:async()=>({granted:true}),getCalendarsAsync:async()=>[{id:'primary',allowsModifications:true,isPrimary:true}],getEventAsync:async id=>events.get(id)||null,
 createEventAsync:async(id,event)=>{assert.equal(id,'primary');const key=String(++created);events.set(key,event);return key;},deleteEventAsync:async id=>{deleted.push(id);events.delete(id);}};
 const factory=load('fitnessCalendar.js',{'expo-secure-store':store,'expo-modules-core':{}}).createFitnessCalendar,calendar=factory(api,store,a),other=factory(api,store,b),event={title:'HIIT',startDate:new Date('2026-11-01T18:00Z'),endDate:new Date('2026-11-01T19:00Z'),url:'https://club.example/class/1'};
 const first=await calendar.add(event);await calendar.add(event);assert.equal(created,1);assert.equal((await calendar.list()).length,1);
 await assert.rejects(other.remove(first.id),/foreign_event/);assert.equal(deleted.length,0);await calendar.remove(first.id);assert.equal((await calendar.list()).length,0);assert.equal(deleted[0],first.id);
});
test('calendar permission refusal does not create or remove events',async()=>{
 const store=memory(),factory=load('fitnessCalendar.js',{'expo-secure-store':store,'expo-modules-core':{}}).createFitnessCalendar;
 const api={requestCalendarPermissionsAsync:async()=>({granted:false})};await assert.rejects(factory(api,store,a).add({}),/calendar_permission/);
});
test('interval haptics fire once at a boundary, not on pause, restoration or background catch-up',()=>{
 const {shouldVibrateInterval:f}=load('timerFeedback.js'),timer={mode:'interval',status:'running',runId:'one'},before={key:'1:work',run:'one',elapsed:39},next={round:1,phase:'rest',elapsed:40,finished:false};
 assert.equal(f(before,next,timer,true),true);assert.equal(f(before,next,timer,false),false);assert.equal(f(before,next,{...timer,status:'paused'},true),false);assert.equal(f(null,next,timer,true),false);assert.equal(f(before,{...next,elapsed:200},timer,true),false);assert.equal(f({...before,key:'1:rest'},next,timer,true),false);
});
test('native timer schedules the audible deadline in the OS and cancels it on pause',async()=>{
 const gym=load('nativeGymCore.js'),scheduled=[],cancelled=[];
 const api={getPermissionsAsync:async()=>({granted:true}),cancelScheduledNotificationAsync:async id=>cancelled.push(id),dismissNotificationAsync:async()=>{},setNotificationChannelAsync:async()=>{},scheduleNotificationAsync:async value=>scheduled.push(value),SchedulableTriggerInputTypes:{DATE:'date'},AndroidImportance:{MAX:5},AndroidAudioUsage:{ALARM:4},AndroidNotificationPriority:{HIGH:2}};
 const {createTimerAlerts}=load('nativeTimerAlerts.js',{'expo-notifications':api,'react-native':{Platform:{OS:'android'}},'./nativeGymCore':gym,'./workoutNative':{updateWorkoutActivity:async()=>{}}});
 const alerts=createTimerAlerts(api,'android',()=>100000),timer={status:'running',mode:'countdown',work:40,rest:20,rounds:1,elapsed:0,startedAt:100000};await alerts.sync(a,timer,'Done','Finished');assert.equal(scheduled[0].trigger.date.getTime(),140000);assert.equal(scheduled[0].content.sound,'gym_timer_finished.wav');await alerts.sync(a,{...timer,status:'paused'},'Done','Finished');assert.equal(scheduled.length,1);assert.ok(cancelled.length>=2);
});
test('background set alarms are scheduled by the OS and all are cancelled on pause',async()=>{
 const gym=load('nativeGymCore.js'),scheduled=new Map(),cancelled=[];
 const api={getPermissionsAsync:async()=>({granted:true}),getAllScheduledNotificationsAsync:async()=>Array.from(scheduled.values()),cancelScheduledNotificationAsync:async id=>{cancelled.push(id);scheduled.delete(id);},dismissNotificationAsync:async()=>{},setNotificationChannelAsync:async()=>{},scheduleNotificationAsync:async value=>scheduled.set(value.identifier,value),SchedulableTriggerInputTypes:{DATE:'date'},AndroidImportance:{MAX:5},AndroidAudioUsage:{ALARM:4},AndroidNotificationPriority:{HIGH:2}};
 const {createTimerAlerts}=load('nativeTimerAlerts.js',{'expo-notifications':api,'react-native':{Platform:{OS:'android'}},'./nativeGymCore':gym,'./workoutNative':{updateWorkoutActivity:async()=>{}}});
 const alerts=createTimerAlerts(api,'android',()=>100000),timer={status:'running',mode:'interval',work:40,rest:20,rounds:3,elapsed:0,startedAt:100000};
 await alerts.sync(a,timer,'Done','Finished','Set complete');assert.equal(scheduled.size,5);
 assert.equal(scheduled.get('gym-timer-'+a+'-set-1').trigger.date.getTime(),140000);assert.equal(scheduled.get('gym-timer-'+a+'-set-2').trigger.date.getTime(),200000);
 assert.equal(scheduled.get('gym-timer-'+a).trigger.date.getTime(),260000);await alerts.sync(a,{...timer,status:'paused'},'Done','Finished');assert.equal(scheduled.size,0);
});
test('cloud history merge preserves pending local workouts and Health save state',async()=>{
 const store=memory(),h=load('workoutHistory.js',{'expo-secure-store':store,'expo-crypto':{}}).createWorkoutHistory(store);
 const id='12345678-1234-4123-8123-123456789abc';await h.add(a,{id,mode:'countdown',seconds:60,at:Date.now()});await h.mark(a,id,{healthSaved:true});
 await h.merge(a,[{workout_id:id,mode:'countdown',duration_seconds:60,finished_at:1800000000},{workout_id:'22345678-1234-4123-8123-123456789abc',mode:'interval',duration_seconds:120,finished_at:1800000100}]);
 const rows=await h.list(a);assert.equal(rows.length,2);assert.equal(rows.find(row=>row.id===id).healthSaved,true);assert.equal(rows.find(row=>row.id!==id).synced,true);assert.equal((await h.list(b)).length,0);
});
test('workout sync uses same-origin CSRF-protected requests and rejects a changed signed-in owner',async()=>{
 const {workoutSyncScript}=load('useWorkoutSync.js',{react:{},'react-native':{},'./workoutHistory':{},'expo-secure-store':{},'./nativeGymCore':{},'./workoutHealthAuto':{flush:async()=>[]},'./workoutNative':{}});
 const script=workoutSyncScript('https://club.example','one',a,[]);
 const execute=async(origin,owner)=>{const calls=[],messages=[],context={location:{origin},window:{ReactNativeWebView:{postMessage:message=>messages.push(JSON.parse(message))}},AbortController,setTimeout,clearTimeout,URLSearchParams,fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>url==='/api/v1/csrf'?{success:true,data:{token:'secret'}}:url.endsWith('/sync')?{success:true,ids:[]}:{success:true,ownerKey:owner,rows:[]}};}};
   await vm.runInNewContext(script.replace(/;true;$/,''),context);return {calls,messages};};
 const valid=await execute('https://club.example',a);assert.equal(valid.messages[0].success,true);assert.equal(valid.calls[1].options.headers['X-CSRF-Token'],'secret');assert.ok(valid.calls.every(call=>call.options.credentials==='same-origin'&&call.options.redirect==='error'));
 const wrong=await execute('https://club.example',b);assert.equal(wrong.messages[0].success,false);assert.equal((await execute('https://foreign.example',a)).calls.length,0);
});
test('workout sync bridge uses literal source for Hermes release builds',()=>{
 const mocks={react:{},'react-native':{},'./workoutHistory':{},'expo-secure-store':{},'./nativeGymCore':{},'./workoutHealthAuto':{flush:async()=>[]},'./workoutNative':{}},exports={};
 const code=babel.transformSync(fs.readFileSync(path.join(__dirname,'../src/utils/useWorkoutSync.js'),'utf8'),{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code;
 vm.runInNewContext('Function.prototype.toString=function(){throw Error("Source unavailable");};'+code,{exports,URL,require:name=>mocks[name]});assert.ok(exports.workoutSyncScript('https://club.example','one',a,[]).includes('/native-workouts/sync'));
});
