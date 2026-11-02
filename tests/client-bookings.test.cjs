const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{test}=require('node:test'),babel=require('@babel/core');
function load(file,mocks={},globals={}){const exports={},code=babel.transformSync(fs.readFileSync(require.resolve('../src/'+file),'utf8'),{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-react-jsx','@babel/plugin-transform-modules-commonjs']}).code;vm.runInNewContext(code,{exports,URL,URLSearchParams,Date,...globals,require:key=>{assert.ok(key in mocks,key);return mocks[key];}});return exports;}
const core=load('utils/clientBookingsCore.js'),gym=load('utils/nativeGymCore.js'),base='https://c20260531125358085.specialcalendar.com';
function snapshot(date='2026-12-30',booked=false){return {revision:'native-client-bookings-v1',date,today:'2026-12-30',serverTime:'2026-12-30T09:00:00Z',companyCode:'ftx',clientGuid:'self',family:[{guid:'self',name:'Alice'},{guid:'child',name:'Bob'}],classFilters:[{code:'muay',label:'Muay Thai'}],alerts:[],alertsReady:true,waivers:[],history:[],kpis:{},rows:[{key:'7:'+date,schedule_id:7,date,class_code:'muay',class_name:'Muay Thai',start_time:'10:00',end_time:'11:00',status:'upcoming',past:false,capacity:20,registered:4,available:16,booked,participants:[{name:'Taylor'}],actions:[{kind:booked?'cancel-booking':'book',label:booked?'Cancel booking':'Book class',params:{company_code:'ftx',client_guid:'self',class_code:'muay',date,schedule_id:7},enabled:true}]}]};}
test('client bridge keeps CSRF in the document and only calls supported same-origin actions',async()=>{
 assert.throws(()=>core.clientBookingsScript(base,'x','delete-account',{}));const calls=[],messages=[];
 const script=core.clientBookingsScript(base,'one','book',{class_code:'muay',date:'2026-12-30',schedule_id:7,client_guid:'child',company_code:'ftx',unexpected:'drop-me'});
 vm.runInNewContext(script,{URL,URLSearchParams,AbortController,setTimeout,clearTimeout,location:{origin:base,href:base+'/dashboard-gym-client'},document:{querySelector:()=>({content:'csrf-private'})},window:{ReactNativeWebView:{postMessage:value=>messages.push(JSON.parse(value))}},fetch:async(url,options)=>{calls.push({url,options});return {url:base+url,status:200,text:async()=>JSON.stringify({success:true,message:'Booked'})};}});
 await new Promise(setImmediate);assert.equal(calls.length,1);assert.ok(calls[0].url.startsWith('/dashboard-gym-client/book?'));assert.equal(calls[0].options.headers['X-CSRF-Token'],'csrf-private');assert.ok(calls[0].options.body.includes('client_guid=child'));assert.ok(!calls[0].options.body.includes('drop-me'));assert.ok(!JSON.stringify(messages).includes('csrf-private'));
});

test('opening alerts wait for push permission and do not save when registration is refused',async()=>{
 const messages=[],calls=[];
 vm.runInNewContext(core.clientBookingsScript(base,'alerts','booking-alert',{class_code:'muay',company_code:'ftx',enabled:'1'}),{URL,URLSearchParams,AbortController,setTimeout,clearTimeout,location:{origin:base,href:base+'/dashboard-gym-client'},document:{querySelector:()=>({content:'csrf-private'})},window:{SpecialCalendarPush:{ensureRegistered:async()=>{throw Error('denied');}},ReactNativeWebView:{postMessage:value=>messages.push(JSON.parse(value))}},fetch:async(...args)=>calls.push(args)});
 await new Promise(setImmediate);assert.equal(calls.length,0);assert.equal(messages[0].reason,'push_permission');
});
function hook(){
 const slots=[],effects=[],scripts=[],timers=new Map(),links=[];let cursor=0,seq=0;
 const react={useState(value){const i=cursor++;if(!(i in slots))slots[i]=value;return[slots[i],v=>slots[i]=v];},useRef(value){const i=cursor++;return slots[i]||(slots[i]={current:value});},useCallback:fn=>fn,useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((v,n)=>v!==old.deps[n]))effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});}};
 // Keep useCallback identities stable, like React, so effect tests are realistic.
 react.useCallback=(fn,deps)=>{const i=cursor++,old=slots[i];if(!old||deps.some((v,n)=>v!==old.deps[n]))slots[i]={fn,deps};return slots[i].fn;};
 const ref={current:{injectJavaScript:script=>scripts.push(script)}};
 const module=load('utils/useClientBookings.js',{react,'react-native':{AppState:{addEventListener:()=>({remove(){}})},Linking:{openURL:async url=>links.push(url)}},'./nativeGymCore':gym,'./clientBookingsCore':core},{setTimeout:fn=>{timers.set(++seq,fn);return seq;},clearTimeout:id=>timers.delete(id)});
 let account='a'.repeat(64),showing=true,language='en';
 const render=()=>{cursor=0;const result=module.default(ref,base,account,showing,language);while(effects.length)effects.shift()();return result;};
 const config=()=>JSON.parse(scripts.at(-1).match(/\)\((\{.*\})\);true;$/s)[1]);
 const reply=(id,result,status=200,url=base)=>render().onMessage({url,data:JSON.stringify({type:core.CLIENT_BOOKINGS_MESSAGE,id,result,status})});
 render();return {render,scripts,links,config,reply,setAccount:value=>{account=value;return render();},setLanguage:value=>{language=value;return render();},async ready(){reply(config().id,{success:true,data:snapshot()});await new Promise(setImmediate);return render();}};
}
test('native schedule ignores stale date responses and clears another account immediately',async()=>{
 const h=hook();await h.ready();const first=h.render().load({date:'2026-12-31'}),a=h.config().id;const second=h.render().load({date:'2027-01-01'}),b=h.config().id;
 h.reply(b,{success:true,data:snapshot('2027-01-01')});await second;h.reply(a,{success:true,data:snapshot('2026-12-31')});await first;
 assert.equal(h.render().page.date,'2027-01-01');assert.equal(h.setAccount('b'.repeat(64)).page,null);assert.equal(h.render().page,null);
});
test('booking submits once, refreshes native rows and preserves managed-client parameters',async()=>{
 const h=hook();await h.ready();const action=snapshot().rows[0].actions[0],before=h.scripts.length;
 const booked=h.render().perform(action);await h.render().perform(action);assert.equal(h.scripts.length,before+1);
 assert.equal(h.config().params.client_guid,'self');h.reply(h.config().id,{success:true,message:'Booked'});await new Promise(setImmediate);
 assert.equal(h.config().action,'schedule');h.reply(h.config().id,{success:true,data:snapshot('2026-12-30',true)});await booked;
 assert.equal(h.render().page.rows[0].actions[0].kind,'cancel-booking');assert.equal(h.render().notice,'Booked');
});
test('authorization failure removes cached classes and unrelated origins cannot resolve requests',async()=>{
 const h=hook();await h.ready();const request=h.render().load(),id=h.config().id;
 h.reply(id,{success:true,data:snapshot('2027-01-01')},200,'https://other.example');assert.equal(h.render().page.date,'2026-12-30');
 h.reply(id,{success:false},403);await request;assert.equal(h.render().page,null);assert.equal(h.render().reference,'HTTP_403');
});
test('shared class URL and family selection survive the first authenticated schedule load',async()=>{
 const h=hook();await h.ready();h.render().onLoadEnd(base+'/dashboard-gym-client/index?date=2027-01-02&schedule_id=7&client_guid=child');
 assert.equal(h.config().params.client_guid,'child');assert.equal(h.config().params.date,'2027-01-02');assert.equal(h.render().focused,null,'Do not consume the class link against the previous date');
 h.reply(h.config().id,{success:true,data:{...snapshot('2027-01-02'),clientGuid:'child'}});await new Promise(setImmediate);assert.equal(h.render().page.clientGuid,'child');assert.equal(h.render().focused,'7');
});

test('native checkout only opens the trusted Stripe checkout host and refreshes on success',async()=>{
 const h=hook();await h.ready();const action={kind:'start-stripe-payment',enabled:true,params:snapshot().rows[0].actions[0].params};
 const refused=h.render().perform(action);h.reply(h.config().id,{success:true,checkout_url:'https://other.example/checkout'});await refused;
 assert.equal(h.links.length,0);assert.equal(h.render().error,'invalid_response');
 const checkout=h.render().perform(action);h.reply(h.config().id,{success:true,checkout_url:'https://checkout.stripe.com/c/pay/test'});await new Promise(setImmediate);
 h.reply(h.config().id,{success:true,data:snapshot()});await checkout;assert.deepEqual(h.links,['https://checkout.stripe.com/c/pay/test']);
});

test('language changes refresh server action labels while retaining the native schedule',async()=>{
 const h=hook();await h.ready();h.setLanguage('pt');assert.equal(h.config().action,'schedule');assert.equal(h.render().page.date,'2026-12-30');
 const page=snapshot();page.rows[0].actions[0].label='Reservar aula';h.reply(h.config().id,{success:true,data:page});await new Promise(setImmediate);
 assert.equal(h.render().page.rows[0].actions[0].label,'Reservar aula');
});
function nodes(tree){return !tree||typeof tree!=='object'?[]:[tree,...(tree.props?.children||[]).flat(Infinity).flatMap(nodes)];}
test('client schedule renders native filter, class actions, family controls and matching share component',()=>{
 const slots=[];let cursor=0;const react={useState:v=>{const i=cursor++;if(!(i in slots))slots[i]=v;return [slots[i],value=>slots[i]=typeof value==='function'?value(slots[i]):value];},useEffect(){},useMemo:fn=>fn(),useRef:v=>({current:v}),createElement:(type,props,...children)=>({type,props:{...props,children}})};
 const native=Object.fromEntries(['ActivityIndicator','Modal','Pressable','RefreshControl','ScrollView','Switch','View'].map(name=>[name,name]));let confirmation;
 const component=load('screens/NativeClientBookings.js',{react,'react-native':{...native,Alert:{alert:(...args)=>confirmation=args},StyleSheet:{create:v=>v}},'./NativeGymTypography':{Text:'Text',Icon:'Icon'},'./NativeScheduleFilter':'ScheduleFilter','./NativeClassShare':'ClassShare','./NativeAdminHeader':{ShareIcon:'ShareIcon'},'../utils/calendarAlerts':{showCalendarFailure(){}},'../utils/nativeCalendar':{createClassCalendarHandler:()=>async()=>{}},'../utils/gymUiTheme':{__esModule:true,default:{},brandSoft:()=>''}}).default;
 const page={...snapshot(),member:{name:'Selected child',number:1619,companyName:'FTX',status:'active'},upcomingBookings:[{id:2,title:'Future class',date:'2027-01-01',status:'booked'}],bookingHistory:[{id:1,title:'Past class',date:'2026-01-01',status:'attended'}]};
 const props={base,color:'#198754',language:'en',sharing:{searchShareClients:async()=>[],sendClassInvitation:async()=>{}},bookings:{page,load(){},perform(){},closeFocused(){}}};
 const render=()=>{cursor=0;return nodes(component(props));};let tree=render();assert.ok(tree.some(node=>node.type==='ScheduleFilter'));
 assert.ok(!tree.some(node=>node.props.label==='View class'));
 const detailsId='class-details-'+page.rows[0].key;
 assert.ok(!tree.some(node=>node.props.testID===detailsId));
 tree.find(node=>node.props.accessibilityLabel==='Details: Muay Thai').props.onPress();tree=render();
 assert.ok(tree.some(node=>node.props.testID===detailsId));
 tree.find(node=>node.props.accessibilityLabel==='Details: Muay Thai').props.onPress();tree=render();
 assert.ok(!tree.some(node=>node.props.testID===detailsId));
 const actionRow=tree.find(node=>node.type==='View'&&node.props.children.flat(Infinity).some(child=>child?.props?.accessibilityLabel==='Share class'));
 assert.ok(actionRow.props.children.flat(Infinity).some(child=>child?.props?.label==='Book class'),'Primary booking action shares the utility button row');
 assert.ok(tree.some(node=>node.props.accessibilityLabel==='Add to calendar'));const share=tree.find(node=>node.props.accessibilityLabel==='Share class');share.props.onPress();tree=render();assert.ok(tree.some(node=>node.type==='ClassShare'&&node.props.embedded));assert.equal(tree.filter(node=>node.type==='Modal'&&node.props.visible).length,1);
 const book=tree.find(node=>node.props.label==='Book class');book.props.onPress();assert.equal(confirmation[0],'Book class');
 assert.ok(!tree.some(node=>node.props.testID==='native-member-summary'),'Member identity and booking shortcuts are now in the shared client header');
});
