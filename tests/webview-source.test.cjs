const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),babel=require('@babel/core');
function harness(initialUrl){
 const slots=[];let cursor=0;
 const react={useState(initial){const index=cursor++;if(!(index in slots))slots[index]=initial;return [slots[index],value=>{slots[index]=typeof value==='function'?value(slots[index]):value;}];},useCallback:callback=>callback};
 const exports={},code=babel.transformSync(fs.readFileSync('src/utils/useWebViewSource.js','utf8'),{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code;
 vm.runInNewContext(code,{exports,require:()=>react});
 return ()=>{cursor=0;return exports.default(initialUrl);};
}
test('QR returns from an internally navigated client page even when React still has the same check-in URI',()=>{
 const target='https://ftx.example/gym-checkin/index?member_id=1619',render=harness(target);
 let [url,navigate,revision]=render();const previousKey=url+':'+revision;
 // Opening View client details changes the WebView's document but not this state.
 let documentUrl='https://ftx.example/clients-list/view?id=1619';
 assert.notEqual(documentUrl,url);
 navigate(target,{reload:true});[url,navigate,revision]=render();
 assert.equal(url,target);assert.notEqual(url+':'+revision,previousKey);
 // WebView receives a new key and mounts the explicit scanned-member source.
 documentUrl=url;assert.equal(documentUrl,target);
 navigate(target,{reload:true});assert.equal(render()[2],2);
 navigate('https://ftx.example/gym-checkin/index?member_id=1620',{reload:true});assert.equal(render()[2],3);
 assert.ok(render()[0].endsWith('member_id=1620'));
});
test('ordinary URL changes preserve the reload revision',()=>{
 const render=harness('https://ftx.example/dashboard-gym');render()[1]('https://ftx.example/clients-list');
 assert.equal(render()[0],'https://ftx.example/clients-list');assert.equal(render()[2],0);
});
