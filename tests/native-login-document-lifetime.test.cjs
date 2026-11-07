const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test'),babel=require('@babel/core'),React=require('react'),{JSDOM}=require('jsdom');
const noop=()=>{},Default=()=>null,View=({children})=>React.createElement('div',null,children);
function load(file,os){
 const native={StyleSheet:{create:value=>value},Platform:{OS:os},Alert:{alert:noop},View,Text:'span',Modal:Default};
 for(const key of ['FlatList','Image','KeyboardAvoidingView','Pressable','RefreshControl','ScrollView','Switch','TextInput'])native[key]=Default;
 const exports={},code=babel.transformSync(fs.readFileSync(path.join(__dirname,'../src/screens',file),'utf8'),{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-react-jsx','@babel/plugin-transform-modules-commonjs']}).code;
 const mocks={react:React,'react-native':native,'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:0,bottom:0})},'../utils/companyAppConfig':{__esModule:true,default:()=>({siteUrl:'https://club.example',color:'#198754',pagecode:'club'})},'../utils/gymUiTheme':{__esModule:true,default:{},brandSoft:()=>''},'../utils/nativeAdminPages':{adminPageLabels:()=>({})},'../utils/nativeAdminCore':{adminTranslations:()=>({})},'../utils/useAdminTimerAccount':{__esModule:true,default:()=>null},'../utils/nativeCalendar':{createClassCalendarHandler:()=>noop}};
 vm.runInNewContext(code,{exports,URL,setTimeout,clearTimeout,require:key=>mocks[key]||{__esModule:true,default:Default,LoadingIndicator:Default,Text:'span',Icon:Default}});return exports.default;
}
test('member login and logout retain one embedded document on iOS and Android',async()=>{
 const dom=new JSDOM('<div id="root"></div>'),previous={window:global.window,document:global.document,act:global.IS_REACT_ACT_ENVIRONMENT};
 global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true;
 const {createRoot}=require('react-dom/client');
 try{for(const os of ['ios','android']){
  const Frame=load('NativeAdminFrame.js',os),Shell=load('NativeAdminShell.js',os);let mounts=0,unmounts=0;
  function Document(){React.useEffect(()=>{mounts++;return()=>unmounts++;},[]);return React.createElement('div',null,'WebView document');}
  const root=createRoot(document.getElementById('root')),pages={document:null,page:null,startup:'idle'},admin={context:null,searchMembers:noop,screen:'web'};
  const render=enabled=>React.createElement(Frame,{enabled,pages,admin},React.createElement(Shell,{enabled,admin},React.createElement(Document)));
  try{
   await React.act(async()=>root.render(render(true)));
   await React.act(async()=>root.render(render(false)));
   await React.act(async()=>root.render(render(true)));
   assert.equal(mounts,1,os+': session changes must not recreate the login WebView');assert.equal(unmounts,0,os);
  }finally{await React.act(async()=>root.unmount());}
 }}finally{global.window=previous.window;global.document=previous.document;global.IS_REACT_ACT_ENVIRONMENT=previous.act;dom.window.close();}
});
