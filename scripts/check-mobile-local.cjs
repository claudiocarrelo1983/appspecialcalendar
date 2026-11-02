// Free validation only: this script never invokes EAS Build or publishes updates.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function run(args){
  const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status||1);
}
const tests=fs.readdirSync(path.join(root,'tests')).filter(name=>name.endsWith('.test.cjs')).sort().map(name=>path.join('tests',name));
run(['--test',...tests]);
run(['scripts/test-company-profiles.cjs']);
run([require.resolve('expo/bin/cli'),'export','--platform','all','--output-dir','build/local-validation']);
console.log('Local checks passed. No EAS cloud build or update was started.');
