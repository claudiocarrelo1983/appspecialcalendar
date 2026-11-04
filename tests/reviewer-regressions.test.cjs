const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),babel=require('@babel/core');
function load(name,mocks={}){
 const exports={},code=babel.transformSync(fs.readFileSync(require.resolve('../src/utils/'+name),'utf8'),{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code;
 vm.runInNewContext(code,{exports,URL,Date,Intl,require:name=>{assert.ok(name in mocks,name);return mocks[name];}});return exports;
}
const core=load('nativeGymCore.js');
test('offline QR survives restart, is scoped to account and company, and is removed at logout',async()=>{
 const memory=new Map(),store={getItemAsync:async key=>memory.get(key),setItemAsync:async(key,value)=>memory.set(key,value),deleteItemAsync:async key=>memory.delete(key)};
 const factory=load('offlinePass.js',{'expo-secure-store':store,'./nativeGymCore':core}).createOfflinePass;
 const account='a'.repeat(64),data={accountKey:account,client:{name:'Member',number:1,password:'never store'},company:{name:'FTX'},language:'en',pass:{matrix:Array(21).fill('1'.repeat(21)),title:'Monthly',status:'active',validUntil:'2026-12-01'}};
 await factory(store).save(data,'https://ftx.example');
 assert.equal((await factory(store).read(account,'https://ftx.example')).client.name,'Member');
 assert.equal(await factory(store).read(account,'https://demo.example'),null);
 assert.equal(await factory(store).read('b'.repeat(64),'https://ftx.example'),null);
 assert.ok(![...memory.values()][0].includes('never store'));
 await factory(store).remove(account);assert.equal(await factory(store).read(account,'https://ftx.example'),null);
});
test('QR scanner opens a confirmation route only for a validated member QR',()=>{
 const pages=load('nativeAdminPages.js',{'./nativeGymCore':core,'./summaryCardLayout':{},'./subcategoryTabs':{}}),base='https://ftx.example',config={companyCode:'ftx',origins:[base]};
 const url=new URL(pages.adminMemberCheckinTarget(base+'/clients-list/view/1619',config,base));
 assert.equal(url.pathname,'/gym-checkin/index');assert.equal(url.searchParams.get('member_id'),'1619');
 assert.equal(new URL(pages.adminMemberCheckinTarget(base+'/clients-list/view/1619',{...config,checkinAllowed:false},base)).pathname,'/clients-list/view');
 for(const value of ['https://evil.example/clients-list/view/1619',base+'/clients-list/view/1619?company_code=demo',base+'/logout'])assert.equal(pages.adminMemberCheckinTarget(value,config,base),null);
});
test('calendar keeps the same UTC instant across phone timezones and documents club time',()=>{
 const bridge=load('calendarBridge.js');
 for(const [start,end,clock] of [['2026-11-05T18:00:00Z','2026-11-05T19:30:00Z','18:00'],['2026-07-05T17:00:00Z','2026-07-05T18:30:00Z','18:00']]){
  const event=bridge.calendarEventFromMessage({type:'gym.calendar.create',version:1,event:{title:'Class',startDate:start,endDate:end,timeZone:'Europe/Lisbon',url:'https://ftx.example/class',location:'Studio',notes:''}});
  assert.equal(event.startDate.getTime(),Date.parse(start));assert.ok(event.notes.includes(clock));assert.ok(event.notes.includes('Europe/Lisbon'));
 }
});
test('all native screens including offline are under the bundled font provider',()=>{
 const app=fs.readFileSync('App.js','utf8'),provider=fs.readFileSync('src/screens/NativeFontProvider.js','utf8');
 assert.match(app,/<NativeFontProvider><AppContent \/><\/NativeFontProvider>/);assert.match(provider,/GymBoxicons:require/);
});
