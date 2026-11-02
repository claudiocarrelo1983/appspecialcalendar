const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {test}=require('node:test'),babel=require('@babel/core');
test('client birthday badge loads before opening, refreshes on foreground and ignores signed-out responses',async()=>{
  const slots=[],effects=[],cleanups=[],pending=[],intervals=new Map();let cursor=0,foreground;
  const react={useState(value){const i=cursor++;if(!(i in slots))slots[i]=value;return [slots[i],next=>slots[i]=next];},
    useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((value,index)=>value!==old[index]))effects.push(()=>{cleanups[i]?.();cleanups[i]=fn();});slots[i]=deps;}};
  const AppState={currentState:'active',addEventListener:(_,fn)=>{foreground=fn;return {remove(){foreground=null;}};}};
  const {code}=babel.transformSync(fs.readFileSync(require.resolve('../src/utils/useBirthdayCount.js'),'utf8'),{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']});
  const exports={};vm.runInNewContext(code,{exports,require:name=>name==='react'?react:{AppState},setInterval:fn=>{intervals.set(1,fn);return 1;},clearInterval:id=>intervals.delete(id)});
  const request=action=>{assert.equal(action,'birthdays');return new Promise(resolve=>pending.push(resolve));};
  const render=account=>{cursor=0;const result=exports.default({data:account?{accountKey:account}:null,request});while(effects.length)effects.shift()();return result;};
  render('A');assert.equal(pending.length,1);pending.shift()({rows:[{today:true},{today:false},{today:true}]});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(render('A')[0],2);
  foreground('active');pending.shift()({rows:[{today:false}]});await new Promise(resolve=>setImmediate(resolve));assert.equal(render('A')[0],0);
  intervals.get(1)();const stale=pending.shift();render(null);stale({rows:[{today:true}]});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(render(null)[0],0);assert.equal(intervals.size,0);assert.equal(foreground,null);
});
