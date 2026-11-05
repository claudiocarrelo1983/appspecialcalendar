const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),babel=require('@babel/core');
function load(file,mocks={}){const exports={};vm.runInNewContext(babel.transformSync(fs.readFileSync(require.resolve('../src/'+file),'utf8'),{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-react-jsx','@babel/plugin-transform-modules-commonjs']}).code,{exports,Intl,Date,require:name=>{assert.ok(name in mocks,name);return mocks[name];}});return exports;}
const dates=load('utils/authDate.js');
test('date-only values validate leap days without UTC conversion or rollover',()=>{
 for(const value of ['2000-02-29','2024-02-29','1999-12-31'])assert.ok(dates.parseDate(value));
 for(const value of ['1900-02-29','2023-02-29','2024-04-31','2024-13-01','31/12/1999'])assert.equal(dates.parseDate(value),null);
 assert.equal(dates.isoDate(1999,11,31),'1999-12-31');
});
test('calendar uses Monday-first weeks and follows actual month length and server limits',()=>{
 assert.equal(dates.calendarDays(2024,1).filter(Boolean).length,29);assert.equal(dates.calendarDays(2023,1).filter(Boolean).length,28);
 assert.equal(dates.calendarDays(2026,10)[6],1);
 assert.equal(dates.dateAllowed('2000-02-29','2000-01-01','2000-12-31'),true);
 assert.equal(dates.dateAllowed('1999-12-31','2000-01-01','2000-12-31'),false);
 assert.equal(dates.dateAllowed('2001-01-01','2000-01-01','2000-12-31'),false);
});
test('birth date opens a calendar instead of a keyboard and selects an ISO date through year/day controls',()=>{
 const slots=[];let cursor=0,changed='',dismissed=0;
 const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),useState(value){const i=cursor++;if(!(i in slots))slots[i]=value;return [slots[i],value=>slots[i]=value];}};
 const Screen=load('screens/NativeDateField.js',{react,'react-native':{Keyboard:{dismiss:()=>dismissed++},Modal:'Modal',Pressable:'Pressable',ScrollView:'ScrollView',View:'View',StyleSheet:{create:value=>value}},'react-native-safe-area-context':{useSafeAreaInsets:()=>({bottom:0})},'./NativeGymTypography':{LoadingIndicator:'ActivityIndicator',Text:'Text',Icon:'Icon'},'../utils/gymUiTheme':{__esModule:true,default:{}},'../utils/authDate':dates}).default;
 const props={value:'2000-02-29',label:'Data de nascimento',language:'pt',color:'#198754',onChange:value=>changed=value};
 const nodes=tree=>!tree||typeof tree!=='object'?[]:[tree,...(tree.props?.children||[]).flat(Infinity).flatMap(nodes)];
 const render=()=>{cursor=0;return nodes(Screen(props));};
 let tree=render();assert.equal(tree.some(node=>node.type==='TextInput'),false);
 tree.find(node=>node.props.accessibilityLabel==='Data de nascimento: 29/02/2000').props.onPress();tree=render();assert.equal(dismissed,1);assert.equal(tree.find(node=>node.type==='Modal').props.visible,true);
 tree.find(node=>node.props.accessibilityLabel==='Escolher ano').props.onPress();tree=render();
 tree.find(node=>node.type==='Pressable'&&nodes(node).some(child=>child.type==='Text'&&child.props.children.includes(1999))).props.onPress();tree=render();
 assert.ok(!tree.some(node=>node.props.accessibilityLabel==='1999-02-29'));
 tree.find(node=>node.props.accessibilityLabel==='1999-02-28').props.onPress();assert.equal(changed,'1999-02-28');assert.equal(render().find(node=>node.type==='Modal').props.visible,false);
});
