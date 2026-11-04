const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),babel=require('@babel/core'),{JSDOM}=require('jsdom');
const api={};const {code}=babel.transformSync(fs.readFileSync('src/utils/subcategoryTabs.js','utf8'),{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']});vm.runInNewContext(code,{exports:api,URL});
const base='https://club.example';
const tree=[{label:'Members',children:[{label:'List',url:base+'/clients-list'},{label:'Memberships',url:base+'/memberships'},{label:'Attendance',url:base+'/client-attendance'},{label:'Waivers',url:base+'/waivers'}]},{label:'Events',children:[{label:'Events',url:base+'/events-list'},{label:'Participants',url:base+'/event-clients'}]}];
test('sibling pills follow the current category on index, view and edit routes',()=>{
 for(const path of ['/waivers','/waivers/index','/waivers/update/3']){
  const tabs=api.subcategoryTabsForPage(tree,base+path);assert.equal(tabs.length,4);assert.equal(tabs.find(t=>t.active).label,'Waivers');
 }
 assert.deepEqual(Array.from(api.subcategoryTabsForPage(tree,base+'/event-clients'),t=>t.label),['Events','Participants']);
 assert.equal(api.subcategoryTabsForPage(tree,base+'/unknown').length,0);
});
test('deep categories use immediate siblings, without inventing inaccessible menu routes',()=>{
 const nested=[{label:'Settings',children:[{label:'Payments',children:[{label:'Setup',url:base+'/payments-setup'},{label:'Transactions',url:base+'/transactions'}]},{label:'Profile',url:base+'/profile'}]}];
 assert.deepEqual(Array.from(api.subcategoryTabsForPage(nested,base+'/transactions/view/4'),t=>t.label),['Setup','Transactions']);
 const filtered=[{children:[{label:'Waivers',url:base+'/waivers'},{label:'Logout',url:base+'/site/logout'},{label:'Foreign',url:'https://other.example/x'}]}];
 assert.equal(api.subcategoryTabsForPage(filtered,base+'/waivers').length,0);
});
const sidebar='<aside class="vertical-menu"><ul><li><a href="#">Members</a><ul><li><a href="/clients-list"><span>List</span></a></li><li><a href="/memberships">Memberships</a></li><li data-permission-blocked="1"><a href="/restricted">Restricted</a></li><li><a href="/waivers">Waivers</a></li></ul></li></ul></aside>';
test('website pills retain real links, exclude denied entries, and do not duplicate on updates',()=>{
 const dom=new JSDOM(sidebar+'<main class="gym-app-layout"><div class="gym-canonical-page-heading">Waivers</div><ul class="waiver-tabs nav"><li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#members">Clients</button></li></ul><section id="members"></section></main>',{url:base+'/waivers/update/3',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,button=w.document.querySelector('[data-bs-toggle]');let clicks=0;button.addEventListener('click',()=>clicks++);
 w.eval(api.subcategoryTabsScript);w.eval(api.subcategoryTabsScript);
 const links=[...w.document.querySelectorAll('.gym-app-subcategory-pill')];assert.equal(links.length,3);assert.equal(links.find(a=>a.getAttribute('aria-current')==='page').textContent,'Waivers');
 assert.equal(links[0].href,base+'/clients-list');assert.ok(!links.some(a=>a.textContent==='Restricted'));
 button.click();assert.equal(clicks,1);assert.equal(button.getAttribute('data-bs-target'),'#members');assert.equal(w.document.querySelector('[data-bs-toggle]'),button);
 assert.equal(w.document.querySelectorAll('.gym-app-subcategory-nav').length,1);dom.window.close();
});
test('scroll controls move the strip while pills remain sized to their labels',()=>{
 const dom=new JSDOM(sidebar+'<main class="gym-app-layout"></main>',{url:base+'/waivers',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;
 w.eval(api.subcategoryTabsScript);const strip=w.document.querySelector('.gym-app-subcategory-scroll');Object.defineProperty(strip,'clientWidth',{value:240});let movement;
 strip.scrollBy=value=>{movement=value;};w.document.querySelectorAll('.gym-app-subcategory-arrow')[1].click();assert.equal(movement.left,180);
 assert.match(api.subcategoryTabsStyles,/flex:0 0 auto!important/);assert.match(api.subcategoryTabsStyles,/min-width:0!important/);dom.window.close();
});
test('native-only hiding is scoped to the existing frame marker and compiled functions are not serialized',()=>{
 assert.match(api.subcategoryTabsStyles,/html\.__scNativeAdminFrame \.gym-app-subcategory-nav/);
 assert.match(api.subcategoryTabsStyles,/@media\(min-width:768px\)\{\.gym-app-subcategory-nav\{display:none!important/);
 const compiled={};vm.runInNewContext("Function.prototype.toString=function(){return '[bytecode]'};\n"+code,{exports:compiled,URL});
 const dom=new JSDOM(sidebar+'<main class="gym-app-layout"></main>',{url:base+'/waivers',runScripts:'outside-only',pretendToBeVisual:true});assert.doesNotThrow(()=>dom.window.eval(compiled.subcategoryTabsScript));dom.window.close();
});
test('Club Settings links are intrinsic pills even without Bootstrap nav-link classes',()=>{
 assert.match(api.subcategoryTabsStyles,/\.company-settings-nav>a\{[^}]*flex:0 0 auto!important/);
 assert.match(api.subcategoryTabsStyles,/\.company-settings-nav>a\{[^}]*width:max-content!important/);
 assert.match(api.subcategoryTabsStyles,/\.company-settings-nav>a\{[^}]*white-space:nowrap!important/);
 const dom=new JSDOM('<main class="gym-app-layout"><nav class="company-settings-nav"><a href="#company-details"><i class="bx bx-buildings"></i>Details</a><a href="#company-booking"><i class="bx bx-calendar-check"></i>Bookings &amp; cancellations</a></nav><section id="company-booking"></section></main>',{url:base+'/company',runScripts:'outside-only',pretendToBeVisual:true});
 const link=dom.window.document.querySelectorAll('a')[1];let clicks=0;link.addEventListener('click',()=>clicks++);
 dom.window.eval(api.subcategoryTabsScript);link.click();
 assert.equal(dom.window.document.querySelectorAll('a')[1],link);assert.equal(link.getAttribute('href'),'#company-booking');assert.equal(clicks,1);dom.window.close();
});
