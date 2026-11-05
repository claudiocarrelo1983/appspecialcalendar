const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),babel=require('@babel/core');
function mount(rows=[],language='en',options={}){
 let stateIndex=0;const navigations=[],events=[],slots=[],confirmations=[],requests=[];
 const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),useState:initial=>{const i=stateIndex++;if(!(i in slots))slots[i]=i===0?rows:i===4?(options.invitations||{}):initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},useRef:value=>({current:value}),useEffect(){}};
 const native=Object.fromEntries(['ActivityIndicator','Modal','Pressable','ScrollView','View'].map(name=>[name,name]));
 const theme={surface:'#fff',text:'#101828',muted:'#718099',border:'#e4eaf2'};
 const mocks={react,'react-native':{...native,Alert:{alert:(...args)=>confirmations.push(args)},StyleSheet:{create:value=>value}},'./NativeAdminHeader':{NotificationIcon:'NoticeIcon'},'../utils/notificationBookings':{notificationBookings:async()=>options.after||options.invitations||{},notificationBookingAction:row=>row?.actions?.find(a=>a.kind===(row.booked?'cancel-booking':'book'))||null},'./NativeGymTypography':{LoadingIndicator:'ActivityIndicator',Icon:'Icon',Text:'Text'},'../utils/gymUiTheme':{__esModule:true,default:theme,brandSoft:()=> '#f0f7f3'}};
 const exports={},code=babel.transformSync(fs.readFileSync('src/screens/NativeNotifications.js','utf8'),{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-react-jsx','@babel/plugin-transform-modules-commonjs']}).code;
 vm.runInNewContext(code,{exports,require:name=>mocks[name]});
 const t={viewAll:language==='pt'?'Ver todas as notificações':'View all notifications',close:'Close'};
 const props={gym:{data:{accountKey:'sample',company:{name:'FTX'},language,timezone:'Europe/Lisbon'},request:async(...args)=>{requests.push(args);return {rows,unread:0};},openWeb:(...args)=>{events.push('navigate');navigations.push(args);}},bookings:{request:async(...args)=>{requests.push(args);if(options.fail)throw Error('failed');return {success:true};},load(){}},base:'https://ftx.example',t,color:'#198754',visible:true,onClose:()=>events.push('close'),onUnread(){}};
 const nodes=value=>!value||typeof value!=='object'?[]:[value,...(value.props?.children||[]).flat(Infinity).flatMap(nodes)];
 const render=()=>{stateIndex=0;return nodes(exports.default(props));};
 return {nodes:render(),render,navigations,events,t,confirmations,requests};
}
for(const language of ['en','pt'])test('View all notifications closes the panel and opens the inbox without a row: '+language,()=>{
 const h=mount([],language),button=h.nodes.find(node=>node.props.accessibilityLabel===h.t.viewAll);
 assert.ok(button);assert.doesNotThrow(()=>button.props.onPress());
 assert.deepEqual(h.events,['close','navigate']);assert.deepEqual(h.navigations,[['notifications']]);
});

test('the checkbox beside an invitation books the class, never marks it read, and changes only after server confirmation',async()=>{
 const row={id:10,bookingUrl:'/dashboard-gym-client/index?date=2026-11-05&schedule_id=7',createdAt:'2026-11-05T10:00:00Z',read:true};
 const action={kind:'book',enabled:true,params:{date:'2026-11-05',schedule_id:7}};
 const h=mount([row],'en',{invitations:{10:{row:{booked:false,actions:[action]}}},after:{10:{row:{booked:true,actions:[]}}}});
 const check=h.nodes.find(n=>n.props.accessibilityRole==='checkbox');assert.equal(check.props.accessibilityState.checked,false);
 check.props.onPress();assert.equal(h.requests.length,0);assert.equal(h.confirmations.length,1);
 await h.confirmations[0][2][1].onPress();assert.equal(h.requests[0][0],'book');
 assert.ok(!h.requests.some(r=>r[0]==='notification-read'));
 assert.equal(h.render().find(n=>n.props.accessibilityRole==='checkbox').props.accessibilityState.checked,true);
 const icon=h.nodes.find(n=>n.type==='NoticeIcon');assert.equal(icon.props.invitation,true);assert.equal(icon.props.color,'#7c3aed');
});
test('an expired cancellation window explains the restriction on tap and keeps the invitation checked',()=>{
 const row={id:10,bookingUrl:'/dashboard-gym-client/index',createdAt:'2026-11-05T10:00:00Z',read:false};
 const h=mount([row],'pt',{invitations:{10:{row:{booked:true,reason:'Prazo de cancelamento encerrado',actions:[]}}}});
 const check=h.nodes.find(n=>n.props.accessibilityRole==='checkbox');assert.equal(check.props.accessibilityState.checked,true);assert.equal(check.props.disabled,false);
 check.props.onPress();assert.equal(h.confirmations.length,1);assert.equal(h.confirmations[0][1],'Prazo de cancelamento encerrado');assert.equal(h.requests.length,0);
});

test('booking before opening time shows the server reason without booking or checking the invitation',()=>{
 for(const language of ['en','pt']){
  const reason=language==='pt'?'As marcações abrem em 2026-11-06 09:30:00':'Bookings open on 2026-11-06 09:30:00';
  const h=mount([{id:10,bookingUrl:'/dashboard-gym-client/index',createdAt:'2026-11-05T10:00:00Z'}],language,{invitations:{10:{row:{booked:false,reason,actions:[]}}}});
  const check=h.nodes.find(n=>n.props.accessibilityRole==='checkbox');check.props.onPress();
  assert.equal(h.confirmations[0][1],reason);assert.equal(h.requests.length,0);
  assert.equal(h.render().find(n=>n.props.accessibilityRole==='checkbox').props.accessibilityState.checked,false);
 }
});
test('failed or rejected cancellation never unchecks the invitation',async()=>{
 const row={id:10,bookingUrl:'/dashboard-gym-client/index',createdAt:'2026-11-05T10:00:00Z',read:false};
 const h=mount([row],'en',{fail:true,invitations:{10:{row:{booked:true,actions:[{kind:'cancel-booking',enabled:true,params:{id:4}}]}}}});
 h.nodes.find(n=>n.props.accessibilityRole==='checkbox').props.onPress();await h.confirmations[0][2][1].onPress();
 assert.equal(h.requests[0][0],'cancel-booking');assert.equal(h.render().find(n=>n.props.accessibilityRole==='checkbox').props.accessibilityState.checked,true);
});
test('successful cancellation unchecks the notification-row checkbox after the server refresh',async()=>{
 const row={id:10,bookingUrl:'/dashboard-gym-client/index',createdAt:'2026-11-05T10:00:00Z',read:true};
 const h=mount([row],'en',{invitations:{10:{row:{booked:true,actions:[{kind:'cancel-booking',enabled:true,params:{id:4}}]}}},after:{10:{row:{booked:false,actions:[{kind:'book',enabled:true}]}}}});
 h.nodes.find(n=>n.props.accessibilityRole==='checkbox').props.onPress();await h.confirmations[0][2][1].onPress();
 assert.equal(h.requests[0][0],'cancel-booking');assert.equal(h.render().find(n=>n.props.accessibilityRole==='checkbox').props.accessibilityState.checked,false);
});
test('booked invitations use green pills and unbooked invitations use red pills in both languages',()=>{
 for(const language of ['en','pt'])for(const booked of [true,false]){
  const h=mount([{id:10,bookingUrl:'/dashboard-gym-client/index',createdAt:'2026-11-05T10:00:00Z',read:false}],language,{invitations:{10:{row:{booked,actions:[]}}}});
  const pill=h.nodes.find(n=>n.props.testID==='invitation-booking-status-10');assert.ok(pill);
  assert.equal(pill.props.style[1].backgroundColor,booked?'#dcfce7':'#fee2e2');
  const text=pill.props.children[0];assert.equal(text.props.style.color,booked?'#15803d':'#b91c1c');
  assert.ok(text.props.children.includes(booked?(language==='pt'?'Reservada':'Booked'):(language==='pt'?'Não reservada':'Not booked')));
 }
});
test('task notifications use the separate clipboard icon and amber colour',()=>{
 const h=mount([{id:4,type:'task',createdAt:'2026-11-05T10:00:00Z',read:false}]);
 const icon=h.nodes.find(n=>n.type==='NoticeIcon');assert.equal(icon.props.task,true);assert.equal(icon.props.color,'#b45309');
});
test('ordinary notification checkbox keeps its read/unread behaviour',async()=>{
 const h=mount([{id:11,createdAt:'2026-11-05T10:00:00Z',read:false}]);
 await h.nodes.find(n=>n.props.accessibilityRole==='checkbox').props.onPress();await new Promise(setImmediate);
 assert.equal(h.requests[0][0],'notification-read');assert.equal(h.confirmations.length,0);
 assert.equal(h.nodes.find(n=>n.type==='NoticeIcon').props.invitation,false);
});
test('individual class reminders and notifications retain their respective destinations',()=>{
 for(const row of [{id:5,bookingUrl:'https://ftx.example/dashboard-gym-client?schedule_id=7'},{id:6}]){
  const h=mount([{...row,title:'Notice',body:'Details',createdAt:'2026-11-05T10:00:00Z',read:false}]);
  const button=h.nodes.find(node=>node.type==='Pressable'&&node.props.accessibilityRole==='button'&&!node.props.accessibilityLabel);
  assert.ok(button);button.props.onPress();assert.equal(h.events[0],'close');
  const [route,params]=h.navigations[0];assert.equal(route,row.bookingUrl?'bookings':'notifications');
  if(row.bookingUrl)assert.equal(params.classUrl,row.bookingUrl);else assert.equal(params.id,row.id);
 }
});
