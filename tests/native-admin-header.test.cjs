const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test'),babel=require('@babel/core');
function harness(file,extra={}){
  const slots=[],effects=[];let cursor=0;
  const react={Fragment:'Fragment',createElement:(type,props,...children)=>({type,props:{...props,children}}),
    useState(value){const i=cursor++;if(!(i in slots))slots[i]=typeof value==='function'?value():value;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},
    useRef(value){const i=cursor++;if(!(i in slots))slots[i]={current:value};return slots[i];},
    useEffect(fn,deps){const i=cursor++,previous=slots[i];if(!previous||deps.some((value,index)=>value!==previous[index]))effects.push(fn);slots[i]=deps;}};
  const native=Object.fromEntries(['View','Pressable','Image','Modal','ScrollView','Switch','ActivityIndicator','FlatList','KeyboardAvoidingView','RefreshControl','TextInput'].map(value=>[value,value]));
  const mocks={react,'react-native':{...native,Alert:{alert(){}},Share:{share:()=>Promise.resolve()},StyleSheet:{create:value=>value},Platform:{OS:'android'}},
    'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:0,bottom:0})},'./NativeGymTypography':{LoadingIndicator:'ActivityIndicator',Icon:'Icon',Text:'Text'},
    '../utils/nativeCompanyBranding':{companyLogoImage:()=>1},'../utils/nativeAdminNavigation':{menuCategoryIcon:()=> 'home',userLevelLabel:level=>level?'Admin':''},'../utils/gymUiTheme':{__esModule:true,default:{},brandSoft:()=>''},
    './NativeSubcategoryTabs':'SubcategoryTabs','../utils/summaryCardLayout':{summaryCardTone:()=>({})},'./NativeCompanyLogo':'CompanyLogo','./NativeFitnessCalendar':'FitnessCalendar','./NativeAdminScanner':'Scanner','./NativeAdminHeader':'Header','./NativeWorkoutTimer':'Timer','../utils/useAdminTimerAccount':()=>null,'../utils/nativeGymTranslations':()=>({}),'expo-clipboard':{},'../utils/nativeAdminPages':{},'../utils/companyAppConfig':()=>({siteUrl:'https://club.example',pagecode:'club',color:'#198754'}),...extra};
  const {code}=babel.transformSync(fs.readFileSync(path.join(__dirname,'../src/screens',file),'utf8'),{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-react-jsx','@babel/plugin-transform-modules-commonjs']});
  const exports={};vm.runInNewContext(code,{exports,URL,require:name=>{assert.ok(name in mocks,name);return mocks[name];}});
  return {exports,mocks,render:(component,props)=>{cursor=0;const tree=component(props);while(effects.length)effects.shift()();return tree;}};
}
function nodes(tree){return !tree||typeof tree!=='object'?[]:[tree,...(tree.props?.children||[]).flat(Infinity).flatMap(nodes)];}

test('an active client shell suppresses stale staff header, footer and More cog',()=>{
 const h=harness('NativeAdminFrame.js',{'../utils/nativeAdminPages':{adminPageLabels:()=>({})}});
 const child={type:'WebView',props:{}},page={url:'https://club.example/group-notifications',kind:'web'};
 const pages={document:{page,header:{user:{level:'team'}},footer:[],menuTree:[],accountActions:[]},page,startup:'active',busy:false};
 const result=h.render(h.exports.default,{enabled:false,pages,admin:{screen:'web'},children:child});
 assert.ok(nodes(result).includes(child));assert.ok(!nodes(result).some(n=>['native-admin-footer','native-admin-startup','native-admin-loading'].includes(n.props?.testID)||n.type==='Header'));
});
test('busy admin loader fills the frame instead of occupying footer layout space',()=>{
 const h=harness('NativeAdminFrame.js',{'../utils/nativeAdminPages':{adminPageLabels:()=>({})}});
 const page={url:'https://club.example/dashboard-gym',kind:'web'};
 const props={pages:{document:{page,header:{},footer:[],menuTree:[],accountActions:[]},page,startup:'active',busy:true},admin:{screen:'web'}};
 const overlay=nodes(h.render(h.exports.default,props)).find(n=>n.props.testID==='native-admin-loading');
 assert.equal(overlay.props.style.position,'absolute');
 for(const edge of ['top','right','bottom','left'])assert.equal(overlay.props.style[edge],0);
 assert.equal(overlay.props.style.justifyContent,'center');assert.equal(overlay.props.style.alignItems,'center');
});
const t=Object.fromEntries(['dashboard','back','menu','close','language','notifications','share','birthdays','markRead','markUnread','emptyNotifications','emptyBirthdays'].map(value=>[value,value]));
test('company logo uses the uploaded aspect ratio without square or circular clipping',()=>{
  const h=harness('NativeCompanyLogo.js'),Logo=h.exports.default;
  const props={url:'https://club.example/logo.png',label:'Club'};
  let image=nodes(h.render(Logo,props)).find(n=>n.props.onLoad);
  image.props.onLoad({nativeEvent:{source:{width:300,height:100}}});
  image=nodes(h.render(Logo,props)).find(n=>n.props.onLoad);
  assert.equal(image.props.style.width/image.props.style.height,3);
  assert.equal(image.props.style.width,104);
  assert.equal(image.props.style.borderRadius,undefined);
  image.props.onLoad({nativeEvent:{source:{width:100,height:200}}});
  image=nodes(h.render(Logo,props)).find(n=>n.props.onLoad);
  assert.equal(image.props.style.width,22);
  assert.equal(image.props.style.height,44);
});

test('header always shows the bundled logo while a remote logo is pending or fails',()=>{
 const h=harness('NativeCompanyLogo.js'),props={url:'https://club.example/logo.png',label:'Club'};
 let tree=nodes(h.render(h.exports.default,props));
 assert.equal(tree.find(n=>n.type==='Image'&&n.props.source===1).props.style.opacity,1);
 const remote=tree.find(n=>n.props.onLoad);
 remote.props.onLoad({nativeEvent:{source:{width:200,height:100}}});
 tree=nodes(h.render(h.exports.default,props));
 assert.equal(tree.find(n=>n.props.onLoad).props.style.opacity,1);
 tree=nodes(h.render(h.exports.default,{...props,url:'https://club.example/changed.png'}));
 assert.equal(tree.find(n=>n.type==='Image'&&n.props.source===1).props.style.opacity,1);
 tree.find(n=>n.props.onError).props.onError();
 tree=nodes(h.render(h.exports.default,{...props,url:'https://club.example/changed.png'}));
 assert.equal(tree.filter(n=>n.type==='Image').length,1);
 assert.equal(tree.find(n=>n.type==='Image').props.style.opacity,1);
});

test('startup with an absent company logo renders its bundled fallback without reading a null remote state',()=>{
 for(const url of [undefined,null,'']){
  const h=harness('NativeCompanyLogo.js');
  const tree=nodes(h.render(h.exports.default,{url,label:'Club'}));
  const images=tree.filter(n=>n.type==='Image');
  assert.equal(images.length,1);assert.equal(images[0].props.source,1);
  assert.equal(images[0].props.style.opacity,1);
  assert.ok(Number.isFinite(images[0].props.style.width));
 }
 const h=harness('NativeCompanyLogo.js');
 let tree=nodes(h.render(h.exports.default,{url:'https://club.example/logo.png'}));
 tree.find(n=>n.props.onLoad).props.onLoad({nativeEvent:{source:{width:200,height:100}}});
 tree=nodes(h.render(h.exports.default,{}));
 assert.equal(tree.filter(n=>n.type==='Image').length,1);
 assert.equal(tree.find(n=>n.type==='Image').props.style.opacity,1);
});
test('native header exposes every screenshot action and uses native notification controls',()=>{
  const changes=[],shared=[];
  const testHarness=harness('NativeAdminHeader.js');
  testHarness.mocks['react-native'].Share.share=value=>{shared.push(value);return Promise.resolve();};
  const Header=testHarness.exports.default;
  const pages={document:{language:'en',page:{url:'https://club.example/memberships'},header:{
    language:{id:'lang',value:'en',options:[{value:'en',label:'English'},{value:'pt',label:'Português'}]},
    notifications:{count:2,rows:[{id:'1',title:'Club news',body:'Update',meta:'Unread',control:'read-1',read:false}]},
    birthdays:{rows:[]},share:{url:'https://club.example/form-signup'}}},change:(...args)=>changes.push(args)};
  const props={pages,t,color:'#198754',onMenu(){},onHome(){}};
  let tree=nodes(testHarness.render(Header,props));
  for(const label of ['language','notifications','birthdays','menu'])assert.ok(tree.some(node=>node.props.label===label),label);
  assert.ok(!tree.some(node=>node.props.label==='share'));assert.equal(shared.length,0);
  tree.find(node=>node.props.label==='notifications').props.onPress();tree=nodes(testHarness.render(Header,props));
  assert.ok(tree.some(node=>node.type==='Modal'&&node.props.visible));
  const toggle=tree.find(node=>node.type==='Switch');toggle.props.onValueChange(true);
  assert.deepEqual(changes,[['read-1',true]]);
  tree.find(node=>node.props.label==='language').props.onPress();tree=nodes(testHarness.render(Header,props));
  tree.find(node=>node.props.accessibilityRole==='radio'&&node.props.accessibilityState.selected===false).props.onPress();
  assert.deepEqual(changes.at(-1),['lang','pt']);
});
test('birthday button badge counts only today and remains visible after opening the panel',()=>{
  const h=harness('NativeAdminHeader.js'),pages={document:{language:'en',page:{url:'https://club.example/dashboard-gym'},header:{birthdays:{rows:[
    {id:'1',title:'Alex',today:true},{id:'2',title:'Sam',today:true},{id:'3',title:'Upcoming',today:false}]}}}};
  const props={pages,t,color:'#198754'};
  let tree=nodes(h.render(h.exports.default,props));let birthday=tree.find(node=>node.props.label==='birthdays');
  assert.equal(birthday.props.count,2);birthday.props.onPress();
  tree=nodes(h.render(h.exports.default,props));assert.equal(tree.find(node=>node.props.label==='birthdays').props.count,2);
  const upcoming={...pages,document:{...pages.document,header:{birthdays:{rows:[{today:false}]}}}};
  assert.equal(nodes(h.render(h.exports.default,{...props,pages:upcoming})).find(node=>node.props.label==='birthdays').props.count,0);
});
test('Team and admin notification panels have a fixed bottom link to the signed-in inbox',()=>{
 for(const level of ['team','admin'])for(const language of ['en','pt']){
  const h=harness('NativeAdminHeader.js'),opened=[],changes=[],label=language==='pt'?'Ver todas as notificações':'View all notifications';
  const props={pages:{document:{language,page:{url:'https://club.example/dashboard-gym'},header:{user:{level},notifications:{count:1,rows:[]}}},openWeb:(...args)=>opened.push(args),change:(...args)=>changes.push(args)},t:{...t,viewAllNotifications:label},color:'#198754'};
  let tree=nodes(h.render(h.exports.default,props));tree.find(n=>n.props.label==='notifications').props.onPress();tree=nodes(h.render(h.exports.default,props));
  const link=tree.find(n=>n.props.testID==='native-admin-view-all-notifications');assert.equal(link.props.accessibilityLabel,label);
  const scroll=tree.find(n=>n.type==='ScrollView');assert.ok(!nodes(scroll).includes(link),'Inbox link remains below the scrolling rows');
  link.props.onPress();assert.equal(opened[0][0],'https://club.example/group-notifications');assert.equal(opened[0][1].reload,true);assert.equal(changes.length,0);
  assert.equal(nodes(h.render(h.exports.default,props)).find(n=>n.type==='Modal').props.visible,false);
 }
});

test('native form preserves an unsaved draft while a notification snapshot refreshes its opaque control IDs',()=>{
  const h=harness('NativeAdminFrame.js'),Form=h.exports.NativeForm,submitted=[];
  const pages={invoke:(id,values)=>submitted.push({id,values}),busy:false};
  const field={id:'1:1',key:'title:0',label:'Title',value:'Old',type:'text'};
  const page={url:'https://club.example/memberships/create',title:'Membership',form:{id:'1:0',fields:[field],errors:[],label:'Save'}};
  const props={page,pages,t:{fullPage:'Full page',save:'Save'},color:'#198754'};
  let tree=nodes(h.render(Form,props));tree.find(node=>node.props.field).props.onChange('Unsaved draft');
  const refreshed={...page,form:{...page.form,id:'2:0',fields:[{...field,id:'2:1'}]}};
  tree=nodes(h.render(Form,{...props,page:refreshed}));assert.equal(tree.find(node=>node.props.field).props.value,'Unsaved draft');
  tree.find(node=>node.props.label==='Save').props.onPress();
  assert.equal(submitted[0].id,'2:0');assert.equal(submitted[0].values['2:1'],'Unsaved draft');
});

test('admin birthday panel greets only the current person whose birthday is today',()=>{
  for(const [today,isSelf,expected] of [[true,true,true],[true,false,false],[false,true,false]]){
    const h=harness('NativeAdminHeader.js'),labels={...t,happyBirthday:'Happy birthday!',happyBirthdayBody:'Have a wonderful day!'};
    const pages={document:{language:'en',page:{url:'https://club.example/dashboard-gym'},header:{birthdays:{rows:[{id:'1',title:'Alex',body:'30/10',today,isSelf}]}}}};
    const props={pages,t:labels,color:'#198754'};
    let tree=nodes(h.render(h.exports.default,props));tree.find(node=>node.props.label==='birthdays').props.onPress();
    tree=nodes(h.render(h.exports.default,props));
    assert.equal(tree.some(node=>node.type==='Text'&&node.props.children.includes('Happy birthday!')),expected);
  }
});

test('client birthday panel greets only the signed-in birthday person',async()=>{
  for(const isSelf of [true,false]){
    const h=harness('NativeBirthdays.js'),labels={...t,happyBirthday:'Happy birthday!',happyBirthdayBody:'Have a wonderful day!'};
    const gym={data:{accountKey:'account'},request:async()=>({rows:[{name:'Alex',date:'30/10',today:true,isSelf}]})};
    const props={gym,t:labels,color:'#198754',visible:true,onClose(){}};
    h.render(h.exports.default,props);await new Promise(resolve=>setImmediate(resolve));
    const tree=nodes(h.render(h.exports.default,props));
    assert.equal(tree.some(node=>node.type==='Text'&&node.props.children.includes('Happy birthday!')),isSelf);
  }
});
test('Settings expands and collapses its children without navigating or opening another modal',()=>{
  const h=harness('NativeAdminFrame.js'),navigations=[];
  const props={item:{id:'settings',label:'Settings',url:null,children:['company','payments-setup','my-plan','profile','legal-documents'].map(url=>({id:url,label:url,url:'https://club.example/'+url,children:[]}))},navigate:url=>navigations.push(url),color:'#198754',currentUrl:'https://club.example/dashboard-gym'};
  let tree=nodes(h.render(h.exports.MenuBranch,props)),toggle=tree.find(node=>node.props.expanded!==undefined);
  assert.equal(toggle.props.expanded,false);toggle.props.onPress();
  tree=nodes(h.render(h.exports.MenuBranch,props));assert.equal(tree.find(node=>node.props.expanded!==undefined).props.expanded,true);
  assert.equal(tree.filter(node=>node.props.item).length,5);assert.equal(tree.filter(node=>node.type==='Modal').length,0);assert.equal(navigations.length,0);
  tree.find(node=>node.props.expanded!==undefined).props.onPress();
  assert.equal(nodes(h.render(h.exports.MenuBranch,props)).filter(node=>node.props.item).length,0);
});

test('admin Menu uses a bounded scrolling body while Logout and Close stay outside it',()=>{
  const h=harness('NativeAdminFrame.js',{'../utils/nativeAdminPages':{adminPageLabels:()=>({menu:'Menu',close:'Close',logout:'Log out'})}});
  const props={pages:{document:{page:{url:'https://club.example/dashboard-gym'},header:{},footer:[],menuTree:[],accountActions:[{id:'logout',kind:'logout'}]},page:{url:'https://club.example/dashboard-gym',kind:'dashboard'},startup:'active'},admin:{screen:'web'},onBack(){}};
  let tree=nodes(h.render(h.exports.default,props));tree.find(node=>node.type==='Header').props.onMenu();
  tree=nodes(h.render(h.exports.default,props));const modal=tree.find(node=>node.type==='Modal'&&node.props.visible),body=nodes(modal).find(node=>node.props.testID==='native-admin-menu-scroll');
  assert.equal(body.props.style.flex,1);assert.equal(body.props.style.minHeight,0);
  assert.ok(nodes(modal).some(node=>Array.isArray(node.props.style)&&node.props.style.some(style=>style?.height==='85%')));
  assert.ok(!nodes(body).some(node=>node.props.testID==='native-admin-menu-logout'));
  assert.ok(nodes(modal).some(node=>node.props.testID==='native-admin-menu-logout'));
});

test('admin header and footer follow a changed club color without remounting',()=>{
  const h=harness('NativeAdminFrame.js',{'../utils/nativeAdminPages':{adminPageLabels:()=>({menu:'Menu',close:'Close'})}});
  const props={pages:{document:{page:{url:'https://club.example/dashboard-gym'},header:{},footer:[],menuTree:[],accountActions:[]},page:{url:'https://club.example/dashboard-gym',kind:'dashboard'},startup:'active'},admin:{screen:'web'},brandColor:'#b52683'};
  assert.equal(nodes(h.render(h.exports.default,props)).find(node=>node.type==='Header').props.color,'#b52683');
  assert.equal(nodes(h.render(h.exports.default,{...props,brandColor:'#1278cc'})).find(node=>node.type==='Header').props.color,'#1278cc');
});

test('admin startup and failure states keep website content hidden',()=>{
  const h=harness('NativeAdminFrame.js',{'../utils/nativeAdminPages':{adminPageLabels:()=>({adminLabel:'Administration',loadingApp:'Loading',setupError:'Failed',retry:'Retry',signIn:'Sign in'})}});
  for(const startup of ['loading','failed']){
    const tree=nodes(h.render(h.exports.default,{pages:{document:null,page:null,startup,retry(){},openWeb(){}},admin:{screen:'web'},children:'Website'}));
    assert.ok(tree.some(node=>node.props.testID==='native-admin-startup'));
    assert.ok(tree.some(node=>node.props.pointerEvents==='none'&&node.props.accessibilityElementsHidden===true));
  }
});

test('root settings keeps the main header while nested settings retains back navigation',()=>{
 const h=harness('NativeAdminFrame.js',{'../utils/nativeAdminPages':{adminPageLabels:()=>({})}});
 for(const [route,expected] of [['company',false],['preferences',false],['company/update?id=7',true]]){
   const page={url:'https://club.example/'+route,kind:'web'},pages={document:{page,header:{},footer:[],menuTree:[],accountActions:[]},page,startup:'active'};
   const header=nodes(h.render(h.exports.default,{pages,admin:{screen:'web'}})).find(node=>node.type==='Header');
   assert.equal(header.props.backVisible,expected,route);
 }
});

test('dashboard never inherits the classes back arrow during a screen transition',()=>{
 const h=harness('NativeAdminFrame.js',{'../utils/nativeAdminPages':{adminPageLabels:()=>({})}});
 for(const route of ['dashboard-gym','dashboard-gym/index?date=2026-11-04'])for(const kind of ['web','dashboard']){
  const page={url:'https://club.example/'+route,kind},pages={document:{page,header:{},footer:[],menuTree:[],accountActions:[]},page,startup:'active',busy:true};
  const tree=nodes(h.render(h.exports.default,{pages,admin:{screen:'classes'}}));
  assert.equal(tree.find(node=>node.type==='Header').props.backVisible,false);
  assert.ok(tree.some(node=>node.props.testID==='native-admin-loading'));
 }
});

test('Team central plus exposes only Scan QR code, outside the main menu, when permitted',()=>{
 for(const allowed of [true,false])for(const count of [2,3,4]){
  const h=harness('NativeAdminFrame.js',{'../utils/nativeAdminPages':{adminPageLabels:()=>({scan:'Scan QR code',menu:'Menu',more:'More'})}});
  const page={url:'https://club.example/dashboard-gym',kind:'web'},scanner=allowed?{companyCode:'club',origins:['https://club.example']}:null;
  const footer=Array.from({length:count},(_,i)=>({url:'https://club.example/page-'+i,label:'Page '+i}));
  const props={pages:{document:{page,scanner,header:{user:{level:'team'}},footer,menuTree:[],menu:[],create:[{label:'Create membership',url:'https://club.example/memberships/create'}],accountActions:[]},page,startup:'active'},admin:{screen:'web'}};
  let tree=nodes(h.render(h.exports.default,props));tree.find(node=>node.type==='Header').props.onMenu();
  tree=nodes(h.render(h.exports.default,props));assert.ok(!tree.some(node=>node.props.label==='Scan QR code'),'Scan is not a main-menu row');
  assert.equal(tree.filter(node=>node.props.accessibilityRole==='tab').length,count);
  assert.equal(tree.some(node=>node.props.accessibilityLabel==='More'),count<4);
  const plus=tree.filter(node=>node.props.testID==='native-team-qr-plus');assert.equal(plus.length,allowed?1:0);
  if(allowed){
   plus[0].props.onPress();tree=nodes(h.render(h.exports.default,props));
   const actions=tree.filter(node=>node.props.label&&typeof node.props.onPress==='function');
   assert.equal(actions.filter(node=>node.props.label==='Scan QR code').length,1);
   assert.ok(!actions.some(node=>node.props.label==='Create membership'));
   actions.find(node=>node.props.label==='Scan QR code').props.onPress();tree=nodes(h.render(h.exports.default,props));
   assert.equal(tree.find(node=>node.type==='Scanner').props.visible,true);
  }
 }
});
