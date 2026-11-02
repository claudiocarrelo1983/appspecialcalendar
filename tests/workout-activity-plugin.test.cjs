const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),xcode=require('xcode'),{execFileSync}=require('node:child_process');
const plugin=require('../plugins/with-workout-activity.cjs');
test('Live Activity extension has sources, embedding, company bundle ID and matching versions without duplicate targets',async()=>{
 const folder=path.join(__dirname,'../build/activity-plugin-test');fs.mkdirSync(folder,{recursive:true});
 execFileSync('tar',['-xf',path.join(__dirname,'../node_modules/expo/template.tgz'),'-C',folder]);
 const file=path.join(folder,'package/ios/HelloWorld.xcodeproj/project.pbxproj'),project=xcode.project(file);project.parseSync();
 const config={ios:{bundleIdentifier:'com.ftxteam.app',buildNumber:'42'},version:'1.0.2'};
 plugin.addTarget(project,config);plugin.addTarget(project,config);
 const targets=Object.values(project.pbxNativeTargetSection()).filter(v=>typeof v==='object'&&String(v.name).replace(/"/g,'')==='WorkoutProgress');assert.equal(targets.length,1);
 const target=targets[0],list=project.pbxXCConfigurationList()[target.buildConfigurationList];
 for(const ref of list.buildConfigurations){const settings=project.pbxXCBuildConfigurationSection()[ref.value].buildSettings;assert.equal(settings.PRODUCT_BUNDLE_IDENTIFIER,'"com.ftxteam.app.WorkoutProgress"');assert.equal(settings.CURRENT_PROJECT_VERSION,'42');assert.equal(settings.APPLICATION_EXTENSION_API_ONLY,'YES');}
 const text=project.writeSync();assert.ok(text.includes('WorkoutActivityAttributes.swift'));assert.ok(text.includes('WorkoutProgress.appex'));assert.ok(text.includes('WorkoutProgress.swift'));
 fs.writeFileSync(file,text);xcode.project(file).parseSync();
 plugin.addTarget(project,{...config,ios:{...config.ios,bundleIdentifier:'com.demoteam.app'}});
 const settings=project.pbxXCBuildConfigurationSection()[list.buildConfigurations[0].value].buildSettings;assert.equal(settings.PRODUCT_BUNDLE_IDENTIFIER,'"com.demoteam.app.WorkoutProgress"');
});
