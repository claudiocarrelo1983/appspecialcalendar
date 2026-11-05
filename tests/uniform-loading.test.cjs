const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),babel=require('@babel/core');

test('shared loader always matches the Settings native spinner and preserves colour and accessibility',()=>{
 const source=fs.readFileSync('src/screens/NativeGymTypography.js','utf8');
 const {code}=babel.transformSync(source,{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-react-jsx','@babel/plugin-transform-modules-commonjs']});
 const exports={};vm.runInNewContext(code,{exports,require(name){
  if(name==='react')return {createContext:()=>({}),createElement:(type,props)=>({type,props})};
  if(name==='react-native')return {ActivityIndicator:'SystemSpinner',StyleSheet:{},Text:'SystemText'};
  if(name==='../utils/gymUiTheme')return {};
  throw Error(name);
 }});
 for(const color of ['#198754','#008fbd','#fff']){
  const tree=exports.LoadingIndicator({color,size:'large',accessibilityLabel:'A carregar'});
  assert.equal(tree.type,'SystemSpinner');assert.equal(tree.props.size,'small');assert.equal(tree.props.color,color);assert.equal(tree.props.accessibilityLabel,'A carregar');
 }
});

test('every native page loading indicator uses the shared Settings component',()=>{
 const files=fs.readdirSync('src/screens').filter(file=>file.endsWith('.js')&&file!=='NativeGymTypography.js');let screens=0;
 for(const file of files){
  const source=fs.readFileSync('src/screens/'+file,'utf8');if(!source.includes('<ActivityIndicator'))continue;screens++;
  assert(source.includes("import {LoadingIndicator as ActivityIndicator} from './NativeGymTypography'"),file+' still imports a separate system spinner');
  const ast=babel.parseSync(source,{babelrc:false,configFile:false,parserOpts:{plugins:['jsx']}});
  function walk(node){if(!node||typeof node!=='object')return;
   if(node.type==='JSXOpeningElement'&&node.name?.name==='ActivityIndicator')assert(!node.attributes.some(attr=>attr.name?.name==='size'),file+' overrides the shared spinner size');
   for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}
  }walk(ast);
 }
 assert(screens>=10,'Missing native page loader coverage');
});
