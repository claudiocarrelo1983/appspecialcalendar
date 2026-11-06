import {NativeModules} from 'react-native';
import {deviceAuthLanguage,resolveAppLanguage} from './nativeAuthTranslations';

export function preferredPhoneLanguage(){
  try{
    const settings=NativeModules.SettingsManager?.settings;
    const android=NativeModules.I18nManager?.getConstants?.()||NativeModules.I18nManager;
    return deviceAuthLanguage(settings?.AppleLanguages?.length?settings.AppleLanguages:
      [settings?.AppleLocale,android?.localeIdentifier].filter(Boolean));
  }catch{return deviceAuthLanguage();}
}

// Runs only inside the company's app WebView. Website visitors are unaffected.
export function appLanguageScript(base,language=preferredPhoneLanguage()){
  return '('+SOURCE+')('+JSON.stringify({origin:new URL(base).origin,language:resolveAppLanguage(null,language)})+');true;';
}
const SOURCE=String.raw`function(c){
  if(location.origin!==c.origin||!window.ReactNativeWebView||window.__scAppLanguageInstalled)return;
  window.__scAppLanguageInstalled=true;
  async function apply(){
    const startedUrl=location.href;
    // A language preference must never interrupt or replay a login POST.
    if(window.__scAuthSubmitted)return;
    const top=document.querySelector('#page-topbar[data-fitness-account]');
    const account=top?.getAttribute('data-fitness-account');
    const guest=/^\/(?:site\/)?(?:login|form-signup|request-password-reset)\/?$/.test(location.pathname)||location.pathname==='/';
    if(!account&&!guest)return;
    const key='sc.app.language.initialized.'+(account||'guest');
    let language=c.language;
    try{
      if(localStorage.getItem(key))return;
      const chosen=localStorage.getItem('sc.app.language.choice');
      if(chosen==='pt'||chosen==='en')language=chosen;
    }catch{return;}
    const token=document.querySelector('meta[name="csrf-token"]')?.content;
    const param=document.querySelector('meta[name="csrf-param"]')?.content;
    if(!token||!param)return;
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch('/site/language',{method:'POST',credentials:'same-origin',cache:'no-store',signal:controller.signal,
        headers:{'Content-Type':'application/x-www-form-urlencoded','X-CSRF-Token':token},body:new URLSearchParams({lang:language,[param]:token}).toString()});
      if(!response.ok||new URL(response.url||'/site/language',location.href).origin!==c.origin||(await response.text()).trim()!==language)return;
      if(location.href!==startedUrl||window.__scAuthSubmitted)return;
      localStorage.setItem(key,language);
      if((document.documentElement.lang||'').split(/[-_]/)[0].toLowerCase()!==language)location.reload();
    }catch{}finally{clearTimeout(timeout);}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
}`;
