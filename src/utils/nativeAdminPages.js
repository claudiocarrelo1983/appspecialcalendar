import { sameGymOrigin } from './nativeGymCore';
import { summaryCardLayoutScript } from './summaryCardLayout';
import { subcategoryTabsScript } from './subcategoryTabs';

export const ADMIN_PAGES_MESSAGE = 'sc.adminPages';
export function adminListUrl(value, base) {
  if (!sameGymOrigin(value, base)) return null;
  const url = new URL(value, base);
  return /^\/(clients-list|gym-classes|memberships)(\/index)?\/?$/.test(url.pathname) && !url.searchParams.has('r') ? url.href : null;
}
export function adminMemberTarget(value, config, base) {
  try {
    if (typeof value !== 'string' || value.length > 2048 || !config) return null;
    const url = new URL(value.trim()), local = ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
    if (!['http:','https:'].includes(url.protocol) || url.username || url.password || (!config.origins.includes(url.origin) && !local)) return null;
    for (const key of ['r','id','company_code']) if (url.searchParams.getAll(key).length > 1) return null;
    const route = url.pathname === '/index.php' ? '/' + (url.searchParams.get('r') || '').replace(/^\/+|\/+$/g, '') : url.pathname.replace(/\/+$/, '');
    const match = /^\/clients-list\/view(?:\/([1-9]\d{0,9}))?$/.exec(route), id = match?.[1] || url.searchParams.get('id');
    if (!match || !/^[1-9]\d{0,9}$/.test(id || '') || Number(id) > 2147483647
      || (match[1] && url.searchParams.has('id') && url.searchParams.get('id') !== id)
      || (url.searchParams.has('company_code') && url.searchParams.get('company_code') !== config.companyCode)) return null;
    const target = new URL('/clients-list/view', base); target.searchParams.set('id', id); target.searchParams.set('company_code', config.companyCode);
    return target.href;
  } catch { return null; }
}

export function adminMemberCheckinTarget(value,config,base){
  const member=adminMemberTarget(value,config,base);
  if(!member)return null;
  if(config.checkinAllowed===false)return member;
  const target=new URL('/gym-checkin/index',base);
  target.searchParams.set('member_id',new URL(member).searchParams.get('id'));
  target.searchParams.set('company_code',config.companyCode);
  return target.href;
}

const SOURCE = String.raw`function(c) {
  if (location.origin !== c.origin || !window.ReactNativeWebView) return;
  if(c.action==='install')window.__scAdminPagesDocumentId=c.documentId;
  const send = value => window.ReactNativeWebView.postMessage(JSON.stringify({type:'sc.adminPages',...value,
    documentUrl:location.href,documentId:window.__scAdminPagesDocumentId}));
  const text = el => (el?.textContent || '').replace(/\s+/g,' ').trim().slice(0,500);
  const all = (root, selector) => Array.from(root.querySelectorAll(selector));
  const fieldLabel = (form,el) => el.getAttribute('aria-label') || text(el.labels?.[0]) || text(el.closest('label'))
    || text(form.querySelector('label[for="'+el.id.replace(/[^a-zA-Z0-9_-]/g,'')+'"]')) || el.placeholder || el.name;
  const safe = (value, base) => { try { if(typeof value!=='string'||!value.trim()||value.trim()==='#')return null;const u = new URL(value, base); return u.origin === c.origin && !u.username && !u.password && !u.hash ? u.href : null; } catch { return null; } };
  const readOnly = el => !el.hasAttribute('data-method') && !el.hasAttribute('data-confirm') && !/\/(?:delete|remove|approve|reject|logout|switch-company)(?:[/?]|$)/i.test(el.getAttribute('href') || '');
  const links = (root, selector, base, include = () => true) => all(root,selector).filter(el => !el.closest('[data-permission-blocked="1"]') && readOnly(el) && include(el)).map(el => ({
    label:text(el) || el.getAttribute('title') || el.getAttribute('aria-label') || '', url:safe(el.getAttribute('href'),base)
  })).filter(item => item.url && item.label).filter((item,i,list) => list.findIndex(x => x.url === item.url && x.label === item.label) === i).slice(0,160);
  function snapshot(root, base, live) {
    const path = new URL(base).pathname, heading = root.querySelector('h1, .gym-page-heading h2, .backoffice-page-title h2');
    const page = {url:base,title:text(heading) || text(root.querySelector('title')),kind:'web',rows:[],links:[],filters:[],summary:[]};
    page.notices=all(root,'.page-content .alert,.main-content .alert').filter(el=>!el.closest('.modal')&&!el.classList.contains('d-none')).slice(0,5).map(text).filter(Boolean);
    const routes = { '/clients-list':['clients','.client-card-modern','.client-name','.client-card-summary'],
      '/memberships':['memberships','.membership-toggle-card','.membership-toggle-title','.membership-toggle-meta'],
      '/gym-classes':['catalog','.gym-class-card','h2','.gym-class-meta-grid'] };
    const entry = routes[path.replace(/\/index\/?$|\/$/g,'')];
    if (entry) {
      page.kind = entry[0]; page.rows = all(root,entry[1]).slice(0,100).map((el,i) => ({id:String(i),
        title:text(el.querySelector(entry[2])),description:text(el.querySelector(entry[3])),
        badges:all(el,'.badge,.gym-status-badge,.gym-class-schedule-chip').slice(0,8).map(text),
        links:links(el,'a[href]',base).slice(0,8)}));
      const filter = root.querySelector(entry[0] === 'clients' ? '.clients-search form,form[method="get"]' : 'form[method="get"]');
      if (filter) {
        page.filterAction = safe(filter.getAttribute('action') || base,base);
        page.filters = all(filter,'input,select').filter(el => el.name && !el.disabled && !['hidden','submit','button','file','password'].includes(el.type)).slice(0,16).map(el => ({
          name:el.name,label:text(filter.querySelector('label[for="'+el.id.replace(/[^a-zA-Z0-9_-]/g,'')+'"]')) || el.placeholder || el.name,
          value:el.value,type:el.tagName === 'SELECT' ? 'select' : el.type,
          options:el.tagName === 'SELECT' ? all(el,'option').filter(o => !o.disabled).slice(0,100).map(o => ({value:o.value,label:text(o)})) : []
        }));
      }
      page.links = links(root,'.block-daytime-index a[href],.backoffice-page-title a[href],.gym-page-header__actions a[href],.gym-menu-page-header a[href]',base);
      page.pagination = links(root,'.pagination a[href],.pagination-modern a[href]',base);
      // Preserve the website when its card structure changes instead of showing a false empty list.
      if (!page.rows.length && !root.querySelector('.clients-index,.memberships-page,.gym-crud-page')) page.kind = 'web';
    }
    if (/^\/dashboard-gym(?:\/index)?\/?$/.test(path) && root.querySelector('.dashboard-gym-today')) {
      page.kind='dashboard'; page.summary=all(root,'.dashboard-summary-card').slice(0,12).map(el => ({
        label:text(el.querySelector('[data-summary-label]')),value:text(el.querySelector('[data-summary-value]'))}));
      page.links=links(root,'.dashboard-gym-management-link,.dashboard-gym-action,.dashboard-performance-view-link',base);
    }
    if (/\/view(?:\/|$)/.test(path) && root.querySelector('table.detail-view') && !root.querySelector('.page-content input:not([type="hidden"]),.page-content textarea,.main-content [role="tablist"],.main-content .nav-tabs,.main-content .tab-content,.main-content form,.main-content [data-bs-toggle="modal"],.main-content button')) {
      page.kind='details'; page.rows=all(root,'table.detail-view tr').slice(0,100).map((el,i)=>({id:String(i),
        title:text(el.querySelector('th')),description:text(el.querySelector('td')),badges:[],links:links(el,'a[href]',base)}));
      page.links=links(root,'.page-content .btn[href],.main-content .btn[href]',base);
    }
    if (live) {
      const controls = window.__scAdminPageControls = new Map();
      const revision = window.__scAdminPageRevision = (window.__scAdminPageRevision || 0) + 1;
      const control = el => {const id=revision+':'+controls.size;controls.set(id,el);return id;};
      page.actions = all(root,'.js-dashboard-clock-form button[type="submit"],.dashboard-access-ajax-form button[type="submit"]')
        .filter(el=>!el.disabled).slice(0,30).map(el=>({id:control(el),label:text(el),description:text(el.closest('[data-access-request]')?.querySelector('.fw-semibold'))}));
      const forms = all(root,'.page-content form, .main-content form').filter(form => form.method.toLowerCase()==='post' && !form.closest('.modal'));
      const form=forms.length===1?forms[0]:null;
      // Rich widgets, uploads and repeaters keep their existing editor, within the native frame.
      if (page.kind==='web' && form && /\/(?:create|update)(?:\/|$)/.test(path)
        && !form.querySelector('input[type="file"],input[type="password"],.select2,.select2-hidden-accessible,.selectize-control,.dynamicform_wrapper,[data-repeater-list],.tox-tinymce,.ql-editor')
        && all(form,'input,select,textarea').length<45) {
        const fields=all(form,'input,select,textarea').filter(el=>el.name&&!el.disabled&&!['hidden','submit','button'].includes(el.type));
        if (fields.length && fields.every(el=>!el.multiple && !['radio'].includes(el.type))) {
          page.kind='form'; page.form={id:control(form),fields:fields.map((el,index)=>({id:control(el),key:(el.id||el.name)+':'+index,
            label:fieldLabel(form,el),
            type:el.tagName==='SELECT'?'select':el.tagName==='TEXTAREA'?'textarea':el.type,
            value:el.type==='checkbox'?el.checked:el.value,required:el.required,readOnly:el.readOnly,
            options:el.tagName==='SELECT'?all(el,'option').filter(o=>!o.disabled).slice(0,200).map(o=>({value:o.value,label:text(o)})):[]
          })),label:text(form.querySelector('[type="submit"]'))||'Save',errors:all(form,'.invalid-feedback,.help-block,.error-summary').map(text).filter(Boolean)};
        }
      }
    }
    page.submitting = live && window.__scAdminFormSubmitting === true;
    return page;
  }
  function documentLevel(normalized=true) {
    const top=document.querySelector('#page-topbar');
    const explicit=top?.getAttribute('data-user-level')||top?.querySelector('#page-header-user-dropdown')?.getAttribute('data-user-level');
    if(explicit)return normalized?String(explicit).trim().toLowerCase():String(explicit).trim();
    // Older servers expose the role only in the translated sidebar summary.
    const row=all(document,'.vertical-menu .text-2').find(el=>{
      const label=text(el.querySelector('span')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s:]/g,'').toLowerCase();
      return ['level','nivel','role'].includes(label);
    });
    const value=text(row?.querySelector('span:nth-of-type(2)'));
    return normalized?value.toLowerCase():value;
  }
  function clientDocument() {
    const level=documentLevel();
    return ['client','cliente','member','socio','sócio'].includes(level)
      || /^\/dashboard-gym-client(?:\/|$)/.test(location.pathname)
      || (!level&&!!document.querySelector('.mobile-bottom-nav a[href*="dashboard-gym-client"]'));
  }
  function gymAdminDocument() {
    const top=document.querySelector('#page-topbar');
    if(!top||/^\/(?:$|(?:site\/)?(?:login|logout)(?:-mobile)?(?:\/|$)|form-signup(?:\/|$))/.test(location.pathname))return false;
    if(clientDocument())return false;
    const gymHome=links(document,'.mobile-bottom-nav a[href],.vertical-menu a[href]',location.href)
      .some(item=>/^\/dashboard-gym(?:\/index)?\/?$/.test(new URL(item.url).pathname));
    const signedIn=/^[a-f0-9]{64}$/.test(top.getAttribute('data-fitness-account')||'')
      && !!top.querySelector('#page-header-user-dropdown');
    const staff=['admin','administrator','administrador','team','equipa','equipe'].includes(documentLevel())
      && !!top.querySelector('#page-header-user-dropdown');
    return gymHome||signedIn||staff;
  }
  function publishDocument() {
    if (!gymAdminDocument()) {
      // The early WebView injection can run before the server header is parsed.
      // DOMContentLoaded will publish the complete document; do not reject it yet.
      if(document.readyState==='loading')return;
      const top=document.querySelector('#page-topbar');
      const reason=clientDocument()?'CLIENT_PAGE':!top?'HEADER_MISSING':!top.querySelector('#page-header-user-dropdown')?'ACCOUNT_CONTROL_MISSING':'ROLE_UNRECOGNIZED';
      send({event:'document',active:false,bridgeVersion:2,reason,client:clientDocument()});return;
    }
    // A settings/support page may render the generic footer. Rebuild only the
    // existing gym tabs from links the current server document permits.
    const navigation=links(document,'.mobile-bottom-nav > a[href],.vertical-menu a[href]',location.href);
    const footer=['dashboard-gym','clients-list','gym-classes','memberships'].flatMap(route=>{
      const item=navigation.find(item=>new URL(item.url).pathname.replace(/\/index\/?$|\/$/g,'')==='/'+route);
      return item?[item]:[];
    });
    // Restricted Team menus can grant Attendance/Waivers instead of the admin's
    // four default tabs. Fill free slots only from actual permitted sidebar links.
    if(['team','equipa','equipe'].includes(documentLevel())&&footer.length<4){
      const route=url=>new URL(url).pathname.replace(/\/index\/?$|\/$/g,'');
      const used=new Set(footer.map(item=>route(item.url)));
      for(const item of links(document,'.vertical-menu a[href]',location.href)){
        const path=route(item.url);
        if(used.has(path)||!/^\/[a-z][a-z0-9-]*$/.test(path)||['/profile','/preferences','/dashboard','/login','/logout'].includes(path))continue;
        footer.push(item);used.add(path);if(footer.length===4)break;
      }
    }
    const page=snapshot(document,location.href,true);
    const register=el=>{const id=window.__scAdminPageRevision+':'+window.__scAdminPageControls.size;window.__scAdminPageControls.set(id,el);return id;};
    const top=document.querySelector('#page-topbar');
    const language=top.querySelector('select#language,select[data-language-url]');
    const noticeMenu=top.querySelector('.company-notifications-menu');
    const bell=top.querySelector('.bx-bell')?.closest('button');
    const gift=top.querySelector('.bx-gift')?.closest('.dropdown');
    // Inbox and birthday links belong to their header sheets, not navigation.
    // Filter elements before deduplication so a real menu link to the same URL survives.
    const companySummary=el=>all(el,'.text-2').length>=2&&all(el,'.text-2').some(row=>all(row,'span').length>=2);
    const navigationLink=el=>!el.closest('.company-notifications-menu,.company-notification-row,.notification-item')&&!gift?.contains(el)&&!companySummary(el);
    const menu=links(document,'#page-topbar a[href],.vertical-menu a[href],#fabMenu a[href]',location.href,navigationLink);
    const sidebar=document.querySelector('.vertical-menu');
    let menuNodes=0;
    const sidebarItems=(parent,depth=0)=>{
      if(depth>5||menuNodes>=160)return [];
      return all(parent,'li').filter(el=>{
        const ancestor=el.parentElement?.closest('li');return !ancestor||ancestor===parent||!parent.contains(ancestor);
      }).flatMap((el,index)=>{
        if(menuNodes++>=160||el.dataset.permissionBlocked==='1')return [];
        const anchor=Array.from(el.children).find(child=>child.tagName==='A');
        if(anchor?.dataset.permissionBlocked==='1')return [];
        const children=sidebarItems(el,depth+1);
        if(anchor&&companySummary(anchor))return children;
        const label=text(anchor?.querySelector(':scope > span')||anchor||Array.from(el.children).find(child=>child.tagName==='SPAN'))
          ||(el.classList.contains('menu-title')?text(el):'');
        const href=anchor?.getAttribute('href');
        const url=href&&href!=='#'&&readOnly(anchor)?safe(href,location.href):null;
        if(!label||(!url&&!children.length&&!el.classList.contains('menu-title')))return [];
        return [{id:'sidebar:'+depth+':'+index,label,url,children}];
      });
    };
    const menuTree=sidebar?sidebarItems(sidebar):[];
    // Account/header actions are separate leaves. Do not repeat sidebar or FAB
    // links after extracting the permission-filtered category hierarchy.
    if(menuTree.length){
      const targets=new Set();const collect=items=>items.forEach(item=>{if(item.url)targets.add(item.url);collect(item.children);});collect(menuTree);
      links(document,'#page-topbar a[href]',location.href,navigationLink).forEach((item,index)=>{
        if(!targets.has(item.url)){menuTree.push({...item,id:'account:'+index,children:[]});targets.add(item.url);}
      });
    }
    const logoutTarget=el=>{
      const target=safe(el.getAttribute('href')||el.closest('form')?.getAttribute('action'),location.href);
      return !!target&&/^\/(?:site\/)?logout(?:-mobile)?\/?$/.test(new URL(target).pathname);
    };
    const controls=all(document,'#page-topbar a[data-method],#page-topbar a[href*="logout"]').filter(el=>navigationLink(el)&&safe(el.getAttribute('href'),location.href));
    const logoutForms=all(top,'form[action]').filter(form=>form.method.toLowerCase()==='post'&&logoutTarget(form));
    // Invoke the existing submit button so cookies, CSRF and server redirects stay intact.
    const logoutButton=logoutForms.map(form=>form.querySelector('button[type="submit"],input[type="submit"],button:not([type])')).find(el=>el&&!el.disabled);
    if(logoutButton&&!controls.some(logoutTarget))controls.push(logoutButton);
    const share=top.querySelector('.bx-share-alt')?.closest('button');
    // Extract only the known public signup URL. Never execute onclick text in native code.
    const shareMatch=share?.getAttribute('onclick')?.match(/window\.open\(['"]([^'"]+)['"]/);
    const shareUrl=shareMatch?safe(shareMatch[1],location.href):null;
    const levelValue=documentLevel(false);
    const header={
      accountKey:/^[a-f0-9]{64}$/.test(top.getAttribute('data-fitness-account')||'')?top.getAttribute('data-fitness-account'):null,
      logoUrl:safe(top.getAttribute('data-company-mobile-logo'),location.href),
      color:getComputedStyle(document.documentElement).getPropertyValue('--sc-primary').trim(),
      company:text(noticeMenu?.querySelector('.company-notifications-company')),
      user:{name:text(top.querySelector('#page-header-user-dropdown > span')).slice(0,120),
        level:String(levelValue||'').trim().slice(0,60)},
      language:language?{id:register(language),value:language.value,options:all(language,'option').filter(el=>!el.disabled).map(el=>({value:el.value,label:text(el)}))}:null,
      notifications:noticeMenu?{count:Number(text(bell?.querySelector('.badge')))||0,rows:all(noticeMenu,'.company-notification-row').slice(0,30).map((el,i)=>{
        const toggle=el.querySelector('.company-notification-check');
        const task=!!el.querySelector('.company-notification-icon.is-task,.bx-task,[data-task-id]')
          ||all(el,'a[href]').some(link=>{try{return /^\/task-operations\/(?:view|update)\/?$/.test(new URL(link.getAttribute('href'),location.href).pathname);}catch{return false;}});
        return {id:String(i),type:task?'task':'notification',title:text(el.querySelector('.company-notification-title')),body:text(el.querySelector('.company-notification-body')),
          meta:text(el.querySelector('.company-notification-meta')),url:links(el,'a[href]',location.href)[0]?.url||null,
          read:toggle?toggle.checked:!el.classList.contains('is-unread'),control:toggle?register(toggle):null,disabled:!!toggle?.disabled};
      })}:null,
      birthdays:gift?{rows:all(gift,'.notification-item').filter(el=>el.querySelector('h6')).slice(0,100).map((el,i)=>({id:String(i),
        today:el.dataset.birthdayToday==='1',isSelf:el.dataset.birthdaySelf==='1',
        title:text(el.querySelector('h6')),body:all(el,'p').map(text).join(' · '),url:links(el.parentNode,'a[href]',location.href).find(link=>link.url===safe(el.getAttribute('href'),location.href))?.url||null}))}:null,
      share:shareUrl&&new URL(shareUrl).pathname==='/form-signup'?{url:shareUrl}:null,
    };
    const accountActions=controls.map(el=>{const id=window.__scAdminPageRevision+':'+window.__scAdminPageControls.size;window.__scAdminPageControls.set(id,el);return {id,label:text(el)||el.value||'',kind:logoutTarget(el)?'logout':'account'};});
    let scanner=null;try {scanner=JSON.parse(document.querySelector('#gymMemberQrScanner')?.dataset.config||'null');}catch{}
    send({event:'document',active:true,language:document.documentElement.lang?.startsWith('pt')?'pt':'en',footer,menu,menuTree,accountActions,scanner,page,header,
      create:links(document,'#fabMenu a[href]',location.href)});
  }
  function ready() {
    try {publishDocument();}
    catch {
      if(gymAdminDocument())
        send({event:'error',code:'snapshot_failed',url:location.href});
    }
  }
  if (c.action==='install') {
    if (!window.__scAdminPagesInstalled) {
      window.__scAdminPagesInstalled=true; document.addEventListener('DOMContentLoaded',ready,{once:true});
      document.addEventListener('invalid',()=>{window.__scAdminFormSubmitting=false;setTimeout(ready,0);},true);
      const notices=document.querySelector('.company-notifications-menu');
      if(notices&&typeof MutationObserver!=='undefined') {
        let timer;
        const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(ready,150);});
        observer.observe(notices,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','disabled']});
        window.addEventListener('pagehide',()=>{observer.disconnect();clearTimeout(timer);},{once:true});
      }
    }
    ready();return;
  }
  if (c.action==='frame') {
    document.documentElement.classList.toggle('__scNativeAdminFrame',c.enabled);
    if (c.enabled && !document.getElementById('__scNativeAdminFrameCss')) {
      const style=document.createElement('style');style.id='__scNativeAdminFrameCss';
      style.textContent='html.__scNativeAdminFrame #page-topbar,html.__scNativeAdminFrame .mobile-bottom-nav,html.__scNativeAdminFrame .vertical-menu,html.__scNativeAdminFrame footer.footer,html.__scNativeAdminFrame .footer-space,html.__scNativeAdminFrame .footer-space-mobile{display:none!important}html.__scNativeAdminFrame body{padding-bottom:0!important}html.__scNativeAdminFrame .main-content{width:100%!important;margin-left:0!important;margin-top:0!important}html.__scNativeAdminFrame .page-content{padding-top:0!important;padding-bottom:0!important}html.__scNativeAdminFrame .gym-app-layout{padding:16px!important}';
      (document.head||document.documentElement).appendChild(style);
    }
    // Optional page styling must never stop the native frame from hiding web chrome.
    if(c.enabled){try{${summaryCardLayoutScript}}catch(error){send({event:'layout-error',code:'summary_layout'});}}
    if(c.enabled){try{${subcategoryTabsScript}}catch(error){send({event:'layout-error',code:'subcategory_layout'});}}
    return;
  }
  if (c.action==='change') {
    const el=window.__scAdminPageControls?.get(c.id);
    if(!el||!document.contains(el)||el.disabled)return;
    if(el.tagName==='SELECT') {
      if(!all(el,'option').some(option=>!option.disabled&&option.value===c.value))return;
      el.value=c.value;
    }else if(el.type==='checkbox')el.checked=c.value===true;
    else return;
    el.dispatchEvent(new Event('change',{bubbles:true}));
    setTimeout(ready,250);setTimeout(ready,1500);setTimeout(ready,5000);return;
  }
  if (c.action==='invoke' || c.action==='submit') {
    const el=window.__scAdminPageControls?.get(c.id);if(!el||!document.contains(el))return;
    if(c.action==='invoke')el.click();
    else if(el.tagName==='FORM') {
      if(window.__scAdminFormSubmitting)return;
      for(const [id,value] of Object.entries(c.values||{})) {
        const field=window.__scAdminPageControls.get(id);
        if(!field||field.form!==el||field.disabled||field.readOnly||['hidden','password','file'].includes(field.type))continue;
        if(field.type==='checkbox')field.checked=value===true;else field.value=String(value).slice(0,10000);
        field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));
      }
      window.__scAdminFormSubmitting=true;
      if(window.jQuery)window.jQuery(el).one('afterValidate',function(event,messages,attributes){
        if(attributes?.length){window.__scAdminFormSubmitting=false;setTimeout(ready,0);}
      });
      el.requestSubmit();
      setTimeout(()=>{window.__scAdminFormSubmitting=false;ready();},15000);
    }
    setTimeout(ready,500);setTimeout(ready,1500);return;
  }
  if(c.action==='read') {
    let target;try{target=new URL(c.url,c.origin);}catch{return;}
    if(target.origin!==c.origin||!/^\/(clients-list|gym-classes|memberships)(\/index)?\/?$/.test(target.pathname)||target.searchParams.has('r'))return;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    fetch(target.href,{credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{Accept:'text/html'}}).then(async response=>{
      const final=new URL(response.url||target.href);
      if(final.origin!==c.origin||/\/(?:login|logout)(?:\/|$)/.test(final.pathname)) {send({event:'response',id:c.id,status:401});return;}
      if(!response.ok){send({event:'response',id:c.id,status:response.status});return;}
      const root=new DOMParser().parseFromString(await response.text(),'text/html');
      const page=snapshot(root,final.href,false);send({event:'response',id:c.id,status:200,page});
    }).catch(()=>send({event:'response',id:c.id,status:0})).finally(()=>clearTimeout(timer));
  }
}`;
export function adminPageScript(base, action = 'install', params = {}) {
  if (!['install','frame','read','invoke','submit','change'].includes(action)) throw Error('Unsupported page action');
  if (action === 'read' && !adminListUrl(params.url, base)) throw Error('Unsupported list');
  const clean = action === 'install' ? {documentId:Number.isSafeInteger(params.documentId)?params.documentId:0}
    : action === 'read' ? {url:adminListUrl(params.url,base),id:String(params.id)}
    : action === 'frame' ? {enabled:params.enabled === true}
      : ['invoke','submit','change'].includes(action) ? {id:String(params.id),values:action === 'submit' ? params.values : undefined,
        value:action==='change'?(typeof params.value==='boolean'?params.value:String(params.value).slice(0,255)):undefined} : {};
  return '(' + SOURCE + ')(' + JSON.stringify({origin:new URL(base).origin,action,...clean}) + ');true;';
}
export function validAdminPage(page, base) {
  return page && sameGymOrigin(page.url,base) && typeof page.title === 'string'
    && ['dashboard','clients','catalog','memberships','details','form','web'].includes(page.kind) && Array.isArray(page.rows);
}
export function adminPageLabels(language) {
  return language === 'pt' ? {menu:'Menu',more:'Mais',create:'Criar',search:'Procurar',filter:'Filtrar',apply:'Aplicar',
    fullPage:'Abrir página completa',native:'Voltar à aplicação',scan:'Ler código QR',camera:'Permitir câmara',cameraDenied:'Permita o acesso à câmara nas definições.',
    settings:'Abrir definições',invalidQr:'Este QR não pertence a um sócio deste clube.',scanAgain:'Ler novamente',save:'Guardar',
    empty:'Não há resultados.',loading:'A carregar…',error:'Não foi possível carregar. Tente novamente.',confirm:'Confirmar ação?',account:'Conta',
    details:'Detalhes',dashboard:'Resumo',schedule:'Horário de aulas',cancel:'Cancelar',close:'Fechar',refresh:'Atualizar',back:'Voltar',
    language:'Idioma',notifications:'Notificações',birthdays:'Aniversários',share:'Partilhar inscrição',markRead:'Marcar como lida',markUnread:'Marcar como não lida',
    emptyNotifications:'Sem notificações.',emptyBirthdays:'Sem aniversários.',company:'Empresa',copy:'Copiar código da empresa',copied:'Copiado',retry:'Tentar novamente',
    adminLabel:'Administração',overview:'O clube hoje',records:'registos',loadingApp:'A preparar a administração…',setupError:'Não foi possível abrir esta área.',
    happyBirthday:'Parabéns!',happyBirthdayBody:'Desejamos-lhe um excelente dia de aniversário!',signIn:'Iniciar sessão',logout:'Terminar sessão',openEditor:'Abrir editor',editorInfo:'Este formulário tem ferramentas adicionais. Abra o editor para continuar.',shareShort:'Partilhar',reference:'Referência'}
    : {menu:'Menu',more:'More',create:'Create',search:'Search',filter:'Filter',apply:'Apply',fullPage:'Open full page',native:'Back to app',
      scan:'Scan QR code',camera:'Allow camera',cameraDenied:'Allow camera access in Settings.',settings:'Open Settings',
      invalidQr:'This QR does not belong to a member of this club.',scanAgain:'Scan again',save:'Save',empty:'No results.',loading:'Loading…',
      error:'Could not load. Please try again.',confirm:'Confirm action?',account:'Account',details:'Details',dashboard:'Dashboard',
      schedule:'Class schedule',cancel:'Cancel',close:'Close',refresh:'Refresh',back:'Back',
      language:'Language',notifications:'Notifications',birthdays:'Birthdays',share:'Share signup',markRead:'Mark as read',markUnread:'Mark as unread',
      emptyNotifications:'No notifications.',emptyBirthdays:'No birthdays.',company:'Company',copy:'Copy company code',copied:'Copied',retry:'Try again',
      adminLabel:'Administration',overview:'Your club today',records:'records',loadingApp:'Preparing administration…',setupError:'Could not open this area.',
      happyBirthday:'Happy birthday!',happyBirthdayBody:'Wishing you a wonderful birthday!',signIn:'Sign in',logout:'Log out',openEditor:'Open editor',editorInfo:'This form has additional tools. Open the editor to continue.',shareShort:'Share',reference:'Reference'};
}
