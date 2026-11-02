const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {test}=require('node:test'),babel=require('@babel/core');
function harness(base='https://club.example/'){
  const slots=[],effects=[],cleanups=[],removed=[],cancelled=[];let cursor=0;
  const react={useRef(value){const i=cursor++;return slots[i]||(slots[i]={current:value});},
    useState(value){const i=cursor++;if(!(i in slots))slots[i]=value;return [slots[i],next=>slots[i]=next];},
    useEffect(fn,deps){const i=cursor++,previous=slots[i];if(!previous||deps.some((value,index)=>value!==previous[index]))effects.push(()=>{cleanups[i]?.();cleanups[i]=fn();});slots[i]=deps;}};
  const mocks={react,'expo-crypto':{CryptoDigestAlgorithm:{SHA256:'sha256'},randomUUID:()=> 'anonymous-session',digestStringAsync:async(_,value)=>crypto.createHash('sha256').update(value).digest('hex')},
    'expo-secure-store':{deleteItemAsync:async key=>removed.push(key)},'./nativeTimerAlerts':{cancelTimerAlert:async key=>cancelled.push(key)}};
  const {code}=babel.transformSync(fs.readFileSync(require.resolve('../src/utils/useAdminTimerAccount.js'),'utf8'),{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']});
  const exports={};vm.runInNewContext(code,{exports,URL,require:name=>mocks[name]});
  const render=pages=>{cursor=0;const key=exports.default(pages,base);while(effects.length)effects.shift()();return key;};
  return {removed,cancelled,async show(name,sessionVersion=0){const pages={document:name===null?null:{header:{user:{name}}},sessionVersion};render(pages);await Promise.resolve();await Promise.resolve();return render(pages);}};
}
test('admin timer survives ordinary navigation and clears state and alerts on account change or logout',async()=>{
  const h=harness(),alice=await h.show('Alice');assert.match(alice,/^[a-f0-9]{64}$/);
  assert.equal(await h.show(null),alice);assert.equal(h.cancelled.length,0);
  const bob=await h.show('Bob');assert.notEqual(bob,alice);assert.ok(h.cancelled.includes(alice));
  assert.ok(h.removed.includes('native-gym-timer-'+alice));
  assert.equal(await h.show(null,1),null);assert.ok(h.cancelled.includes(bob));assert.ok(h.removed.includes('native-gym-timer-'+bob));
});
test('admin timer keys are stable for the same identity and isolated between companies',async()=>{
  const first=await harness().show('Alice'),reopened=await harness().show('Alice'),other=await harness('https://other.example/').show('Alice');
  assert.equal(first,reopened);assert.notEqual(first,other);
});
