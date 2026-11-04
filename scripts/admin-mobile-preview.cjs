// Local visual QA of the production React Native screens, using sample data only.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'..'),out=path.join(root,'build','admin-mobile-preview');
const company=require('../config/select-domain.cjs')();
const fullMenu=require('../tests/fixtures/admin-menu-preview.json');
fs.mkdirSync(out,{recursive:true});
const source=relative=>JSON.stringify(path.join(root,relative).replaceAll('\\','/'));
fs.writeFileSync(path.join(out,'environment.jsx'),`
import React from 'react';import {View,Text,Alert} from 'react-native-web';
export const useFonts=()=>[true];
Alert.alert=(title,message,buttons)=>{if(!buttons){window.alert(title+(message?'\\n'+message:''));return;}if(window.confirm(title+'\\n'+(message||''))){const action=buttons.find(button=>button.style!=='cancel');action?.onPress?.();}};
export const useSafeAreaInsets=()=>({top:12,bottom:8,left:0,right:0});
export const setStringAsync=()=>Promise.resolve();
export const requireOptionalNativeModule=()=>null;
const saved=new Map();export const getItemAsync=key=>Promise.resolve(saved.get(key)||null);export const setItemAsync=(key,value)=>{saved.set(key,value);return Promise.resolve();};export const deleteItemAsync=key=>{saved.delete(key);return Promise.resolve();};
export const CryptoDigestAlgorithm={SHA256:'SHA-256'};export const randomUUID=()=>crypto.randomUUID();export const digestStringAsync=async(algorithm,value)=>Array.from(new Uint8Array(await crypto.subtle.digest(algorithm,new TextEncoder().encode(value)))).map(value=>value.toString(16).padStart(2,'0')).join('');
export default function companyAppConfig(){return ${JSON.stringify({siteUrl:company.siteUrl,pagecode:company.pagecode,color:company.brandColor,domain:company.domain})};}
export function Scanner({visible}){return visible?<View><Text>Camera preview is available on the installed app.</Text></View>:null;}
`);
fs.writeFileSync(path.join(out,'entry.jsx'),`
import React,{useState,useCallback} from 'react';import {createRoot} from 'react-dom/client';
import {View,Text,Pressable} from 'react-native-web';
import Frame from ${source('src/screens/NativeAdminFrame.js')};
import Shell from ${source('src/screens/NativeAdminShell.js')};
import {SplashArtwork} from ${source('src/screens/AnimatedSplashScreen.js')};
import NativeClassShare from ${source('src/screens/NativeClassShare.js')};
import ClientShell from ${source('src/screens/NativeGymShell.js')};
import NativeAuthScreen from ${source('src/screens/NativeAuthScreen.js')};
import {authPageKind} from ${source('src/utils/nativeAuthCore.js')};
import useCompanyColor from ${source('src/utils/useCompanyColor.js')};
import {NativeFontContext} from ${source('src/screens/NativeGymTypography.js')};
const base=${JSON.stringify(company.siteUrl)};
const footer=[['Dashboard','dashboard-gym'],['Clients','clients-list'],['Classes','gym-classes'],['Memberships','memberships']].map(([label,route])=>({label,url:base+'/'+route}));
const klass={schedule_id:7,date:'2026-10-30',class_name:'Muay Thai',start_time:'09:00',end_time:'10:30',coach:'Coach',room:'Main studio',capacity:24,stats:{registered:12},status:{label:'Upcoming'},can_manage:true,can_add_experimental_guest:true,
 shareUrl:base+'/dashboard-gym-client/index?company_code=${company.pagecode}&date=2026-10-30&schedule_id=7',calendarUrl:'https://calendar.google.com/calendar/render?action=TEMPLATE',calendarEvent:{title:'Muay Thai',startDate:'2026-10-30T09:00:00Z',endDate:'2026-10-30T10:30:00Z',location:'Main studio',notes:'',url:base+'/dashboard-gym-client/index?date=2026-10-30&schedule_id=7'}};
const fields=[{name:'MembershipSearch[q]',label:'Search',value:'',type:'search',options:[]},
  {name:'MembershipSearch[status]',label:'Status',value:'',type:'select',options:[{value:'',label:'All'},{value:'active',label:'Active'},{value:'expired',label:'Expired'}]},
  {name:'MembershipSearch[membership_type]',label:'Billing cycle',value:'',type:'select',options:[{value:'',label:'All'},{value:'monthly',label:'Monthly'},{value:'yearly',label:'Yearly'}]},
  {name:'payment_status',label:'Payment status',value:'',type:'select',options:[{value:'',label:'All'},{value:'paid',label:'Paid'},{value:'debt',label:'In debt'}]}];
const pages={
 'dashboard-gym':{title:'Dashboard',kind:'dashboard',rows:[],filters:[],summary:[{label:'Classes today',value:'6'},{label:'Registered',value:'42'},{label:'Attended',value:'18'},{label:'Pending',value:'24'}]},
 'memberships':{title:'Memberships',kind:'memberships',filters:fields,rows:[
   {id:'1',title:'Alex Morgan',description:'Monthly unlimited · 01 Oct – 31 Oct',badges:['Active','€45 / month','Paid'],links:[{label:'View membership',url:base+'/memberships/update?id=1'}]},
   {id:'2',title:'Taylor Silva',description:'12 classes · 01 Oct – 31 Oct',badges:['Active','€35 / month','Pending'],links:[{label:'View membership',url:base+'/memberships/update?id=2'}]},
   {id:'3',title:'Jordan Costa',description:'Annual unlimited · 01 Jan – 31 Dec',badges:['Active','Paid'],links:[]} ]},
 'clients-list':{title:'Clients',kind:'clients',filters:[],rows:[
   {id:'1',title:'Alex Morgan',description:'Member · Last visit today',badges:['Active'],links:[{label:'View profile',url:base+'/clients-list/view?id=1'}]},
   {id:'2',title:'Taylor Silva',description:'Member · 12 classes',badges:['Active'],links:[]}]},
 'gym-classes':{title:'Classes',kind:'catalog',filters:[],rows:[{id:'1',title:'Muay Thai',description:'Main studio · 90 minutes',badges:['Active','Capacity 24'],links:[]}]},
};
function AuthPreview(){
 const [kind,setKind]=useState(new URLSearchParams(location.search).get('auth')||'login'),[notice,setNotice]=useState('');
 const [language,setLanguage]=useState(new URLSearchParams(location.search).get('lang')==='pt'?'pt':'en');
 const field=(id,label,type='text',extra={})=>({id,label,type,value:type==='checkbox'?false:'',required:true,error:'',placeholder:'',maxLength:255,options:[],...extra});
 const fields=kind==='login'?[field('username','Username','text',{autocomplete:'username'}),field('password','Password','password')]:kind==='register'?[field('first','First name'),field('last','Last name'),field('dob','Date of birth','date'),field('email','Email','email'),field('username','Username','text',{autocomplete:'username'}),field('password','Password','password'),field('location','Club location','select',{options:[{value:'',label:'Choose location'},{value:'main',label:'Main studio'},{value:'second',label:'Training room'}]}),field('terms','I accept the terms and privacy policy','checkbox')]:kind==='reset'?[field('password','New password','password')]:[field('email','Email','email')];
 const routes={login:'/login',register:'/form-signup',forgot:'/site/request-password-reset',reset:'/site/reset-password'};
 const auth={active:true,checkingSession:new URLSearchParams(location.search).get('session')==='checking',kind,language,setLanguage,busy:false,error:'',document:{revision:kind,kind,company:${JSON.stringify(company.title)},language,fields,messages:notice?[notice]:[],canSubmit:true,submitLabel:{login:'Sign in',register:'Create account',forgot:'Send reset link',reset:'Save password'}[kind],links:Object.entries(routes).filter(([key])=>key!==kind&&key!=='reset').map(([key,url])=>({url:base+url,label:{login:'Back to sign in',register:'Create account',forgot:'Forgot password'}[key]}))},open:url=>{setNotice('');setKind(authPageKind(url,base));},login:()=>setKind('login'),retry(){},submit:()=>setNotice(language==='pt'?'Apenas uma demonstração. Não foi enviado qualquer pedido de início de sessão, criação de conta ou email.':'Sample preview only. No login, account creation or email request was sent.')};
 return <NativeFontContext.Provider value={true}><div className="qa"><strong>Native authentication preview</strong><span>Sample forms only · no account or email requests</span></div><div className="phone"><View style={{flex:1,position:'relative'}}><NativeAuthScreen auth={auth} base={base} color=${JSON.stringify(company.brandColor)}/></View></div></NativeFontContext.Provider>;
}
function App(){
 const parameters=new URLSearchParams(location.search);
 if(parameters.has('auth'))return <AuthPreview/>;
 if(parameters.has('splash'))return <div className="phone"><View style={{flex:1,position:'relative',backgroundColor:'#fff',justifyContent:'center',alignItems:'center'}}><SplashArtwork/></View></div>;
 const previewTeam=parameters.get('role')==='team';
 const [clubColor,setClubColor]=useState(${JSON.stringify(company.brandColor)});
 const [previewShare,setPreviewShare]=useState(parameters.has('shareClients'));
 const [clientSignedOut,setClientSignedOut]=useState(false);
 const [clientTab,setClientTab]=useState(parameters.has('timer')?'timer':'web'),[clientSection,setClientSection]=useState('bookings'),[clientBooked,setClientBooked]=useState({}),[clientFamily,setClientFamily]=useState('self'),[clientAlerts,setClientAlerts]=useState(false),[clientWaiver,setClientWaiver]=useState(true),[clientNotice,setClientNotice]=useState('');
 const clientRequest=useCallback(async action=>action==='birthdays'?{rows:[{id:'1',title:'Taylor Silva',today:true}]}:action==='notifications'?{rows:[],unread:0,hasMore:false}:{rows:[],hasMore:false},[]);
 const color=useCompanyColor(${JSON.stringify(company.pagecode)},clubColor,${JSON.stringify(company.brandColor)});
 const [route,setRoute]=useState(parameters.get('page')||(previewTeam?'dashboard-gym':'memberships')),[screen,setScreen]=useState('web'),[startup,setStartup]=useState(parameters.get('state')||'active');
 const [language,setLanguage]=useState('en'),[read,setRead]=useState({}),[rosterOpen,setRosterOpen]=useState(false),[status,setStatus]=useState('pending');
 const [date,setDate]=useState('2026-10-30'),[notice,setNotice]=useState(''),[localScreen,setLocalScreen]=useState(parameters.has('timer')?'timer':null),[classCode,setClassCode]=useState('');
 const url=base+'/'+route,model=pages[route]||(route!=='memberships/update'?{title:route.split('/')[0].replaceAll('-',' '),kind:'web',rows:[],filters:[]}:{title:'Edit membership',kind:'form',rows:[],filters:[],form:{id:'form',label:'Save membership',errors:[],fields:[
  {id:'title',key:'title',label:'Membership title',value:'Monthly unlimited',type:'text'},
  {id:'price',key:'price',label:'Price',value:'45.00',type:'number'},
  {id:'active',key:'active',label:'Active',value:true,type:'checkbox'}]}});
 const page={...model,url,links:[],actions:[],pagination:[],notices:notice?[notice]:[],filterAction:url};
 const localizeMenu=items=>items.map(item=>({...item,label:item.labels[language]||item.label,url:item.url?new URL(item.url,base+'/').href:null,children:localizeMenu(item.children)}));
 const menuTree=localizeMenu(${JSON.stringify(fullMenu.items)});
 const notificationRows=[
   {id:'notice',title:language==='pt'?'Atualização de aula':'Class update',body:language==='pt'?'O horário do clube foi atualizado.':'Your club schedule has been updated.'},
   {id:'task',type:'task',title:language==='pt'?'Lembrete de tarefa':'Task reminder',body:language==='pt'?'Rever as presenças das aulas de hoje.':'Review attendance for today’s classes.'}
 ].map(row=>({...row,read:!!read[row.id],control:row.id,disabled:false,meta:(language==='pt'?'Hoje':'Today')+' · '+(read[row.id]?(language==='pt'?'Lida':'Read'):(language==='pt'?'Não lida':'Unread'))}));
 const document={language,page,footer:previewTeam&&parameters.has('restricted')?footer.slice(0,Number(parameters.get('restricted'))||2):footer,menuTree,menu:[...footer,{label:'Attendance',url:base+'/gym-attendance'}],create:[{label:'Create membership',url:base+'/memberships/create'},{label:'Create class',url:base+'/gym-classes/create'}],accountActions:[{id:'logout',label:'Log out',kind:'logout'}],scanner:parameters.get('clientDetails')==='denied'?null:{},
 header:{color:clubColor,company:${JSON.stringify(company.title)},user:{name:'Alex Morgan',level:previewTeam?'team':'Administrator'},language:{id:'language',value:language,options:[{value:'en',label:'English'},{value:'pt',label:'Português'}]},
 notifications:{count:notificationRows.filter(row=>!row.read).length,rows:notificationRows},birthdays:{rows:[{id:'1',title:'Alex Morgan',body:'30/10',today:true,isSelf:true,url:null},{id:'2',title:'Taylor Silva',body:'30/10',today:true,isSelf:false,url:null}]},share:{url:base+'/form-signup'}}};
 const navigate=value=>{if(new URL(value).pathname==='/workout-timer'){setLocalScreen('timer');setScreen('web');return;}setLocalScreen(null);setRoute(new URL(value).pathname.slice(1));setStartup('active');setScreen('web');setNotice('');};
 const occurrenceLink=new URL(klass.shareUrl);occurrenceLink.searchParams.set('date',date);
 const admin={onDashboard:true,context:{language,classes:[{...klass,date,shareUrl:occurrenceLink.href}],date,today:'2026-10-30',classCode,classFilters:[{code:'muay-thai',label:'Muay Thai'}],total:1,hasMore:false},screen,showDashboard:()=>setScreen('web'),showClasses:()=>setScreen('classes'),
 searchShareClients:async q=>[{id:1,name:'Alex Morgan'},{id:2,name:'Taylor Silva'},{id:3,name:'Jordan Costa'}].filter(row=>row.name.toLowerCase().includes(q.toLowerCase())),sendClassInvitation:async()=>({success:true}),
 loadClasses:(next,more,code=classCode)=>{setDate(next||date);setClassCode(code);},loadRoster:()=>setRosterOpen(true),closeRoster:()=>setRosterOpen(false),rosterOpen,
 roster:{class:{...klass,date},participants:[{booking_id:1,member_name:'Alex Morgan',status,status_label:status,is_experimental_guest:false}]},
 members:[],searchMembers:()=>{},mutate:async(action,params)=>{if(action==='attendance')setStatus(params.status);return {};}};
 const state={document:startup==='active'?document:null,page:startup==='active'?page:null,localScreen,sessionVersion:0,startup,busy:false,error:startup==='failed'?'native_setup':'',web:false,
 navigate,openWeb:()=>setNotice('This is a visual preview. The installed app opens its authorized editor.'),showWeb:()=>setNotice('Editor preview'),showNative:()=>{},
 change:(id,value)=>id==='language'?setLanguage(value):setRead(previous=>({...previous,[id]:value})),invoke:id=>id==='logout'?setClientSignedOut(true):setNotice('Saved in preview only.'),refresh:()=>setNotice('Updated preview.'),retry:()=>setStartup('active'),
 scrollOffset:()=>0,rememberScroll:()=>{},back:()=>{setLocalScreen(null);return !!localScreen;}};
 if(clientSignedOut)return <AuthPreview/>;
 if(parameters.has('client')){
   const samples=[{id:7,name:'Muay Thai',code:'muay',start:'09:00',end:'10:30',available:12,past:false},{id:8,name:'Jiu Jitsu',code:'jiu',start:'16:30',end:'18:00',available:0,past:false},{id:9,name:'Muay Thai',code:'muay',start:'07:00',end:'08:00',available:8,past:true}];
   const sampleRows=samples.map(row=>{const booked=clientBooked[row.id]==='booked',waitlisted=clientBooked[row.id]==='waitlisted',params={schedule_id:row.id,date,client_guid:clientFamily,company_code:${JSON.stringify(company.pagecode)},class_code:row.code};const kind=booked?'cancel-booking':waitlisted?'leave-waitlist':row.available?'book':'join-waitlist';return {key:row.id+':'+date,schedule_id:row.id,class_name:row.name,class_code:row.code,date,start_time:row.start,end_time:row.end,past:row.past,status:row.past?'finished':'upcoming',booked,waitlisted,capacity:24,registered:24-row.available,available:row.available,coach:'Coach',room:'Main studio',description:'Technique, conditioning and practice. Bring water and your training equipment.',participants:[{name:'Taylor Silva'},{name:'Jordan Costa'}],actions:row.past?[]:[{kind,label:booked?'Cancel booking':waitlisted?'Leave waitlist':row.available?'Book class':'Join waitlist',enabled:true,params}],shareUrl:base+'/dashboard-gym-client/index?company_code=${company.pagecode}&date='+date+'&schedule_id='+row.id,calendarUrl:klass.calendarUrl,calendarEvent:{...klass.calendarEvent,title:row.name,startDate:date+'T'+row.start+':00Z',endDate:date+'T'+row.end+':00Z'}};});
   const clientPage={member:{name:clientFamily==='child'?'Sam Morgan':'Alex Morgan',number:clientFamily==='child'?2:1,companyName:'FTX Team',avatarUrl:null,status:'active'},upcomingBookings:[{id:2,title:'Muay Thai',date:'2026-10-31',status:'booked'}],bookingHistory:[{id:1,title:'Muay Thai',date:'2026-10-29',status:'attended'}],revision:'native-client-bookings-v1',date,today:'2026-10-30',serverTime:'2026-10-30T08:00:00Z',companyCode:${JSON.stringify(company.pagecode)},clientGuid:clientFamily,family:[{guid:'self',name:'Alex Morgan'},{guid:'child',name:'Sam Morgan'}],classFilters:[{code:'muay',label:'Muay Thai'},{code:'jiu',label:'Jiu Jitsu'}],rows:sampleRows,alertsReady:true,openingWindow:48,alerts:[{code:'muay',name:'Muay Thai',enabled:clientAlerts}],waivers:clientWaiver?[{code:'terms',title:'Training agreement',content:'Sample training agreement. Read the club rules and confirm before signing. This preview does not save a real signature.'}]:[],history:[{id:1,title:'Muay Thai',date:'2026-10-29',status:'attended'}],kpis:{classes_remaining:8,outstanding_balance:0},membership:{title:'Monthly membership',start:'01/10/2026',end:'31/10/2026'}};
   const clientBookings={page:clientPage,busy:false,error:'',reference:'',notice:clientNotice,focused:null,closeFocused(){},load:async(params={})=>{if(params.date)setDate(params.date);if(params.client_guid)setClientFamily(params.client_guid);},perform:async action=>{if(['book','cancel-booking','join-waitlist','leave-waitlist'].includes(action.kind))setClientBooked(previous=>({...previous,[action.params.schedule_id]:action.kind==='book'?'booked':action.kind==='join-waitlist'?'waitlisted':''}));if(action.kind==='booking-alert')setClientAlerts(action.params.enabled==='1');if(action.kind==='sign-waiver')setClientWaiver(false);setClientNotice('Saved in preview only.');return true;}};
   const clientGym={data:{accountKey:'a'.repeat(64),language,client:{name:'Alex Morgan',number:1},company:{name:${JSON.stringify(company.title)}},features:{pass:true,sessions:true,timer:true,week:false},pass:null,serverTime:clientPage.serverTime,timezone:'Europe/Lisbon',bookings:[],unreadNotifications:0},screen:clientTab,webSection:clientSection,busy:false,request:clientRequest,showBookings:()=>{setClientSection('bookings');setClientTab('web');},select:setClientTab,setLanguage:async value=>setLanguage(value),refresh:async()=>{},signIn:()=>setClientSignedOut(false),logout:async()=>{setClientSignedOut(true);setClientBooked({});setClientNotice('');setClientFamily('self');setClientTab('web');setClientSection('bookings');},openWeb:route=>{if(route==='bookings'){setClientSection('bookings');setClientTab('web');}else window.alert('This preview focuses on native class booking.');}};
   return <><div className="qa"><strong>FTX client bookings</strong><span>Native components · sample data</span></div><div className="phone"><ClientShell gym={clientGym} bookings={clientBookings} sharing={admin} brandColor={color}><View/></ClientShell></div></>;
 }
 return <><div className="qa"><strong>{previewTeam?'FTX mobile team':'FTX mobile admin'}</strong><span>{previewTeam?'Team layout · sample data and permissions':'Interactive preview · sample data'}</span>
 <label>Club color (preview) <input aria-label="Club color (preview)" type="color" value={clubColor} onInput={event=>setClubColor(event.target.value)} onChange={event=>setClubColor(event.target.value)}/></label>
 <div>{Object.keys(pages).map(key=><button key={key} onClick={()=>navigate(base+'/'+key)}>{pages[key].title}</button>)}
 <button onClick={()=>setStartup('loading')}>Loading</button><button onClick={()=>setStartup('failed')}>Error</button></div></div>
 <div className="phone"><NativeFontContext.Provider value={true}><Frame pages={state} admin={admin} brandColor={color} onBack={()=>navigate(base+'/dashboard-gym')}>
 <Shell admin={admin} framed brandColor={color}><View><Text>Website content remains hidden in the native admin.</Text></View></Shell>
 </Frame>{previewShare&&<NativeClassShare item={{...klass,date}} language={language} color={color} search={admin.searchShareClients} send={admin.sendClassInvitation} onClose={()=>setPreviewShare(false)}/>}</NativeFontContext.Provider></div></>;
}
createRoot(document.getElementById('root')).render(<App/>);
`);
const environment=path.join(out,'environment.jsx');
fs.writeFileSync(path.join(out,'constants.js'),`export default {expoConfig:{name:${JSON.stringify(company.title)}}};`);
fs.writeFileSync(path.join(out,'scanner.jsx'),"export {Scanner as default} from './environment.jsx';");
fs.writeFileSync(path.join(out,'calendar-actions.js'),"export const createClassCalendarHandler=()=>async()=>{alert('Calendar opens on the installed phone. This is a sample-data preview.');};");
fs.writeFileSync(path.join(out,'timer-alerts.js'),"export const cancelTimerAlert=()=>Promise.resolve();export default {permission:async()=>true,cue:async()=>{},sync:async()=>{},finish:async()=>{},cancel:async()=>{}};");
fs.writeFileSync(path.join(out,'fitness-calendar.js'),"let rows=[{id:'sample',title:'Sample class',startDate:'2026-11-02T09:00:00Z',endDate:'2026-11-02T10:00:00Z'}];export const fitnessCalendar=()=>({list:async()=>rows,remove:async id=>{rows=rows.filter(row=>row.id!==id);}});");
async function main(){
await esbuild.build({entryPoints:[path.join(out,'entry.jsx')],bundle:true,outfile:path.join(out,'app.js'),platform:'browser',format:'iife',
  loader:{'.js':'jsx','.png':'dataurl','.ttf':'dataurl'},define:{'process.env.NODE_ENV':'"development"','__DEV__':'true'},
  alias:{'react-native':'react-native-web','react-native-safe-area-context':environment,'expo-font':environment,'expo-clipboard':environment,'expo-crypto':environment,'expo-secure-store':environment,'expo-modules-core':environment},
  plugins:[{name:'preview-native-environment',setup(build){
    build.onResolve({filter:/^expo-constants$/},()=>({path:path.join(out,'constants.js')}));
    build.onResolve({filter:/companyAppConfig$/},()=>({path:environment}));
    build.onResolve({filter:/NativeAdminScanner$/},()=>({path:path.join(out,'scanner.jsx')}));
    build.onResolve({filter:/nativeCalendar$/},()=>({path:path.join(out,'calendar-actions.js')}));
    build.onResolve({filter:/fitnessCalendar$/},()=>({path:path.join(out,'fitness-calendar.js')}));
    build.onResolve({filter:/nativeTimerAlerts$/},()=>({path:path.join(out,'timer-alerts.js')}));
  }}],
});
for(const file of ['boxicons.ttf','BricolageGrotesque-Bold.ttf','Poppins-Regular.ttf','Poppins-SemiBold.ttf'])fs.copyFileSync(path.join(root,'src/assets/fonts',file),path.join(out,file));
fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FTX mobile admin preview</title><style>
@font-face{font-family:GymBoxicons;src:url('/boxicons.ttf')}@font-face{font-family:GymHeading;src:url('/BricolageGrotesque-Bold.ttf')}@font-face{font-family:GymBody;src:url('/Poppins-Regular.ttf')}@font-face{font-family:GymBodySemiBold;src:url('/Poppins-SemiBold.ttf')}
*{box-sizing:border-box}html,body,#root{margin:0;min-height:100%;font-family:GymBody,Arial,sans-serif}body{background:#e7edf1}.qa{max-width:840px;margin:16px auto;text-align:center;color:#26354b;font-size:12px}.qa strong{display:block;font:22px GymHeading}.qa span{display:block;color:#65758b;margin:5px}.qa button{border:1px solid #c7d4dc;border-radius:10px;background:white;padding:7px 10px;margin:3px;color:#26354b;cursor:pointer}.phone{display:flex;flex-direction:column;width:min(406px,100vw);height:calc(100dvh - 140px);min-height:560px;max-height:852px;margin:12px auto 24px;border:8px solid #172230;border-radius:34px;overflow:hidden;background:#f5f7fa;box-shadow:0 18px 60px #17223024}
@media(max-width:480px){.phone{border:0;border-radius:0;margin:0;width:100vw;height:calc(100dvh - 126px);min-height:500px}.qa{margin:10px 4px}}
.appOnly .qa{display:none}.appOnly .phone{width:100vw;height:100dvh;max-height:none;min-height:0;margin:0;border:0;border-radius:0;box-shadow:none}
</style></head><body><div id="root"></div><script>if(new URL(location.href).searchParams.has('app'))document.documentElement.classList.add('appOnly');</script><script src="/app.js"></script></body></html>`);
console.log('Native component preview built: '+out);
if(process.argv.includes('--serve')){
  http.createServer((req,res)=>{
    if(req.method!=='GET'){res.writeHead(405);res.end();return;}
    let requested;try{requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
    const target=path.resolve(out,'.'+(requested==='/'?'/index.html':requested)),relative=path.relative(out,target);
    if(relative.startsWith('..')||path.isAbsolute(relative)||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);res.end();return;}
    const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.ttf':'font/ttf'}[path.extname(target)]||'application/octet-stream';
    res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'});fs.createReadStream(target).pipe(res);
  }).listen(4173,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:4173'));
}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
