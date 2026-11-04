export function subcategoryTabsForPage(tree, currentUrl) {
  let current;try{current=new URL(currentUrl);}catch{return [];}
  const normalize=path=>path.replace(/\/index\/?$/,'').replace(/\/+$/,'')||'/';
  let best=null;
  const target=item=>{
    try{
      const url=new URL(item.url,current);
      if(!item.url||url.origin!==current.origin||!['https:','http:'].includes(url.protocol)||url.hash||url.username||url.password
        ||/\/(?:logout|delete|remove|approve|reject|switch-company)(?:[/?]|$)/.test(url.pathname))return null;
      return url;
    }catch{return null;}
  };
  function visit(nodes,peers=null){
    for(const item of nodes||[]){
      const url=target(item),path=url&&normalize(url.pathname),here=normalize(current.pathname);
      if(url&&(here===path||path!=='/'&&here.startsWith(path+'/'))&&[...url.searchParams].every(([k,v])=>current.searchParams.get(k)===v)){
        const score=path.length+[...url.searchParams].length;
        if(peers&&(!best||score>best.score))best={score,peers,item};
      }
      if(item.children?.length)visit(item.children,item.children);
    }
  }
  visit(tree);
  if(!best)return [];
  const seen=new Set();
  const tabs=best.peers.flatMap(item=>{
    const url=target(item);if(!url||seen.has(url.href))return [];seen.add(url.href);
    return [{label:item.label,url:url.href,active:item===best.item}];
  });
  return tabs.length>1?tabs:[];
}

export const subcategoryTabsStyles=`
.gym-app-subcategory-nav{display:flex;align-items:center;gap:4px;margin:0 0 16px;min-width:0;max-width:100%;}
.gym-app-subcategory-scroll{display:flex;align-items:center;gap:8px;flex:1;min-width:0;overflow-x:auto;scrollbar-width:thin;scrollbar-color:var(--sc-primary,#198754) transparent;padding:2px 0 6px;}
.gym-app-subcategory-pill{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto!important;width:auto!important;min-width:0!important;white-space:nowrap!important;padding:9px 14px;border:1px solid var(--gym-app-border,#e4eaf2);border-radius:20px;background:#f3f6fa;color:var(--gym-app-text,#101b30);text-decoration:none;font-size:13px;line-height:20px;font-weight:600;}
.gym-app-subcategory-pill[aria-current=page]{background:var(--sc-primary,#198754);border-color:var(--sc-primary,#198754);color:#fff;}
.gym-app-subcategory-arrow{flex:0 0 28px;width:28px;height:34px;padding:0;border:0;border-radius:12px;background:var(--gym-app-brand-soft,#edf6f1);color:var(--sc-primary,#198754);font-size:23px;line-height:1;cursor:pointer;}
.gym-app-subcategory-arrow[hidden]{display:none!important;}
html.__scNativeAdminFrame .gym-app-subcategory-nav{display:none!important;}
@media(min-width:768px){.gym-app-subcategory-nav{display:none!important;}}
.gym-app-layout :is(.waiver-tabs,.nav-tabs,.nav-pills,.company-settings-nav,.client-view-tabs){display:flex!important;flex-wrap:nowrap!important;gap:8px!important;overflow-x:auto!important;max-width:100%;min-width:0;scrollbar-width:thin;padding-bottom:6px!important;}
.gym-app-layout :is(.waiver-tabs,.nav-tabs,.nav-pills,.company-settings-nav,.client-view-tabs)>.nav-item{flex:0 0 auto!important;width:auto!important;min-width:0!important;}
.gym-app-layout :is(.waiver-tabs,.nav-tabs,.nav-pills,.company-settings-nav,.client-view-tabs) :is(.nav-link,a[role=tab]){flex:0 0 auto!important;width:auto!important;min-width:0!important;white-space:nowrap!important;padding:9px 14px!important;font-size:13px!important;line-height:20px!important;border-radius:20px!important;}
.gym-app-layout .company-settings-nav{width:100%;box-sizing:border-box;overflow-y:hidden!important;align-items:center!important;padding:8px!important;}
.gym-app-layout .company-settings-nav>a{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;flex:0 0 auto!important;width:max-content!important;max-width:none!important;min-width:0!important;white-space:nowrap!important;word-break:normal!important;overflow-wrap:normal!important;padding:9px 14px!important;font-size:13px!important;line-height:20px!important;border:1px solid var(--gym-app-border,#e4eaf2);border-radius:20px!important;background:var(--gym-app-brand-soft,#edf6f1);color:var(--sc-primary,#198754);}
.gym-app-layout .company-settings-nav>a>i{flex:0 0 auto!important;line-height:20px!important;font-size:18px!important;}
`;

// Literal source also runs on the website. Do not stringify compiled functions.
export const subcategoryTabsScript=String.raw`(function(){
 if(!document.getElementById('gym-subcategory-styles')){var style=document.createElement('style');style.id='gym-subcategory-styles';style.textContent=${JSON.stringify(subcategoryTabsStyles)};(document.head||document.documentElement).appendChild(style);}
 function enhance(){
  var sidebar=document.querySelector('.vertical-menu');if(!sidebar)return;
  var current=new URL(location.href),normalize=function(p){return p.replace(/\/index\/?$/,'').replace(/\/+$/,'')||'/';};
  function safe(anchor){try{if(!anchor||anchor.closest('[data-permission-blocked="1"]')||anchor.hasAttribute('data-method')||anchor.hasAttribute('data-confirm'))return null;var raw=anchor.getAttribute('href');if(!raw||raw==='#')return null;var url=new URL(raw,location.href);if(url.origin!==current.origin||url.hash||!/^https?:$/.test(url.protocol)||/\/(?:logout|delete|remove|approve|reject|switch-company)(?:[/?]|$)/.test(url.pathname))return null;return url;}catch{return null;}}
  var best=null;
  sidebar.querySelectorAll('li>a[href]').forEach(function(anchor){var url=safe(anchor);if(!url)return;var p=normalize(url.pathname),here=normalize(current.pathname);if(!(here===p||p!=='/'&&here.indexOf(p+'/')===0))return;var queryOk=true;url.searchParams.forEach(function(v,k){if(current.searchParams.get(k)!==v)queryOk=false;});if(queryOk&&(!best||p.length>best.score))best={anchor:anchor,score:p.length};});
  if(!best)return;
  var list=best.anchor.parentElement.parentElement;
  if(!list||!list.closest('li'))return;
  var seen={},items=[];
  Array.from(list.children).forEach(function(li){var anchor=Array.from(li.children).find(function(el){return el.tagName==='A';}),url=safe(anchor);if(!url||seen[url.href])return;seen[url.href]=true;var label=(anchor.querySelector(':scope>span')||anchor).textContent.replace(/\s+/g,' ').trim();if(label)items.push({label:label,url:url.href,active:anchor===best.anchor});});
  if(items.length<2)return;
  document.querySelectorAll('.gym-app-layout').forEach(function(root){
   if(root.querySelector('.gym-app-subcategory-nav'))return;
   var pt=document.documentElement.lang.indexOf('pt')===0,nav=document.createElement('nav'),scroll=document.createElement('div');nav.className='gym-app-subcategory-nav';nav.setAttribute('aria-label',pt?'Subcategorias':'Subcategories');scroll.className='gym-app-subcategory-scroll';
   function arrow(direction){var button=document.createElement('button');button.type='button';button.className='gym-app-subcategory-arrow';button.textContent=direction<0?'‹':'›';button.setAttribute('aria-label',pt?(direction<0?'Deslocar para a esquerda':'Deslocar para a direita'):(direction<0?'Scroll left':'Scroll right'));button.onclick=function(){scroll.scrollBy({left:direction*scroll.clientWidth*.75,behavior:'smooth'});};return button;}
   var left=arrow(-1),right=arrow(1);nav.append(left,scroll,right);
   items.forEach(function(item){var link=document.createElement('a');link.className='gym-app-subcategory-pill';link.href=item.url;link.textContent=item.label;if(item.active)link.setAttribute('aria-current','page');scroll.appendChild(link);});
   var heading=root.querySelector('.gym-canonical-page-heading');if(heading)heading.after(nav);else root.prepend(nav);
   function update(){left.hidden=scroll.scrollLeft<=1;right.hidden=scroll.scrollLeft+scroll.clientWidth>=scroll.scrollWidth-1;}
   scroll.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update);requestAnimationFrame(function(){var selected=scroll.querySelector('[aria-current=page]');if(selected)scroll.scrollLeft=Math.max(0,selected.offsetLeft-scroll.offsetLeft-12);update();});
  });
 }
 if(!window.GymSubcategoryTabs){window.GymSubcategoryTabs={enhance:enhance};document.addEventListener('DOMContentLoaded',enhance);document.addEventListener('gym:content-updated',enhance);if(window.jQuery)window.jQuery(document).on('pjax:end.gymSubcategories',enhance);}
 window.GymSubcategoryTabs.enhance();
})();`;
