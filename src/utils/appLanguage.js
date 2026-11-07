import {NativeModules} from 'react-native';
import {resolveAppLanguage} from './nativeAuthTranslations';

export function preferredPhoneLanguage(){
  try{
    const settings=NativeModules.SettingsManager?.settings;
    const android=NativeModules.I18nManager;
    const locale=settings?.AppleLanguages?.[0]||settings?.AppleLocale||android?.getConstants?.()?.localeIdentifier||android?.localeIdentifier;
    return resolveAppLanguage(null,locale);
  }catch{return 'en';}
}
// Resolve locally only. Never send a preference POST or reload a login document.
export function appLanguageScript(base,phoneLanguage=preferredPhoneLanguage()){
  return '('+SOURCE+')('+JSON.stringify({origin:new URL(base).origin,language:resolveAppLanguage(null,phoneLanguage)})+');true;';
}
const SOURCE=String.raw`function(c){
  if(location.origin!==c.origin||!window.ReactNativeWebView)return;
  let chosen;
  try{chosen=localStorage.getItem('sc.app.language.choice');}catch{}
  window.__scAppLanguage=chosen==='pt'||chosen==='en'?chosen:c.language;
}`;
