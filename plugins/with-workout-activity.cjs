const {withInfoPlist,withXcodeProject,withDangerousMod}=require('expo/config-plugins');
const fs=require('fs'),path=require('path');
const targetName='WorkoutProgress';
function addTarget(project,config){
  const targets=project.pbxNativeTargetSection();
  let target=Object.entries(targets).find(([id,value])=>!id.endsWith('_comment')&&String(value.name).replace(/"/g,'')===targetName);
  if(!target){
    const added=project.addTarget(targetName,'app_extension',targetName,config.ios.bundleIdentifier+'.WorkoutProgress');
    project.addBuildPhase([],'PBXSourcesBuildPhase','Sources',added.uuid);
    project.addBuildPhase([],'PBXFrameworksBuildPhase','Frameworks',added.uuid);
    const group=project.addPbxGroup([],targetName,targetName);
    project.addToPbxGroup(group.uuid,project.getFirstProject().firstProject.mainGroup);
    for(const file of ['WorkoutProgress.swift','WorkoutActivityAttributes.swift'])project.addSourceFile(file,{target:added.uuid},group.uuid);
    target=[added.uuid,added.pbxNativeTarget];
  }
  const list=project.pbxXCConfigurationList()[target[1].buildConfigurationList];
  const configurations=project.pbxXCBuildConfigurationSection();
  for(const ref of list.buildConfigurations){
    Object.assign(configurations[ref.value].buildSettings,{
      PRODUCT_BUNDLE_IDENTIFIER:'"'+config.ios.bundleIdentifier+'.WorkoutProgress"',
      INFOPLIST_FILE:'"WorkoutProgress/WorkoutProgress-Info.plist"',
      IPHONEOS_DEPLOYMENT_TARGET:'16.4',SWIFT_VERSION:'5.9',TARGETED_DEVICE_FAMILY:'"1,2"',
      APPLICATION_EXTENSION_API_ONLY:'YES',SKIP_INSTALL:'YES',GENERATE_INFOPLIST_FILE:'NO',
      MARKETING_VERSION:config.version,CURRENT_PROJECT_VERSION:String(config.ios.buildNumber||1),
      CODE_SIGN_STYLE:'Automatic',
      ...(config.ios.appleTeamId?{DEVELOPMENT_TEAM:config.ios.appleTeamId}:{}),
    });
  }
  return project;
}
module.exports=function withWorkoutActivity(config){
  config.extra={...config.extra,eas:{...config.extra?.eas,build:{...config.extra?.eas?.build,experimental:{...config.extra?.eas?.build?.experimental,ios:{...config.extra?.eas?.build?.experimental?.ios,appExtensions:[{targetName,bundleIdentifier:config.ios.bundleIdentifier+'.WorkoutProgress',entitlements:{}}]}}}}};
  config=withInfoPlist(config,value=>{value.modResults.NSSupportsLiveActivities=true;return value;});
  config=withDangerousMod(config,['ios',async value=>{
    const root=value.modRequest.projectRoot,folder=path.join(value.modRequest.platformProjectRoot,targetName);
    fs.mkdirSync(folder,{recursive:true});
    fs.copyFileSync(path.join(root,'native/WorkoutProgress/WorkoutProgress.swift'),path.join(folder,'WorkoutProgress.swift'));
    fs.copyFileSync(path.join(root,'modules/special-calendar-health/ios/WorkoutActivityAttributes.swift'),path.join(folder,'WorkoutActivityAttributes.swift'));
    fs.writeFileSync(path.join(folder,'WorkoutProgress-Info.plist'),`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict>
<key>CFBundleDisplayName</key><string>Workout Progress</string><key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string><key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string><key>CFBundleName</key><string>$(PRODUCT_NAME)</string><key>CFBundlePackageType</key><string>XPC!</string><key>CFBundleShortVersionString</key><string>$(MARKETING_VERSION)</string><key>CFBundleVersion</key><string>$(CURRENT_PROJECT_VERSION)</string><key>NSExtension</key><dict><key>NSExtensionPointIdentifier</key><string>com.apple.widgetkit-extension</string></dict></dict></plist>`);
    return value;
  }]);
  return withXcodeProject(config,value=>{addTarget(value.modResults,value);return value;});
};
module.exports.addTarget=addTarget;
