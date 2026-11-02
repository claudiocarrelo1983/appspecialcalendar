const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {test}=require('node:test'),babel=require('@babel/core');
function load(file,mocks={}){
  const {code}=babel.transformSync(fs.readFileSync(require.resolve('../src/utils/'+file),'utf8'),{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']});
  const exports={};vm.runInNewContext(code,{exports,require:name=>{assert.ok(name in mocks,name);return mocks[name];}});return exports;
}
const colors=load('companyColor.js');
test('club color accepts the server HEX and RGB formats and rejects arbitrary CSS',()=>{
  for(const [value,expected] of [['#ABC','#aabbcc'],[' #B52683 ','#b52683'],['rgb(18, 120, 204)','#1278cc']])assert.equal(colors.normalizeCompanyColor(value),expected);
  for(const value of [null,{},'red','url(https://other.example)','rgb(256,0,0)','#abcd'])assert.equal(colors.normalizeCompanyColor(value),null);
});
function harness(){
  const slots=[],effects=[],writes=[];let cursor=0,restore;
  const react={useRef(value){const i=cursor++;return slots[i]||(slots[i]={current:value});},
    useState(value){const i=cursor++;if(!(i in slots))slots[i]=value;return [slots[i],value=>slots[i]=value];},
    useEffect(fn,deps){const i=cursor++,previous=slots[i];if(!previous||deps.some((v,n)=>v!==previous[n]))effects.push(fn);slots[i]=deps;}};
  const hook=load('useCompanyColor.js',{react,'./companyColor':colors,'expo-secure-store':{
    getItemAsync:()=>new Promise(resolve=>restore=resolve),setItemAsync:async(key,value)=>writes.push([key,value])}}).default;
  return {writes,restore:async value=>{restore(value);await Promise.resolve();},render(value){cursor=0;const result=hook('ftx',value,'#198754');while(effects.length)effects.shift()();return result;}};
}
test('saved server color updates immediately and remains during navigation; stale cache cannot replace it',async()=>{
  const h=harness();assert.equal(h.render(null),'#198754');
  assert.equal(h.render('#b52683'),'#b52683');assert.equal(h.render(null),'#b52683');
  await h.restore('#1278cc');assert.equal(h.render(null),'#b52683');
  assert.equal(h.render('rgb(18,120,204)'),'#1278cc');assert.equal(h.render(null),'#1278cc');
  assert.deepEqual(h.writes,[['company-brand-color-ftx','#b52683'],['company-brand-color-ftx','#1278cc']]);
});
test('app restart restores company branding and invalid server colors preserve it',async()=>{
  const h=harness();h.render(null);await h.restore('#b52683');
  assert.equal(h.render(null),'#b52683');assert.equal(h.render('invalid'),'#b52683');
});
