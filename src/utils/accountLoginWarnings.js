import { sameGymOrigin } from './nativeGymCore';

export function createAccountLoginWarningHandler({base,document,show,inject}) {
  const seen=new Set();
  return event=>{
    if(typeof event?.data!=='string'||event.data.length>5000)return false;
    let value;try{value=JSON.parse(event.data);}catch{return false;}
    if(value?.type!=='sc.account.login-warning')return false;
    const current=document();
    if(!sameGymOrigin(event.url||current.url,base)||!sameGymOrigin(value.documentUrl,base)||value.documentUrl!==current.url
      ||!/^[a-f0-9]{64}$/.test(value.token||'')||typeof value.title!=='string'||typeof value.message!=='string'
      ||!value.title.trim()||value.title.length>150||value.message.length>1000)return true;
    for(const key of ['continueLabel','logoutLabel'])if(value[key]!==undefined&&(typeof value[key]!=='string'||!value[key].trim()||value[key].length>150))return true;
    if(seen.has(value.token))return true;
    seen.add(value.token);if(seen.size>50)seen.delete(seen.values().next().value);
    const act=action=>{
      const latest=document();if(latest.version!==current.version||latest.url!==current.url)return;
      inject('(function(){if(location.origin!=='+JSON.stringify(new URL(base).origin)+')return;var action=window.'+action+';if(typeof action==="function")Promise.resolve(action('+JSON.stringify(value.token)+')).catch(function(){});})();true;');
    };
    const buttons=[{text:value.continueLabel||'Continue',onPress:()=>act('__scAcknowledgeLoginWarning')}];
    // Older servers only support acknowledgement; their regular logout remains available.
    if(value.logoutLabel)buttons.push({text:value.logoutLabel,style:'destructive',onPress:()=>act('__scLogoutLoginWarning')});
    show(value.title,value.message,buttons);
    return true;
  };
}
