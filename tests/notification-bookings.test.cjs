const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),babel=require('@babel/core');
function load(file,mocks={}){const exports={},code=babel.transformSync(fs.readFileSync('src/utils/'+file,'utf8'),{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code;vm.runInNewContext(code,{exports,URL,URLSearchParams,Map,Promise,require:name=>mocks[name]});return exports;}
const links=load('classLinks.js'),core=load('clientBookingsCore.js'),api=load('notificationBookings.js',{'./classLinks':links,'./clientBookingsCore':core});
const base='https://ftx.example';
function page(date,rows,company='ftx'){return {success:true,data:{revision:'native-client-bookings-v1',date,serverTime:date+'T09:00:00Z',companyCode:company,clientGuid:'self',rows,classFilters:[],family:[],alerts:[],waivers:[],history:[]}};}
test('invitation states use current server bookings and group invitations for the same date',async()=>{
 const date='2026-11-05',queries=[],row={key:'7:'+date,schedule_id:7,date,booked:true,booking_id:1,booking_client_guid:'self',actions:[]};
 const rows=[1,2].map(id=>({id,bookingUrl:'/dashboard-gym-client/index?company_code=ftx&date='+date+'&schedule_id=7'}));
 const states=await api.notificationBookings(rows,base,async(...args)=>{queries.push(args);return page(date,[row]);});
 assert.equal(queries.length,1);assert.equal(states[1].row.booked,true);assert.equal(states[2].row,row);
 assert.equal(api.notificationBookingAction(row),null,'No cancellation action when server policy forbids it');
});
test('foreign, ambiguous, missing and failed invitation data cannot produce booking actions',async()=>{
 const good='/dashboard-gym-client/index?company_code=ftx&date=2026-11-05&schedule_id=7';let calls=0;
 const states=await api.notificationBookings([{id:1,bookingUrl:'https://evil.example'+good},{id:2,bookingUrl:good+'&schedule_id=8'},{id:3,bookingUrl:good}],base,async()=>{calls++;return page('2026-11-05',[]);});
 assert.equal(calls,1);for(const id of [1,2,3])assert.equal(states[id].row,null);
 const foreign=await api.notificationBookings([{id:4,bookingUrl:good}],base,async()=>page('2026-11-05',[],'demo'));assert.equal(foreign[4].row,null);
 const failed=await api.notificationBookings([{id:5,bookingUrl:good}],base,async()=>{throw Error('offline')});assert.equal(failed[5].row,null);
});
test('booking action always follows server booking state rather than the read flag',()=>{
 const book={kind:'book',enabled:true},cancel={kind:'cancel-booking',enabled:true};
 assert.equal(api.notificationBookingAction({read:true,booked:false,actions:[book]}),book);
 assert.equal(api.notificationBookingAction({read:false,booked:true,actions:[cancel]}),cancel);
});
test('a read invitation is not booked without an exact recipient booking record',async()=>{
 const date='2026-11-05',notice={id:1,read:true,bookingUrl:'/dashboard-gym-client/index?company_code=ftx&date='+date+'&schedule_id=7'};
 const row={key:'7:'+date,schedule_id:7,date,booked:false,actions:[{kind:'book',enabled:true}]};
 let states=await api.notificationBookings([notice],base,async()=>page(date,[row]));
 assert.equal(states[1].row.booked,false);assert.equal(api.notificationBookingAction(states[1].row).kind,'book');
 for(const evidence of [{booked:true},{booked:true,booking_id:4,booking_client_guid:'someone-else'}]){
  states=await api.notificationBookings([notice],base,async()=>page(date,[{...row,...evidence}]));
  assert.equal(states[1].row,null);assert.equal(states[1].error,'invalid_response');
 }
});
