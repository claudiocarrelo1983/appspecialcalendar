const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),babel=require('@babel/core');
function load(name,mocks={}){const exports={},code=babel.transformSync(fs.readFileSync(require.resolve('../src/utils/'+name),'utf8'),{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code;vm.runInNewContext(code,{exports,URL,Date,Map,require:name=>{assert.ok(name in mocks,name);return mocks[name];}});return exports;}
const factory=load('workoutHealthAuto.js',{'./workoutHistory':{},'./workoutNative':{}}).createWorkoutHealthAuto;
function harness(){
 const data=new Map(),store={getItemAsync:async key=>data.get(key),setItemAsync:async(key,value)=>data.set(key,value)};
 const history=load('workoutHistory.js',{'expo-secure-store':store,'expo-crypto':{}}).createWorkoutHistory(store);
 let status='undetermined',requests=0,fail=false;const saved=[];
 const auto=factory({history,available:true,permission:async()=>status,request:async()=>{requests++;status='authorized';return status;},save:async row=>{if(fail)throw Error('locked');saved.push(row.id);return {saved:true};}});
 return {history,auto,saved,setStatus:value=>status=value,setFail:value=>fail=value,requests:()=>requests};
}
const a='a'.repeat(64),b='b'.repeat(64),row={id:'12345678-1234-4123-8123-123456789abc',mode:'interval',seconds:60,at:Date.now(),healthAuto:true};
test('Apple Health authorization is requested only from prepare, once while undetermined',async()=>{
 const h=harness();await h.history.add(a,row);await h.auto.flush(a);assert.equal(h.requests(),0);assert.equal(h.saved.length,0);
 assert.equal(await h.auto.prepare(),'authorized');assert.equal(await h.auto.prepare(),'authorized');assert.equal(h.requests(),1);
 h.setStatus('denied');assert.equal(await h.auto.prepare(),'denied');assert.equal(h.requests(),1);
});
test('new local workouts automatically save once, and concurrent retries stay deduplicated',async()=>{
 const h=harness();await h.auto.prepare();await h.history.add(a,row);
 await Promise.all([h.auto.flush(a),h.auto.flush(a)]);await h.auto.flush(a);
 assert.deepEqual(h.saved,[row.id]);const saved=(await h.history.list(a))[0];assert.equal(saved.healthSaved,true);assert.equal(saved.healthStatus,'saved');
});
test('denied or revoked permission keeps the local workout and retries only after access returns',async()=>{
 const h=harness();h.setStatus('denied');await h.history.add(a,row);await h.auto.flush(a);
 assert.equal(h.saved.length,0);assert.equal((await h.history.list(a))[0].healthStatus,'permission');assert.equal(h.requests(),0);
 h.setStatus('authorized');await h.auto.flush(a);assert.equal(h.saved.length,1);
});
test('temporary Health failures preserve history and recover without prompting again',async()=>{
 const h=harness();await h.auto.prepare();h.setFail(true);await h.history.add(a,row);await h.auto.flush(a);
 assert.equal((await h.history.list(a))[0].healthStatus,'retry');h.setFail(false);await h.auto.flush(a);assert.equal((await h.history.list(a))[0].healthSaved,true);assert.equal(h.requests(),1);
});
test('old history, cloud imports and another company account are never automatically copied into Health',async()=>{
 const h=harness();await h.auto.prepare();await h.history.add(a,{...row,id:'old',healthAuto:false});
 await h.history.merge(a,[{workout_id:row.id,mode:'interval',duration_seconds:60,finished_at:Math.floor(Date.now()/1000)}]);
 await h.history.add(b,row);await h.auto.flush(a);assert.equal(h.saved.length,0);assert.equal((await h.history.list(b))[0].healthSaved,false);
 await h.auto.flush(b);assert.deepEqual(h.saved,[row.id]);
});
test('old binaries do not request or attempt unsupported automatic Health writes',async()=>{
 const h=harness(),auto=factory({history:h.history,available:false,permission:()=>assert.fail(),request:()=>assert.fail(),save:()=>assert.fail()});
 assert.equal(await auto.prepare(),'unavailable');await auto.flush(a);
});
test('work/rest/completion use different bundled PCM sound assets for both platforms',()=>{
 const app=require('../app.json'),sounds=app.expo.plugins.find(item=>Array.isArray(item)&&item[0]==='expo-notifications')[1].sounds;
 const bytes=['work','rest','finished'].map(name=>{const file='./src/assets/audio/gym_timer_'+name+'.wav';assert.ok(sounds.includes(file));const data=fs.readFileSync(file);assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.readUInt16LE(20),1);assert.ok((data.length-44)/data.readUInt32LE(28)<30);return data;});
 assert.ok(!bytes[0].equals(bytes[1])&&!bytes[1].equals(bytes[2]));
});
test('native Health save checks write authorization and does not open a prompt while saving',()=>{
 const swift=fs.readFileSync(require.resolve('../modules/special-calendar-health/ios/SpecialCalendarHealthModule.swift'),'utf8');
 const save=swift.slice(swift.indexOf('AsyncFunction("saveWorkout")'),swift.indexOf('AsyncFunction("status")'));
 assert.match(save,/authorizationStatus\(for: type\) == \.sharingAuthorized/);assert.doesNotMatch(save,/requestAuthorization/);assert.match(save,/HKMetadataKeySyncIdentifier/);
});
function alarmHarness(platform='ios',others=0){
 const scheduled=new Map(Array.from({length:others},(_,i)=>['reminder-'+i,{identifier:'reminder-'+i}])),channels=[];
 const api={getPermissionsAsync:async()=>({granted:true}),getAllScheduledNotificationsAsync:async()=>[...scheduled.values()],cancelScheduledNotificationAsync:async id=>scheduled.delete(id),dismissNotificationAsync:async()=>{},setNotificationChannelAsync:async(id,options)=>channels.push({id,...options}),scheduleNotificationAsync:async value=>scheduled.set(value.identifier,value),SchedulableTriggerInputTypes:{DATE:'date'},AndroidImportance:{MAX:5},AndroidAudioUsage:{ALARM:4},AndroidNotificationPriority:{HIGH:2}};
 const alerts=load('nativeTimerAlerts.js',{'expo-notifications':api,'react-native':{Platform:{OS:platform}},'./nativeGymCore':load('nativeGymCore.js'),'./workoutNative':{updateWorkoutActivity:async()=>{}}}).createTimerAlerts(api,platform,()=>100000);
 return {alerts,scheduled,channels};
}
const timer={mode:'interval',status:'running',startedAt:100000,elapsed:0,work:40,rest:20,rounds:3};
test('work and rest boundaries use different OS sounds, dates and Android channels',async()=>{
 for(const platform of ['ios','android']){
  const h=alarmHarness(platform);await h.alerts.sync(a,timer,'Done','Finished','Set',{work:'Trabalho',rest:'Descanso',round:'Série'});
  const rest=h.scheduled.get('gym-timer-'+a+'-set-1'),work=h.scheduled.get('gym-timer-'+a+'-set-1-work'),finish=h.scheduled.get('gym-timer-'+a);
  assert.equal(rest.trigger.date.getTime(),140000);assert.equal(work.trigger.date.getTime(),160000);assert.equal(finish.trigger.date.getTime(),260000);
  assert.equal(rest.content.sound,'gym_timer_rest.wav');assert.equal(work.content.sound,'gym_timer_work.wav');assert.equal(finish.content.sound,'gym_timer_finished.wav');assert.equal(work.content.body,'Série 2 / 3');
  assert.notEqual(rest.trigger.channelId,work.trigger.channelId);assert.notEqual(rest.trigger.channelId,finish.trigger.channelId);
  if(platform==='android')assert.equal(new Set(h.channels.map(row=>row.sound)).size,3);
  await h.alerts.sync(a,{...timer,status:'paused'},'Done','Finished');assert.equal(h.scheduled.size,0);
 }
});
test('zero rest has one work cue per transition and no false rest cues',async()=>{
 const h=alarmHarness();await h.alerts.sync(a,{...timer,rest:0},'Done','Finished');assert.equal(h.scheduled.size,3);
 assert.ok([...h.scheduled.values()].every(row=>row.content.sound!=='gym_timer_rest.wav'));
});
test('paused timers reschedule only future phases and the final alarm',async()=>{
 const h=alarmHarness();await h.alerts.sync(a,{...timer,elapsed:70},'Done','Finished');assert.equal(h.scheduled.size,3);
 assert.ok([...h.scheduled.values()].every(row=>row.trigger.date.getTime()>100000));assert.equal(h.scheduled.has('gym-timer-'+a+'-set-1'),false);
});
test('iOS preserves other reminders, reserves completion and reports a phase-alert limit',async()=>{
 const h=alarmHarness('ios',61);await assert.rejects(h.alerts.sync(a,timer,'Done','Finished'),/timerPhaseLimit/);
 assert.equal(h.scheduled.size,64);assert.ok(h.scheduled.has('gym-timer-'+a));assert.ok(h.scheduled.has('reminder-60'));
 const full=alarmHarness('ios');await full.alerts.sync(b,{...timer,rounds:30},'Done','Finished');assert.equal(full.scheduled.size,59);
});
