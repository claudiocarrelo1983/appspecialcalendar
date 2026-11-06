// Bridge sources must remain literal strings: Hermes does not preserve function source.
const AUTH_KIND_SOURCE=String.raw`function authPageKind(value,base){
  try{
    const url=new URL(value,base),site=new URL(base);
    if(site.protocol!=='https:'||!/^c[0-9]+\.specialcalendar\.com$/.test(site.hostname))return null;
    if(url.origin!==site.origin||url.username||url.password)return null;
    if(url.searchParams.getAll('pagecode').length>1||url.searchParams.has('pagecode')&&url.searchParams.get('pagecode')!==site.hostname.split('.')[0])return null;
    let path=url.pathname.replace(/\/+$/,'')||'/';
    const prefix='/'+site.hostname.split('.')[0];
    if(path.startsWith(prefix+'/'))path=path.slice(prefix.length);
    if(path==='/'||/^\/(?:site\/)?login$/.test(path))return 'login';
    if(/^\/(?:form-signup(?:\/index)?|site\/signup-client|signup|register)$/.test(path))return 'register';
    if(/^\/(?:site\/)?request-password-reset$/.test(path))return 'forgot';
    if(/^\/(?:site\/)?reset-password$/.test(path))return 'reset';
  }catch{}
  return null;
}`;
const AUTH_SUBMIT_SOURCE=String.raw`function(config){
    if(location.origin!==config.origin||location.href!==config.url)return;
    const current=window.__scNativeAuth;if(!current||current.revision!==config.revision||!current.form)return;
    const form=current.form,action=new URL(form.action||location.href,location.href);
    if(action.origin!==config.origin||action.username||action.password||form.method.toLowerCase()!=='post')return;
    const submit=form.querySelector('button[type="submit"],input[type="submit"]');
    if(!submit||submit.disabled){current.publish();return;}
    const target=new URL(submit.getAttribute('formaction')||action.href,location.href);
    if(target.origin!==config.origin||target.username||target.password||submit.hasAttribute('formmethod')&&submit.getAttribute('formmethod').toLowerCase()!=='post')return;
    for(const [id,value] of Object.entries(config.values)){
      const el=current.controls[id];if(!el||el.form!==form||el.disabled||el.readOnly||el.type==='hidden')continue;
      const group=el.closest('.form-group,[class*="field-"]')||el.parentElement;
      for(const message of group.querySelectorAll('.invalid-feedback,.help-block'))message.textContent='';
      if(el.type==='checkbox'||el.type==='radio'){el.checked=value===true;}
      else if(typeof value==='string'&&value.length<=4096){if(el.tagName==='SELECT'&&!Array.from(el.options).some(option=>option.value===value&&!option.disabled))continue;el.value=value;}
      el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
    }
    window.__scAuthSubmitted=true;
    if(form.requestSubmit)form.requestSubmit(submit);else submit?.click();
    // Publish any native constraint/Yii validation errors; navigation handles success.
    setTimeout(()=>current.publish(),150);
  }`;
export function authPageKind(value,base){
  try{
    const url=new URL(value,base),site=new URL(base);
    if(site.protocol!=='https:'||!/^c[0-9]+\.specialcalendar\.com$/.test(site.hostname))return null;
    if(url.origin!==site.origin||url.username||url.password)return null;
    if(url.searchParams.getAll('pagecode').length>1||url.searchParams.has('pagecode')&&url.searchParams.get('pagecode')!==site.hostname.split('.')[0])return null;
    let path=url.pathname.replace(/\/+$/,'')||'/';
    const prefix='/'+site.hostname.split('.')[0];
    if(path.startsWith(prefix+'/'))path=path.slice(prefix.length);
    if(path==='/'||/^\/(?:site\/)?login$/.test(path))return 'login';
    if(/^\/(?:form-signup(?:\/index)?|site\/signup-client|signup|register)$/.test(path))return 'register';
    if(/^\/(?:site\/)?request-password-reset$/.test(path))return 'forgot';
    if(/^\/(?:site\/)?reset-password$/.test(path))return 'reset';
  }catch{}
  return null;
}
export function authLinkTarget(value,base){
  if(typeof value!=='string'||value.length>4096)return null;
  try{const url=new URL(value);return url.protocol==='https:'&&authPageKind(url.href,base)?url.href:null;}catch{return null;}
}
export const AUTH_MESSAGE='sc.auth.document';
export const AUTH_LANGUAGE_MESSAGE='sc.auth.language';
export function authLanguageScript(base,url,revision,language){
  return '('+AUTH_LANGUAGE_SOURCE+')('+JSON.stringify({origin:new URL(base).origin,url,revision,language})+');true;';
}
const AUTH_LANGUAGE_SOURCE=String.raw`function(c){
  if(location.origin!==c.origin||location.href!==c.url||!['pt','en'].includes(c.language)||window.__scNativeAuth?.revision!==c.revision)return;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
  const send=success=>window.ReactNativeWebView?.postMessage(JSON.stringify({type:'sc.auth.language',url:location.href,revision:c.revision,language:c.language,success}));
  const token=document.querySelector('meta[name="csrf-token"]')?.content,param=document.querySelector('meta[name="csrf-param"]')?.content;
  if(!token||!param){clearTimeout(timeout);send(false);return;}
  fetch('/site/language',{method:'POST',credentials:'same-origin',cache:'no-store',signal:controller.signal,
    headers:{'Content-Type':'application/x-www-form-urlencoded','X-CSRF-Token':token},body:new URLSearchParams({lang:c.language,[param]:token}).toString()})
    .then(async response=>{const final=new URL(response.url||'/site/language',location.href);if(!response.ok||final.origin!==c.origin||(await response.text()).trim()!==c.language)throw Error('language');
      if(location.href!==c.url||window.__scNativeAuth?.revision!==c.revision)return;try{localStorage.setItem('sc.app.language.choice',c.language);}catch{}send(true);location.reload();})
    .catch(()=>{if(location.href===c.url&&window.__scNativeAuth?.revision===c.revision)send(false);}).finally(()=>clearTimeout(timeout));
}`;
export function nativeAuthScript(base){return '('+AUTH_SOURCE+')('+JSON.stringify({base,origin:new URL(base).origin})+','+AUTH_KIND_SOURCE+');true;';}
const AUTH_SOURCE=String.raw`function AUTH_SOURCE(config,classify){
  if(location.origin!==config.origin)return;
  if(window.__scAuthInstalled){if(document.readyState!=='loading')window.__scAuthRepublish?.();return;}
  window.__scAuthInstalled=true;
  const initialKind=classify(location.href,config.base);
  if(initialKind){const style=document.createElement('style');style.textContent='html,body{background:#fff!important}body{visibility:hidden!important}';(document.head||document.documentElement)?.appendChild(style);}
  document.addEventListener('focusin',event=>{if(classify(location.href,config.base)&&event.target?.closest?.('form'))event.target.blur();},true);
  const text=el=>(el?.textContent||'').replace(/\s+/g,' ').trim().slice(0,2000);
  const safe=value=>{if(!value)return null;try{const url=new URL(value,location.href);return url.origin===config.origin&&!url.username&&!url.password?url.href:null;}catch{return null;}};
  const visible=el=>{for(let node=el;node&&node!==document.documentElement;node=node.parentElement){const css=getComputedStyle(node);if(node.hidden||css.display==='none')return false;}return true;};
  let timer,form,controls={},revision,last='';
  const send=(force=false)=>{
    const kind=classify(location.href,config.base);
    if(!kind){window.ReactNativeWebView?.postMessage(JSON.stringify({type:'sc.auth.exit',url:location.href}));return;}
    form=document.querySelector('form[data-native-auth]')||document.querySelector('form#login-form,form#request-password-reset-form,form#reset-password-form,form#form-signup');
    const section=form?.closest('section,.company-auth-card,.pagecode-login-card,.login-card,.public-login-card')||document.querySelector('main')||document.body;
    if(!revision)revision=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
    controls={};let unsupported=false;
    const fields=form?Array.from(form.elements).filter(el=>el.name&&!el.disabled&&!['hidden','submit','button','reset'].includes(el.type)&&visible(el)).map((el,index)=>{
      if(!['INPUT','SELECT','TEXTAREA'].includes(el.tagName)||['file'].includes(el.type)){unsupported=true;return null;}
      const id='field-'+index;controls[id]=el;
      const group=el.closest('.form-group,[class*="field-"]')||el.parentElement;
      const label=Array.from(form.querySelectorAll('label')).find(label=>label.htmlFor&&label.htmlFor===el.id)||el.closest('label')||group.querySelector('label');
      const sensitive=el.type==='password'||/password|passwd|\[pwd\]/i.test(el.name+' '+el.id);
      const type=sensitive?'password':el.tagName==='SELECT'?'select':el.tagName==='TEXTAREA'?'textarea':el.type||'text';
      // Passwords, hidden company fields and CSRF tokens are never read back.
      return {id,type,label:text(label)||el.placeholder||el.name.replace(/^.*\[|\]$/g,''),value:type==='password'?'':type==='checkbox'||type==='radio'?!!el.checked:String(el.value||'').slice(0,4096),
        required:el.required||group.classList.contains('required'),placeholder:el.placeholder||'',maxLength:el.maxLength>0?Math.min(el.maxLength,4096):4096,
        readonly:!!el.readOnly,autocomplete:el.autocomplete||'',min:type==='date'?el.min||'':undefined,max:type==='date'?el.max||'':undefined,error:text(group.querySelector('.invalid-feedback,.help-block'))||(window.__scAuthSubmitted&&!el.validity.valid?el.validationMessage:''),
        options:type==='select'?Array.from(el.options).filter(option=>!option.disabled).slice(0,500).map(option=>({value:option.value,label:text(option)})):[]};
    }).filter(Boolean):[];
    const links=Array.from(section.querySelectorAll('a[href]')).map(el=>({label:text(el),url:safe(el.getAttribute('href'))})).filter(link=>link.label&&link.url&&(classify(link.url,config.base)||/\/(?:terms-and-conditions|privacy-policy|account-deletion)(?:\/|\?|$)/.test(link.url))).filter((link,index,all)=>all.findIndex(other=>other.url===link.url)===index);
    const messages=Array.from(section.querySelectorAll('.alert,.error-summary')).filter(visible).map(text).filter(Boolean);
    const submit=form?.querySelector('button[type="submit"],input[type="submit"]');
    const action=form?safe(form.action||location.href):null;
    const brand=form||document.querySelector('[data-native-auth-company]');
    try{const flashes=JSON.parse(brand?.getAttribute('data-native-auth-messages')||'[]');if(Array.isArray(flashes))for(const message of flashes)if(typeof message==='string'&&message&&!messages.includes(message))messages.push(message.slice(0,2000));}catch{}
    const data={type:'sc.auth.document',url:location.href,revision,kind,language:document.documentElement.lang?.startsWith('pt')?'pt':'en',fields,links,messages,
      submitLabel:text(submit)||submit?.value||'',canSubmit:!!form&&!!submit&&!submit.disabled&&form.method.toLowerCase()==='post'&&!!action&&!unsupported,
      color:brand?.getAttribute('data-native-auth-color')||getComputedStyle(document.documentElement).getPropertyValue('--sc-primary').trim(),logo:safe(brand?.getAttribute('data-native-auth-logo')||''),company:brand?.getAttribute('data-native-auth-company')||''};
    window.__scNativeAuth={revision,form,controls,publish:()=>send(true)};
    const serialized=JSON.stringify(data);if(force||serialized!==last){last=serialized;window.ReactNativeWebView?.postMessage(serialized);}
  };
  window.__scAuthRepublish=()=>send(true);
  const publish=()=>{clearTimeout(timer);timer=setTimeout(send,80);};
  const ready=()=>{
    if(classify(location.href,config.base))for(const el of document.querySelectorAll('[autofocus],[data-company-autofocus]')){el.removeAttribute('autofocus');el.removeAttribute('data-company-autofocus');}
    send();
    if(form){
      new MutationObserver(publish).observe(form,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','aria-invalid','disabled']});
      form.addEventListener('invalid',publish,true);
      form.addEventListener('submit',()=>{last='';publish();});
    }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
  window.addEventListener('load',publish);
}`;

export function authSubmitScript(base,url,revision,values){
  return '('+AUTH_SUBMIT_SOURCE+')('+JSON.stringify({origin:new URL(base).origin,url,revision,values})+');true;';
}
