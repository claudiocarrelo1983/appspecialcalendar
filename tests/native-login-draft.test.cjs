const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),babel=require('@babel/core');
const exportsObject={};vm.runInNewContext(babel.transformSync(fs.readFileSync(require.resolve('../src/utils/nativeLoginDraft.js'),'utf8'),{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code,{exports:exportsObject});
test('login can render editable local fields before the server arrives without enabling submission',()=>{
 const placeholder=exportsObject.loginPlaceholder();assert.equal(placeholder.canSubmit,false);assert.equal(placeholder.placeholder,true);
 assert.equal(placeholder.fields.length,2);assert.equal(placeholder.fields[1].type,'password');
});
test('draft credentials transfer to server bindings only once and cannot populate hidden or unrelated fields',()=>{
 const values=exportsObject.adoptLoginDraft([{id:'csrf',type:'hidden',label:'CSRF',value:'server-only'},{id:'user',type:'text',label:'Username',value:''},{id:'pass',type:'password',label:'Password',value:''},{id:'other',type:'text',label:'Other',value:'untouched'}],{'draft-user':'alice','draft-password':'sample'});
 assert.equal(values.user,'alice');assert.equal(values.pass,'sample');assert.equal(values.csrf,'server-only');assert.equal(values.other,'untouched');
 const cleared=exportsObject.adoptLoginDraft([{id:'pass',type:'password',value:''}],{});assert.equal(cleared.pass,'');
});
