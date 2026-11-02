const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{test}=require('node:test'),babel=require('@babel/core');
function nodes(tree){return !tree||typeof tree!=='object'?[]:[tree,...(tree.props?.children||[]).flat(Infinity).flatMap(nodes)];}
function harness(){
 const slots=[],effects=[],timers=new Map();let cursor=0,seq=0;
 const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),useState(value){const i=cursor++;if(!(i in slots))slots[i]=value;return [slots[i],value=>slots[i]=value];},useRef(value){const i=cursor++;return slots[i]||(slots[i]={current:value});},useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((v,n)=>v!==old.deps[n]))effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});}};
 const native=Object.fromEntries(['ActivityIndicator','Modal','Pressable','ScrollView','TextInput','View'].map(name=>[name,name]));
 const mocks={react,'react-native':{...native,StyleSheet:{create:v=>v}},'expo-crypto':{randomUUID:()=> '11111111-1111-4111-8111-111111111111'},'./NativeGymTypography':{Text:'Text',Icon:'Icon'},'../utils/gymUiTheme':{__esModule:true,default:{},brandSoft:()=>''}};
 const exports={},code=babel.transformSync(fs.readFileSync(require.resolve('../src/screens/NativeClassShare.js'),'utf8'),{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-react-jsx','@babel/plugin-transform-modules-commonjs']}).code;
 vm.runInNewContext(code,{exports,require:key=>{assert.ok(key in mocks,key);return mocks[key];},setTimeout:fn=>{timers.set(++seq,fn);return seq;},clearTimeout:id=>timers.delete(id)});
 return {render(props){cursor=0;const tree=exports.default(props);while(effects.length)effects.shift()();return nodes(tree);},async flush(){const pending=[...timers.values()];timers.clear();for(const fn of pending)await fn();}};
}
test('share popup searches after two letters, selects a client, and retries with the same idempotency token',async()=>{
 const h=harness(),queries=[],sent=[];let attempts=0;
 const props={item:{schedule_id:7,date:'2026-12-30',class_name:'Muay Thai',start_time:'10:00'},language:'en',color:'#198754',onClose(){},search:async q=>{queries.push(q);return [{id:2,name:'Alice'}];},send:async(...args)=>{sent.push(args);if(++attempts===1)throw Error('offline');}};
 let tree=h.render(props);assert.equal(tree.find(node=>node.props.accessibilityLabel==='Send invitation').props.disabled,true);
 tree.find(node=>node.type==='TextInput').props.onChangeText('A');h.render(props);await h.flush();assert.equal(queries.length,0);
 tree=h.render(props);tree.find(node=>node.type==='TextInput').props.onChangeText('Al');h.render(props);await h.flush();tree=h.render(props);
 assert.deepEqual(queries,['Al']);tree.find(node=>node.type==='Pressable'&&nodes(node).some(child=>child.type==='Text'&&child.props.children.includes('Alice'))).props.onPress();
 tree=h.render(props);await tree.find(node=>node.props.accessibilityLabel==='Send invitation').props.onPress();tree=h.render(props);
 assert.ok(tree.some(node=>node.props.accessibilityRole==='alert'));
 await tree.find(node=>node.props.accessibilityLabel==='Send invitation').props.onPress();tree=h.render(props);
 assert.equal(sent[0][1],2);assert.equal(sent[0][2],sent[1][2]);assert.ok(tree.some(node=>node.type==='Text'&&node.props.children.includes('Invitation sent to')));
});

test('failed search shows one error; empty results appear only after a successful completed search',async()=>{
 const h=harness();let fail=true;
 const props={item:{class_name:'Class',date:'2026-12-30'},language:'en',color:'#198754',onClose(){},send:async()=>{},search:async()=>{if(fail)throw Error('HTTP_500');return [];}};
 const hasEmpty=tree=>tree.some(node=>node.type==='Text'&&node.props.children.includes('No matching clients.'));
 let tree=h.render(props);tree.find(node=>node.type==='TextInput').props.onChangeText('Ev');
 tree=h.render(props);assert.equal(hasEmpty(tree),false);await h.flush();tree=h.render(props);
 assert.equal(tree.filter(node=>node.props.accessibilityRole==='alert').length,1);assert.equal(hasEmpty(tree),false);
 fail=false;tree.find(node=>node.type==='TextInput').props.onChangeText('Evg');h.render(props);tree=h.render(props);
 assert.equal(hasEmpty(tree),false);await h.flush();tree=h.render(props);
 assert.equal(tree.filter(node=>node.props.accessibilityRole==='alert').length,0);assert.equal(hasEmpty(tree),true);
});

test('started-class rejection has one specific message in English and Portuguese',async()=>{
 for(const [language,expected,label] of [['en','This class has already started. Choose an upcoming class.','Send invitation'],['pt','Esta aula já começou. Escolha uma aula futura.','Enviar convite']]){
  const h=harness(),props={item:{class_name:'Class',date:'2026-10-30'},language,color:'#198754',onClose(){},search:async()=>[{id:2,name:'Alice'}],send:async()=>{const failure=Error('Rejected');failure.reason='class_started';throw failure;}};
  let tree=h.render(props);tree.find(node=>node.type==='TextInput').props.onChangeText('Al');h.render(props);await h.flush();tree=h.render(props);
  tree.find(node=>node.type==='Pressable'&&nodes(node).some(child=>child.type==='Text'&&child.props.children.includes('Alice'))).props.onPress();
  tree=h.render(props);await tree.find(node=>node.props.accessibilityLabel===label).props.onPress();tree=h.render(props);
  const errors=tree.filter(node=>node.props.accessibilityRole==='alert');assert.equal(errors.length,1);assert.ok(errors[0].props.children.includes(expected));
 }
});
