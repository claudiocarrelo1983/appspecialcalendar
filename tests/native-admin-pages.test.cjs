const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test'),babel=require('@babel/core'),{JSDOM}=require('jsdom');
const base='https://c20260531125358085.specialcalendar.com/';
function load(file,mocks={},globals={}){
  const {code}=babel.transformSync(fs.readFileSync(path.join(__dirname,'../src/utils',file),'utf8'),{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']});
  const exports={};vm.runInNewContext(code,{exports,URL,...globals,require(name){assert.ok(name in mocks,name);return mocks[name];}});return exports;
}
const summaryLayout=load('summaryCardLayout.js');
const gym=load('nativeGymCore.js'),core=load('nativeAdminPages.js',{'./nativeGymCore':gym,'./summaryCardLayout':summaryLayout,'./subcategoryTabs':load('subcategoryTabs.js')});
const navigation=load('nativeAdminNavigation.js',{'./nativeGymCore':gym});
test('native event create/edit fields use weekday labels and preserve each checkbox value',()=>{
 for(const route of ['events-list/create','events-list/update/7']){
  const b=browser(`<form method="post"><label>Cost<input name="Events[cost]" value="10"></label><fieldset><legend>Available days</legend>${['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((day,i)=>`<label class="form-check"><input type="checkbox" name="Events[availableWeekDaysArr][]" value="${i}" ${i===1?'checked':''}><span>${day}</span></label>`).join('')}<button type="submit">Save</button></fieldset></form>`,base+route);
  const fields=b.document().page.form.fields;assert.deepEqual(fields.slice(1).map(field=>field.label),['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']);
  assert.equal(fields[2].value,true);assert.equal(fields[1].value,false);
  b.run('change',{id:fields[1].id,value:true});
  const controls=b.w.document.querySelectorAll('input[type=checkbox]');assert.equal(controls[0].checked,true);assert.equal(controls[1].checked,true);assert.equal(controls[0].value,'0');assert.equal(controls[1].value,'1');
 }
});
const chrome=`<header id="page-topbar"><a href="/profile">Profile</a><a href="/site/logout" data-method="post">Logout</a></header>
  <aside class="vertical-menu"><a href="/reports">Reports</a><a href="#" data-permission-blocked="1">Forbidden</a><a href="https://other.example/admin">Foreign</a></aside>
  <div class="mobile-bottom-nav"><a href="/dashboard-gym">Dashboard</a><a href="/clients-list">Clients</a><div id="fabMenu"><a href="/memberships/create">Create membership</a></div><a href="/gym-classes">Classes</a><a href="/memberships">Memberships</a></div>`;
function browser(html='',url=base+'clients-list',prefix=chrome){
  const dom=new JSDOM(`<!doctype html><html lang="pt"><head><meta name="csrf-token" content="private-csrf"><title>Club</title></head><body>${prefix}<main class="main-content"><div class="page-content">${html}</div></main></body></html>`,{url,runScripts:'outside-only'});
  const messages=[],w=dom.window;w.ReactNativeWebView={postMessage:value=>messages.push(JSON.parse(value))};
  Object.defineProperty(w.document,'readyState',{configurable:true,get:()=> 'complete'});
  w.AbortController=AbortController;w.setTimeout=()=>1;w.clearTimeout=()=>{};
  const run=(action,params)=>w.eval(core.adminPageScript(base,action,params));run('install');
  return {dom,w,messages,run,document:()=>messages.filter(m=>m.event==='document').at(-1)};
}

test('admin branding comes from the saved club CSS and is re-read after settings save',()=>{
  const b=browser();
  b.w.document.documentElement.style.setProperty('--sc-primary','#b52683');
  b.run('install');assert.equal(b.document().header.color,'#b52683');
  b.w.document.documentElement.style.setProperty('--sc-primary','#1278cc');
  b.run('install');assert.equal(b.document().header.color,'#1278cc');
});

test('mobile header logo comes from the current company and rejects foreign asset URLs',()=>{
 const b=browser();b.w.document.querySelector('#page-topbar').setAttribute('data-company-mobile-logo','/images/company/mobile.png?v=2');b.run('install');
 assert.equal(b.document().header.logoUrl,base+'images/company/mobile.png?v=2');
 b.w.document.querySelector('#page-topbar').setAttribute('data-company-mobile-logo','https://another.example/logo.png');b.run('install');assert.equal(b.document().header.logoUrl,null);b.dom.window.close();
});

test('tabbed client View and interactive detail pages retain every original control inside the app frame',()=>{
 const table='<table class="detail-view"><tr><th>Name</th><td>Member</td></tr></table>';
 for(const control of ['<ul role="tablist"><li><a data-bs-toggle="tab" href="#memberships">Memberships</a></li></ul><div class="tab-content"><div id="memberships">Payment controls</div></div>','<button type="button" data-bs-toggle="modal" data-bs-target="#edit">Edit</button>']){
  const b=browser(table+control,base+'clients-list/view/1614');
  assert.equal(b.document().page.kind,'web','Interactive View must not be flattened into table-only native rows');
  assert.ok(b.w.document.querySelector('[data-bs-toggle]'));b.run('frame',{enabled:true});
  assert.ok(b.w.document.querySelector('[data-bs-toggle]'),'Framing retains the actual tab/modal controls');b.dom.window.close();
 }
 const simple=browser(table,base+'clients-list/view/1614');assert.equal(simple.document().page.kind,'details');simple.dom.window.close();
});

test('real task notifications retain their type and existing completion control across the native bridge',()=>{
  const row=(icon,link,control)=>`<div class="company-notification-row is-unread"><div class="company-notification-icon ${icon}"></div><a href="${link}"><div class="company-notification-title">Update</div><div class="company-notification-body">Assigned work</div><div class="company-notification-meta">Pending</div></a><input type="checkbox" class="company-notification-check" ${control}></div>`;
  const b=browser('',base+'dashboard-gym',chrome.replace('</header>',`<div class="company-notifications-menu">${row('is-task','/task-operations/view?id=7','data-task-id="7"')}${row('','/task-operations/view?id=8','')}${row('','/group-notifications/view?id=9','')}</div></header>`));
  const rows=b.document().header.notifications.rows;
  assert.equal(rows[0].type,'task');assert.equal(rows[1].type,'task');assert.equal(rows[2].type,'notification');
  assert.equal(rows[0].read,false);assert.ok(rows[0].control);assert.equal(new URL(rows[0].url).pathname,'/task-operations/view');
  b.run('change',{id:rows[0].control,value:true});
  assert.equal(b.w.document.querySelector('[data-task-id="7"]').checked,true);
});
test('class invitations retain a distinct notification type across the native header bridge',()=>{
 const markup='<div class="company-notifications-menu"><div class="company-notification-row" data-notification-type="class-invitation"><div class="company-notification-icon is-invitation"></div><a href="/group-notifications/view?id=10"><span class="company-notification-title">Class invitation</span></a></div></div>';
 const b=browser('',base+'dashboard-gym',chrome.replace('</header>',markup+'</header>'));
 assert.equal(b.document().header.notifications.rows[0].type,'class-invitation');b.dom.window.close();
});
test('notification refresh updates assigned tasks without replacing the current page or running response scripts',async()=>{
 const prefix=chrome.replace('</header>','<button id="page-header-notifications-dropdown"><span class="badge">0</span></button><div class="company-notifications-menu"><div class="company-notifications-list"></div></div></header>');
 const b=browser('<form><input name="notes" value="Unsaved notes"></form>',base+'company',prefix);let options;
 b.w.fetch=async(url,opts)=>{assert.equal(url,base+'group-notifications/dropdown');options=opts;return {ok:true,url,status:200,text:async()=>'<button id="page-header-notifications-dropdown"><span class="badge">1</span></button><div class="company-notifications-menu"><div class="company-notifications-list"><div class="company-notification-row"><div class="company-notification-icon is-task"></div><a href="/task-operations/view?id=44"><span class="company-notification-title">Assigned task</span></a><input type="checkbox" class="company-notification-check" data-task-id="44"></div></div><script>window.untrustedTaskScriptRan=true</script></div>'};};
 b.run('notifications');await new Promise(setImmediate);await new Promise(setImmediate);
 assert.equal(options.cache,'no-store');assert.equal(options.credentials,'same-origin');
 assert.equal(b.document().header.notifications.rows[0].title,'Assigned task');assert.equal(b.document().header.notifications.rows[0].type,'task');
 assert.equal(b.w.document.querySelector('input[name=notes]').value,'Unsaved notes');assert.equal(b.w.untrustedTaskScriptRan,undefined);b.dom.window.close();
});
test('native frame exports only permitted same-company navigation and keeps POST logout as an opaque action',()=>{
  const b=browser('<div class="clients-index"></div>');const doc=b.document();
  assert.equal(doc.active,true);assert.equal(doc.language,'pt');assert.equal(doc.footer.length,4);
  assert.ok(doc.menu.some(link=>link.label==='Reports'));assert.ok(!doc.menu.some(link=>['Logout','Foreign','Forbidden'].includes(link.label)));
  assert.equal(doc.accountActions[0].label,'Logout');assert.ok(!JSON.stringify(doc).includes('private-csrf'));
  b.run('frame',{enabled:true});assert.ok(b.w.document.documentElement.classList.contains('__scNativeAdminFrame'));
  b.run('frame',{enabled:false});assert.ok(!b.w.document.documentElement.classList.contains('__scNativeAdminFrame'));b.dom.window.close();
});
test('web header and footer stay hidden even when optional summary styling fails',()=>{
 const b=browser('<div class="gym-app-layout"><div class="challenge-stat-card">Total</div></div>');
 b.w.GymSummaryCards={enhance:()=>{throw Error('Optional layout failed');}};
 assert.doesNotThrow(()=>b.run('frame',{enabled:true}));
 assert.equal(b.w.getComputedStyle(b.w.document.getElementById('page-topbar')).display,'none');
 assert.equal(b.w.getComputedStyle(b.w.document.querySelector('.mobile-bottom-nav')).display,'none');
 assert.ok(b.messages.some(message=>message.event==='layout-error'));
 b.run('frame',{enabled:false});
 assert.notEqual(b.w.getComputedStyle(b.w.document.getElementById('page-topbar')).display,'none');
 b.dom.window.close();
});

test('received notifications and birthdays stay in header sheets and never become menu items',()=>{
  const top=chrome.replace('<a href="/profile">Profile</a>',`<a href="/profile">Profile</a>
    <button><i class="bx-bell"></i><span class="badge">2</span></button>
    <div class="company-notifications-menu"><div class="company-notification-row is-unread">
      <a href="/dashboard-gym"><span class="company-notification-title">Notification for everyone</span><span class="company-notification-body">Inbox message</span></a>
      <input class="company-notification-check" type="checkbox"></div></div>
    <div class="dropdown"><button><i class="bx-gift"></i></button><div><a class="notification-item" href="/clients-list/view?id=7"><h6>Birthday member</h6><p>Today</p></a></div></div>`);
  const b=browser('<div class="clients-index"></div>',base+'clients-list',top),doc=b.document();
  assert.equal(doc.header.notifications.count,2);assert.equal(doc.header.notifications.rows[0].title,'Notification for everyone');
  assert.equal(doc.header.notifications.rows[0].url,base+'dashboard-gym');assert.ok(doc.header.notifications.rows[0].control);
  assert.equal(doc.header.birthdays.rows[0].title,'Birthday member');
  assert.ok(!doc.menu.some(item=>/Notification for everyone|Inbox message|Birthday member/.test(item.label)));
  assert.ok(doc.menu.some(item=>item.label==='Profile'));assert.ok(doc.menu.some(item=>item.label==='Reports'));
  assert.ok(doc.footer.some(item=>item.label==='Dashboard'&&item.url===base+'dashboard-gym'));
  assert.equal(doc.accountActions[0].label,'Logout');b.dom.window.close();
});

test('the native menu exposes the company name and invokes the existing POST logout form',()=>{
  const top=chrome.replace('<a href="/site/logout" data-method="post">Logout</a>',`
    <div class="company-notifications-menu"><p class="company-notifications-company">FTX</p></div>
    <form action="/site/logout" method="post"><input type="hidden" name="_csrf" value="private-csrf"><button type="submit">Log out</button></form>
    <form action="/site/logout-mobile" method="post"><button type="submit">Log out mobile</button></form>
    <form action="https://other.example/site/logout" method="post"><button type="submit">Foreign</button></form>`);
  const b=browser('<div class="clients-index"></div>',base+'clients-list',top),doc=b.document();
  assert.equal(doc.header.company,'FTX');assert.equal(doc.accountActions.length,1);
  assert.equal(doc.accountActions[0].kind,'logout');assert.ok(!JSON.stringify(doc).includes('private-csrf'));
  let submissions=0;b.w.document.querySelector('form').addEventListener('submit',event=>{event.preventDefault();submissions++;});
  b.run('invoke',{id:doc.accountActions[0].id});assert.equal(submissions,1);
  assert.ok(!doc.menu.some(item=>/logout/.test(item.url)));b.dom.window.close();
});

test('native logout never uses a foreign or GET form',()=>{
  const top=chrome.replace('<a href="/site/logout" data-method="post">Logout</a>',`
    <form action="https://other.example/site/logout" method="post"><button type="submit">Foreign</button></form>
    <form action="/site/logout" method="get"><button type="submit">GET</button></form>`);
  const b=browser('',base+'clients-list',top);assert.equal(b.document().accountActions.length,0);b.dom.window.close();
});

test('sidebar categories, nested subcategories and their permitted routes retain their hierarchy',()=>{
  const sidebar=`<aside class="vertical-menu"><nav id="sidebar-menu"><ul id="side-menu">
    <li><a href="/dashboard-gym"><span>Dashboard</span></a></li>
    <li><a class="has-arrow"><span>Members</span></a><ul class="sub-menu">
      <li><a href="/clients-list"><span>List</span></a></li>
      <li><a href="/memberships"><span>Memberships</span></a></li>
      <li><a href="#"><span>Records</span></a><ul><li><a href="/gym-attendance">Attendance</a></li><li><a href="/waivers">Waivers</a></li></ul></li>
      <li data-permission-blocked="1"><a href="/forbidden">Forbidden</a><ul><li><a href="/private">Private child</a></li></ul></li>
      <li><a href="https://other.example/admin">Foreign</a></li>
      <li><a href="/clients-list/delete?id=4" data-method="post">Delete</a></li>
    </ul></li>
    <li><a href="#">Empty category</a><ul></ul></li>
    <li class="menu-title">Administration</li>
    <li><a href="/company-settings">Settings</a></li>
  </ul></nav></aside>`;
  const prefix=chrome.replace(/<aside[\s\S]*?<\/aside>/,sidebar);
  const b=browser('<div class="clients-index"></div>',base+'clients-list',prefix),tree=b.document().menuTree;
  const members=tree.find(item=>item.label==='Members');assert.equal(members.url,null);
  assert.deepEqual(Array.from(members.children,item=>item.label),['List','Memberships','Records']);
  assert.deepEqual(Array.from(members.children[2].children,item=>item.label),['Attendance','Waivers']);
  assert.equal(members.children[1].url,base+'memberships');
  assert.ok(tree.some(item=>item.label==='Profile'));assert.ok(tree.some(item=>item.label==='Administration'&&item.url===null));
  assert.ok(!JSON.stringify(tree).match(/Forbidden|Private child|Foreign|Delete|Empty category/));
  assert.equal(tree.filter(item=>item.url===base+'dashboard-gym').length,1);b.dom.window.close();
});

test('the full gym configuration survives native sidebar extraction without dropping categories or routes',()=>{
  const fixture=require('./fixtures/admin-menu-preview.json');
  const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  const markup=items=>'<ul>'+items.map(item=>'<li><a'+(item.url?' href="'+escape(item.url)+'"':' class="has-arrow"')+'><span>'+escape(item.label)+'</span></a>'+markup(item.children)+'</li>').join('')+'</ul>';
  const prefix=chrome.replace(/<aside[\s\S]*?<\/aside>/,'<aside class="vertical-menu">'+markup(fixture.items)+'</aside>');
  const b=browser('<div class="clients-index"></div>',base+'clients-list',prefix),tree=b.document().menuTree;
  assert.deepEqual(Array.from(tree.slice(0,fixture.items.length),item=>item.label),fixture.items.map(item=>item.label));
  const flatten=items=>items.flatMap(item=>[...(item.url?[new URL(item.url,base).href]:[]),...flatten(item.children)]);
  assert.deepEqual(Array.from(flatten(tree.slice(0,fixture.items.length))),flatten(fixture.items));
  assert.equal(fixture.items.length,10);assert.equal(tree.find(item=>item.label==='Classes').children.length,6);
  assert.equal(tree.find(item=>item.label==='Settings').children.length,5);b.dom.window.close();
});

test('each main gym category has a distinct icon in the bundled icon font',()=>{
  const fixture=require('./fixtures/admin-menu-preview.json'),theme=require('../src/assets/gym-ui-theme.json');
  const resolve=items=>items.map(item=>({...item,url:item.url?new URL(item.url,base).href:null,children:resolve(item.children)}));
  const icons=resolve(fixture.items).map(navigation.menuCategoryIcon);
  assert.deepEqual(icons,['home','members','bell','bookings','team','progress','events','reports','health','settings']);
  assert.equal(new Set(icons).size,fixture.items.length);
  for(const name of [...icons,'editor','refresh','company'])assert.match(theme.icons[name],/^[a-f0-9]{4}$/);
});

test('header identity reads the signed-in name and visible level without reading other members',()=>{
  const prefix=chrome.replace('<header id="page-topbar">','<header id="page-topbar"><button id="page-header-user-dropdown"><span><i></i> Signed In Person </span></button>')
    .replace('<aside class="vertical-menu">','<aside class="vertical-menu"><div class="text-2"><span>Nível :</span><span>Administrador</span></div>');
  const b=browser('<div class="client-name" data-user-level="client">Another Member</div>',base+'clients-list',prefix),user=b.document().header.user;
  assert.equal(user.name,'Signed In Person');assert.equal(user.level,'Administrador');
  assert.equal(navigation.userLevelLabel(user.level),'Admin');
  assert.equal(navigation.userLevelLabel('Coach'),'Team');assert.equal(navigation.userLevelLabel(''),'');
  b.dom.window.close();
});

test('company status blocks are omitted from navigation while the real Plan link and user level remain',()=>{
  for(const labels of [['Company','Level','Plan','Due date'],['Empresa','Nível','Plano','Vencimento']]){
    const summary='<li><a href="/my-plan">'+labels.map((label,i)=>'<div class="text-2"><span>'+label+' :</span><span>'+['FTX','Administrator','Gym','2027-11-27'][i]+'</span></div>').join('')+'</a></li>';
    const sidebar='<aside class="vertical-menu"><ul>'+summary+'<li><a href="/dashboard-gym"><span>Dashboard</span></a></li><li><a>Settings</a><ul><li><a href="/my-plan">Plan</a></li></ul></li></ul></aside>';
    const prefix=chrome.replace(/<aside[\s\S]*?<\/aside>/,sidebar);
    const b=browser('',base+'clients-list',prefix),doc=b.document();
    assert.ok(!doc.menu.some(item=>item.label.includes('2027-11-27')));
    assert.ok(!JSON.stringify(doc.menuTree).includes('2027-11-27'));
    assert.equal(doc.menuTree.find(item=>item.label==='Settings').children[0].label,'Plan');
    assert.equal(doc.menuTree.find(item=>item.label==='Settings').children[0].url,base+'my-plan');
    assert.equal(doc.header.user.level,'Administrator');b.dom.window.close();
  }
});

test('birthday snapshots preserve server-confirmed today and current-user flags',()=>{
  const prefix=chrome.replace('<header id="page-topbar">','<header id="page-topbar"><div class="dropdown"><button><i class="bx-gift"></i></button><a class="notification-item" href="#" data-birthday-today="1" data-birthday-self="1"><h6>Me</h6><p>30/10</p></a></div>');
  const b=browser('',base+'clients-list',prefix),row=b.document().header.birthdays.rows[0];
  assert.equal(row.today,true);assert.equal(row.isSelf,true);assert.equal(row.url,null);b.dom.window.close();
});

test('client and public documents never acquire the native admin frame',()=>{
  for(const prefix of ['',chrome.replace('/dashboard-gym','/dashboard-gym-client')]){
    const b=browser('<div class="clients-index"></div>',base+'dashboard-gym-client',prefix);
    assert.equal(b.document().active,false);b.dom.window.close();
  }
});
test('client cards, filters and pagination become native DTOs without executable HTML',()=>{
  const b=browser(`<div class="clients-index"><div class="clients-search"><form method="post" action="/clients-list"><input type="hidden" name="_csrf" value="private-csrf">
    <label for="name">Name</label><input id="name" name="UserSearch[full_name]" value="Test"><select name="UserSearch[vip]"><option value="1">VIP</option></select></form></div>
    <div class="client-card-modern"><div class="client-card-summary"><div class="client-name">Test member</div><div>Contact</div></div><span class="badge">Active</span>
    <a href="/clients-list/view?id=4" title="View"></a><a href="/clients-list/delete?id=4" data-method="post">Delete</a></div></div><ul class="pagination"><li><a href="/clients-list?page=2">2</a></li></ul>`);
  const page=b.document().page;assert.equal(page.kind,'clients');assert.equal(page.rows[0].title,'Test member');assert.equal(page.rows[0].links.length,1);
  assert.equal(page.filters[0].name,'UserSearch[full_name]');assert.equal(page.filters[0].label,'Name');assert.equal(page.filters.length,2);
  assert.equal(page.pagination[0].url,base+'clients-list?page=2');assert.ok(!JSON.stringify(page).includes('private-csrf'));b.dom.window.close();
});
test('empty class catalog stays native and preserves create controls',()=>{
  const b=browser('<div class="gym-crud-page"><header class="gym-menu-page-header"><a href="/gym-classes/create">Create</a></header></div>',base+'gym-classes');
  assert.equal(b.document().page.kind,'catalog');assert.equal(b.document().page.links[0].label,'Create');b.dom.window.close();
});
test('native form updates only rendered editable controls and submits the original form with hidden state intact',()=>{
  const b=browser(`<form method="post"><input type="hidden" name="_csrf" value="private-csrf"><label for="title">Title</label><input id="title" name="Membership[title]" required value="Old">
    <input type="hidden" name="company_code" value="company-original"><input name="id" value="4" readonly><input type="checkbox" name="active" checked><button type="submit">Save</button></form>`,base+'memberships/update?id=4');
  const page=b.document().page;assert.equal(page.kind,'form');assert.equal(page.form.fields.length,3);
  const title=page.form.fields[0],readonly=page.form.fields[1],checkbox=page.form.fields[2];
  let submitted=0;b.w.document.querySelector('form').requestSubmit=()=>submitted++;
  b.run('submit',{id:page.form.id,values:{[title.id]:'New title',[readonly.id]:'hacked',[checkbox.id]:false,'unknown':'no'}});
  assert.equal(submitted,1);assert.equal(b.w.document.querySelector('#title').value,'New title');
  assert.equal(b.w.document.querySelector('[name=id]').value,'4');assert.equal(b.w.document.querySelector('[name=active]').checked,false);
  assert.equal(b.w.document.querySelector('[name=company_code]').value,'company-original');assert.ok(!JSON.stringify(page).includes('private-csrf'));
  b.run('install');b.run('submit',{id:page.form.id,values:{[title.id]:'stale'}});assert.equal(submitted,1);b.dom.window.close();
});
test('upload and dynamic editors stay in their original web editor',()=>{
  for(const html of ['<input type="file" name="photo">','<select class="select2-hidden-accessible" name="client"><option>Member</option></select>','<div class="dynamicform_wrapper"><input name="schedule"></div>']){
    const b=browser('<form method="post">'+html+'<button type="submit">Save</button></form>',base+'gym-classes/create');
    assert.equal(b.document().page.kind,'web');b.dom.window.close();
  }
});
test('native QR rebuilds only this company member route and rejects foreign or ambiguous codes',()=>{
  const config={companyCode:'company-a',origins:[new URL(base).origin,'https://specialcalendar.com']};
  assert.equal(core.adminMemberTarget('https://specialcalendar.com/clients-list/view/14?company_code=company-a',config,base),base+'clients-list/view?id=14&company_code=company-a');
  assert.ok(core.adminMemberTarget('http://localhost/clients-list/view/14',config,base));
  for(const value of ['https://evil.example/clients-list/view/14',base+'clients-list/view?id=14&id=15',base+'clients-list/view/14?id=15',base+'clients-list/view?id=14&company_code=other',base+'site/logout?id=14','javascript:alert(1)',base+'clients-list/view?id=9999999999'])assert.equal(core.adminMemberTarget(value,config,base),null,value);
});
test('read bridge accepts only read-only company list routes and never follows authentication redirects as list data',async()=>{
  assert.throws(()=>core.adminPageScript(base,'read',{url:base+'clients-list/delete?id=4'}));
  assert.throws(()=>core.adminPageScript(base,'read',{url:'https://other.example/clients-list'}));
  assert.throws(()=>core.adminPageScript(base,'read',{url:base+'clients-list?r=site/logout'}));
  const b=browser('<div class="clients-index"></div>');let options;
  b.w.fetch=async(url,opts)=>{options=opts;return {url:base+'login',ok:true,status:200,text:async()=>''};};
  b.run('read',{url:base+'clients-list',id:'read-1'});await new Promise(setImmediate);
  assert.equal(options.credentials,'same-origin');assert.equal(b.messages.at(-1).status,401);b.dom.window.close();
});
test('Portuguese and English native frame labels are complete',()=>{
  assert.deepEqual(Object.keys(core.adminPageLabels('pt')).sort(),Object.keys(core.adminPageLabels('en')).sort());
});

function hook(){
  const slots=[],scripts=[],timers=new Map(),navigations=[],effects=[];let cursor=0,timer=0;
  const react={useState(value){const i=cursor++;if(!(i in slots))slots[i]=value;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},
    useRef(value){const i=cursor++;if(!(i in slots))slots[i]={current:value};return slots[i];},
    useCallback(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((value,n)=>value!==old.deps[n]))slots[i]={fn,deps};return slots[i].fn;},
    useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((value,n)=>value!==old.deps[n]))effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});}};
  const ref={current:{injectJavaScript:value=>scripts.push(value),reload:()=>navigations.push('reload')}};
  const {default:usePages}=load('useNativeAdminPages.js',{react,'react-native':{AppState:{addEventListener:()=>({remove(){}})}},'./nativeGymCore':gym,'./nativeAdminPages':core,'./nativeAdminNavigation':navigation},
    {setTimeout:fn=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id)});
  const forcedNavigations=[];
  const navigate=(url,options)=>{navigations.push(url);if(options?.reload===true)forcedNavigations.push(url);};
  const render=()=>{cursor=0;const state=usePages(ref,base,navigate);while(effects.length)effects.shift()();return state;};
  const dashboard={url:base+'dashboard-gym',title:'Dashboard',kind:'dashboard',rows:[]};
  const send=(message,url=dashboard.url)=>{
    const documentId=JSON.parse(render().injectedScript.match(/\}\)\((\{.*\})\);true;$/s)[1]).documentId;
    return render().onMessage({url,data:JSON.stringify({type:core.ADMIN_PAGES_MESSAGE,documentId,
      documentUrl:message.event==='document'&&message.page?message.page.url:url,...message})});
  };
  render().onNavigation(dashboard.url);send({event:'document',active:true,page:dashboard,footer:[],menu:[]});
  const id=()=>JSON.parse(scripts.at(-1).match(/\}\)\((\{.*\})\);true;$/s)[1]).id;
  return {render,send,id,scripts,timers,navigations,forcedNavigations,dashboard,ref,unmount:()=>slots.forEach(slot=>slot?.cleanup?.())};
}

test('scanning from a native tab always opens check-in and scanning the same member there reloads the confirmation',()=>{
 const h=hook(),target=base+'gym-checkin/index?member_id=1619';
 const clients={url:base+'clients-list',title:'Clients',kind:'clients',rows:[]};
 h.render().navigate(clients.url);h.send({event:'response',id:h.id(),status:200,page:clients});
 h.render().openWeb(target,{reload:true});assert.equal(h.navigations.at(-1),target);assert.equal(h.render().web,true);
 h.render().onNavigation(target);h.send({event:'document',active:true,page:{url:target,title:'Check-in',kind:'web'},footer:[],menu:[]},target);
 h.render().openWeb(target,{reload:true});assert.equal(h.navigations.at(-1),target);assert.equal(h.forcedNavigations.length,2);
 // The WebView follows View client details without React changing its source URI.
 const details=base+'clients-list/view?id=1619';h.render().onNavigation(details);
 h.send({event:'document',active:true,page:{url:details,title:'Client',kind:'web'},footer:[],menu:[]},details);
 h.render().openWeb(target,{reload:true});assert.equal(h.navigations.at(-1),target);assert.equal(h.forcedNavigations.length,3);
});
test('native tabs cache read-only list data and back restores the dashboard without reloading the web document',()=>{
  const h=hook(),clients={url:base+'clients-list',title:'Clients',kind:'clients',rows:[]};
  h.render().navigate(clients.url);assert.equal(h.render().busy,true);
  h.send({event:'response',id:h.id(),status:200,page:clients});assert.equal(h.render().page.kind,'clients');
  assert.equal(h.render().back(),true);assert.equal(h.render().page.kind,'dashboard');
  const count=h.scripts.length;h.render().navigate(clients.url);assert.equal(h.render().page.kind,'clients');
  assert.equal(h.scripts.length,count);assert.equal(h.navigations.length,0);assert.equal(h.timers.size,0);
});

test('idle preloading warms only server-supplied native lists and never changes the visible page',()=>{
 const h=hook(),clients={url:base+'clients-list',title:'Clients',kind:'clients',rows:[]};
 h.send({event:'document',active:true,page:h.dashboard,footer:[{url:clients.url},{url:base+'company/update'},{url:'https://foreign.example/memberships'}],menu:[]});
 h.render();const callback=Array.from(h.timers.values()).at(-1);assert.equal(typeof callback,'function');callback();
 const id=h.id();assert.match(id,/^warm:/);
 h.send({event:'response',id,status:200,page:clients});assert.equal(h.render().page.kind,'dashboard');
 const count=h.scripts.length;h.render().navigate(clients.url);assert.equal(h.render().page.kind,'clients');assert.equal(h.scripts.length,count);
});

test('a mutation discards preloaded lists and late background responses cannot restore them',()=>{
 const h=hook(),clients={url:base+'clients-list',title:'Clients',kind:'clients',rows:[]};
 h.send({event:'document',active:true,page:h.dashboard,footer:[{url:clients.url}],menu:[]});h.render();
 Array.from(h.timers.values()).at(-1)();const id=h.id();
 h.render().invoke('checkin');h.send({event:'response',id,status:200,page:clients});
 h.render().navigate(clients.url);assert.equal(h.render().busy,true);assert.equal(h.render().page.kind,'dashboard');assert.doesNotMatch(h.id(),/^warm:/);
});

test('advanced destinations open immediately without an Open editor landing screen or a second navigation',()=>{
 const h=hook(),url=base+'company/update?id=7';
 h.render().navigate(url);assert.equal(h.navigations.at(-1),url);
 h.render().onNavigation(url);
 const result=h.send({event:'document',active:true,page:{url,title:'Club settings',kind:'web',rows:[]},footer:[],menu:[]},url);
 assert.equal(result.documentRole,'admin');assert.equal(h.render().web,true);
 assert.equal(h.navigations.length,1,'The destination already loaded; showing it must not reload again');
 h.render().showNative();assert.equal(h.render().web,true,'An advanced page cannot return to an editor interstitial');
});
test('logout, permission errors and real navigations discard native admin data and in-flight requests',()=>{
  const h=hook();h.render().navigate(base+'clients-list');const oldId=h.id();
  h.render().onNavigation(base+'login');assert.equal(h.render().document,null);assert.equal(h.render().page,null);assert.equal(h.timers.size,0);
  h.send({event:'response',id:oldId,status:200,page:{url:base+'clients-list',title:'Private',kind:'clients',rows:[]}});
  assert.equal(h.render().page,null);
  h.send({event:'document',active:true,page:h.dashboard,footer:[],menu:[]});assert.equal(h.render().document,null);
  h.render().onNavigation(h.dashboard.url);
  h.send({event:'document',active:true,page:h.dashboard,footer:[],menu:[]});h.render().navigate(base+'memberships');
  h.send({event:'response',id:h.id(),status:403});assert.equal(h.render().document,null);assert.equal(h.render().page,null);
  assert.equal(h.navigations.at(-1),base+'memberships');assert.ok(h.scripts.at(-1).includes('"enabled":false'));
});
test('native scroll position survives check-in document reloads and clears at logout',()=>{
  const h=hook();h.render().rememberScroll(h.dashboard.url,620);
  h.render().onNavigation(h.dashboard.url);assert.equal(h.render().scrollOffset(h.dashboard.url),620);
  h.render().onNavigation(base+'site/logout');assert.equal(h.render().scrollOffset(h.dashboard.url),0);
});
test('final redirect URL activates the native frame while departing-document snapshots remain rejected',()=>{
  const h=hook(),url=base+'memberships';
  h.render().onNavigation(base);h.render().onLoadEnd(url);
  h.send({event:'document',active:true,page:{url,title:'Memberships',kind:'memberships',rows:[]},footer:[],menu:[]},url);
  assert.equal(h.render().document.page.url,url);
  h.render().onNavigation(base+'site/logout');
  h.send({event:'document',active:true,page:{url,title:'Memberships',kind:'memberships',rows:[]},footer:[],menu:[]},url);
  assert.equal(h.render().document,null);
});
const headerHtml=`<header id="page-topbar">
  <select id="language" data-csrf="private-csrf"><option value="en">English</option><option value="pt">Português</option></select>
  <div class="dropdown"><button id="page-header-notifications-dropdown"><i class="bx bx-bell"></i><span class="badge">2</span></button>
    <div class="company-notifications-menu"><div class="company-notification-row is-unread">
      <a class="company-notification-content" href="/group-notifications/view?id=4"><div class="company-notification-title">Club news</div><div class="company-notification-body">Training update</div><div class="company-notification-meta">Today · Unread</div></a>
      <input type="checkbox" class="company-notification-check" data-url="/group-notifications/mark-read?id=4"></div></div></div>
  <div class="dropdown"><button onclick="window.open('${base}form-signup?pagecode=company-a', '_blank')"><i class="bx bx-share-alt"></i></button></div>
  <div class="dropdown"><button id="page-header-notifications-dropdown"><i class="bx bx-gift"></i></button><div class="dropdown-menu">
    <a class="notification-item" href="/clients-list/view?id=8"><h6>Birthday member</h6><p>Birthday</p><p>01/11/2000</p></a></div></div>
</header>`;
function headerBrowser(){return browser('<div class="memberships-page"></div>',base+'memberships',headerHtml+chrome.slice(chrome.indexOf('<aside')));}
test('actual admin header structure with duplicate bell/gift IDs exports each native feature separately',()=>{
  const b=headerBrowser(),header=b.document().header;
  assert.equal(header.language.options.length,2);assert.equal(header.language.value,'en');
  assert.equal(header.notifications.count,2);assert.equal(header.notifications.rows[0].title,'Club news');
  assert.equal(header.notifications.rows[0].url,base+'group-notifications/view?id=4');
  assert.equal(header.birthdays.rows[0].title,'Birthday member');assert.equal(header.birthdays.rows[0].url,base+'clients-list/view?id=8');
  assert.equal(header.share.url,base+'form-signup?pagecode=company-a');
  assert.ok(!JSON.stringify(b.document()).includes('private-csrf'));b.dom.window.close();
});
test('native language and notification switches invoke existing handlers, validate values and ignore stale controls',()=>{
  const b=headerBrowser(),header=b.document().header;let languageChanges=0,readChanges=0;
  b.w.document.querySelector('#language').addEventListener('change',()=>languageChanges++);
  b.w.document.querySelector('.company-notification-check').addEventListener('change',()=>readChanges++);
  b.run('change',{id:header.language.id,value:'foreign-value'});assert.equal(languageChanges,0);
  b.run('change',{id:header.language.id,value:'pt'});assert.equal(languageChanges,1);assert.equal(b.w.document.querySelector('#language').value,'pt');
  b.run('change',{id:header.notifications.rows[0].control,value:true});assert.equal(readChanges,1);assert.equal(b.w.document.querySelector('.company-notification-check').checked,true);
  b.run('install');b.run('change',{id:header.language.id,value:'en'});assert.equal(languageChanges,1);b.dom.window.close();
});
test('late notification AJAX updates refresh native read state and restore its disabled control',async()=>{
  const b=headerBrowser(),timers=[];b.w.setTimeout=fn=>{timers.push(fn);return timers.length;};
  const toggle=b.w.document.querySelector('.company-notification-check'),row=toggle.closest('.company-notification-row');
  toggle.disabled=true;await new Promise(setImmediate);while(timers.length)timers.shift()();
  assert.equal(b.document().header.notifications.rows[0].disabled,true);
  toggle.checked=true;toggle.disabled=false;row.classList.remove('is-unread');await new Promise(setImmediate);while(timers.length)timers.shift()();
  assert.equal(b.document().header.notifications.rows[0].disabled,false);assert.equal(b.document().header.notifications.rows[0].read,true);
  b.dom.window.close();
});
test('native share rejects foreign and non-signup onclick destinations',()=>{
  for(const target of ['https://foreign.example/form-signup',base+'site/logout']){
    const b=browser('<div class="memberships-page"></div>',base+'memberships',headerHtml.replace(base+'form-signup?pagecode=company-a',target)+chrome.slice(chrome.indexOf('<aside')));
    assert.equal(b.document().header.share,null);b.dom.window.close();
  }
});
test('admin navigation owns a native loading/error screen instead of falling back to the website',()=>{
  const h=hook();h.render().onNavigation(base+'memberships');assert.equal(h.render().startup,'loading');
  h.send({event:'document',active:false},base+'memberships');assert.equal(h.render().startup,'failed');assert.equal(h.render().document,null);
  h.render().onNavigation(base+'login');assert.equal(h.render().startup,'idle');assert.equal(h.render().isAdminRoute(base+'login'),false);
  h.render().onNavigation(base+'dashboard-gym-client');assert.equal(h.render().startup,'idle');
});

test('an incomplete Team document waits for its header before publishing startup failure',()=>{
 const b=browser('',base+'dashboard-gym','');b.messages.length=0;
 Object.defineProperty(b.w.document,'readyState',{configurable:true,get:()=> 'loading'});
 b.run('install');assert.equal(b.messages.filter(row=>row.event==='document').length,0);
 b.w.document.body.insertAdjacentHTML('afterbegin','<header id="page-topbar" data-user-level="team"><button id="page-header-user-dropdown">Coach</button></header>');
 Object.defineProperty(b.w.document,'readyState',{configurable:true,get:()=> 'interactive'});
 b.w.document.dispatchEvent(new b.w.Event('DOMContentLoaded'));
 assert.equal(b.document().active,true);assert.equal(b.document().header.user.level,'team');b.dom.window.close();
});

test('startup failure reports a versioned non-sensitive reason without loosening access',()=>{
 const b=browser('',base+'dashboard-gym','');const message=b.document();
 assert.equal(message.active,false);assert.equal(message.reason,'HEADER_MISSING');assert.equal(message.bridgeVersion,2);
 const h=hook();h.render().onNavigation(base+'dashboard-gym');h.send({event:'document',active:false,reason:'HEADER_MISSING'});
 assert.equal(h.render().startup,'failed');assert.equal(h.render().diagnostic,'ADMIN_DOCUMENT_UNAVAILABLE_V2_HEADER_MISSING');
 assert.ok(!JSON.stringify(message).includes('private-csrf'));h.unmount();b.dom.window.close();
});
test('confirmed administrator keeps native ownership on other permitted tools, until logout clears it',()=>{
  const h=hook();assert.equal(h.render().isAdminRoute(base+'gym-attendance'),true);
  h.render().onNavigation(base+'gym-attendance');assert.equal(h.render().startup,'loading');
  h.render().onNavigation(base+'site/logout');assert.equal(h.render().isAdminRoute(base+'gym-attendance'),false);
});
test('notification snapshots preserve the selected native tab and its in-flight list request',()=>{
  const h=hook();h.render().navigate(base+'clients-list');const request=h.id();
  h.send({event:'document',active:true,page:h.dashboard,footer:[],menu:[],header:{notifications:{count:0,rows:[]}}});
  assert.equal(h.render().busy,true);
  h.send({event:'response',id:request,status:200,page:{url:base+'clients-list',title:'Clients',kind:'clients',rows:[]}});
  assert.equal(h.render().page.kind,'clients');
  h.send({event:'document',active:true,page:h.dashboard,footer:[],menu:[],header:{notifications:{count:1,rows:[]}}});
  assert.equal(h.render().page.kind,'clients');assert.equal(h.render().document.header.notifications.count,1);
});
test('native retry reloads a failed server document instead of re-parsing the same error page',()=>{
  const h=hook();h.render().onNavigation(base+'memberships');h.send({event:'document',active:false},base+'memberships');
  h.render().retry();assert.equal(h.navigations.at(-1),'reload');assert.equal(h.render().startup,'loading');
});
test('the permitted workout timer opens natively and Back restores the previous page without fetching HTML',()=>{
  const h=hook(),url=base+'workout-timer';
  h.send({event:'document',active:true,page:h.dashboard,footer:[],menu:[{label:'Workout timer',url}],menuTree:[{label:'Health tools',children:[{label:'Workout timer',url,children:[]}]}]});
  const before=h.scripts.length;h.render().navigate(url);
  assert.equal(h.render().localScreen,'timer');assert.equal(h.render().web,false);assert.equal(h.scripts.length,before);
  assert.equal(h.render().back(),true);assert.equal(h.render().localScreen,null);assert.equal(h.render().page.url,h.dashboard.url);
  h.render().navigate(url);const session=h.render().sessionVersion;
  h.render().onNavigation(base+'site/logout');assert.equal(h.render().localScreen,null);assert.ok(h.render().sessionVersion>session);
});

test('an account without a rendered timer link cannot open the admin timer',()=>{
  const h=hook();h.render().navigate(base+'workout-timer');assert.equal(h.render().localScreen,null);
});

test('Android WebMessageListener origin-only events initialize the native admin screen',()=>{
  const h=hook(),url=base+'memberships';h.render().onNavigation(url);h.render().onLoadEnd(url);
  const accepted=h.send({event:'document',active:true,page:{url,title:'Memberships',kind:'memberships',rows:[]},footer:[],menu:[]},new URL(base).origin);
  assert.equal(h.render().startup,'active');assert.equal(h.render().page?.kind,'memberships');
  assert.equal(accepted.documentRole,'admin');assert.equal(accepted.documentUrl,url);
});
test('origin-only messages cannot restore a previous document after signing out and returning to the same URL',()=>{
  const h=hook(),oldId=JSON.parse(h.render().injectedScript.match(/\}\)\((\{.*\})\);true;$/s)[1]).documentId;
  h.render().onNavigation(base+'site/logout');h.render().onNavigation(h.dashboard.url);h.render().onLoadEnd(h.dashboard.url);
  h.send({event:'document',active:true,documentId:oldId,documentUrl:h.dashboard.url,page:h.dashboard,footer:[],menu:[]},new URL(base).origin);
  assert.equal(h.render().document,null);assert.equal(h.render().startup,'loading');
  h.send({event:'document',active:true,documentUrl:h.dashboard.url,page:h.dashboard,footer:[],menu:[]},new URL(base).origin);
  assert.equal(h.render().startup,'active');
});
test('Android origin-only snapshot errors surface a useful reference instead of being discarded',()=>{
  const h=hook();h.render().onNavigation(h.dashboard.url);h.render().onLoadEnd(h.dashboard.url);
  h.send({event:'error',documentUrl:h.dashboard.url,code:'snapshot_failed'},new URL(base).origin);
  assert.equal(h.render().startup,'failed');assert.equal(h.render().diagnostic,'ADMIN_SNAPSHOT_FAILED');
});
test('current-document query/hash changes are accepted; other company origins and document paths are rejected',()=>{
  const h=hook(),uri=h.dashboard.url+'?date=2026-10-30#classes';
  h.send({event:'document',active:true,page:{...h.dashboard,url:uri},footer:[],menu:[]},new URL(base).origin);
  assert.equal(h.render().page.url,uri);
  h.send({event:'document',active:true,page:{...h.dashboard,url:base+'memberships'},footer:[],menu:[]},new URL(base).origin);
  assert.equal(h.render().page.url,uri);
  h.send({event:'document',active:true,page:h.dashboard,footer:[],menu:[]},'https://c20261027151705426.specialcalendar.com');
  assert.equal(h.render().page.url,uri);
});
test('validated client documents retain their full URL for native client initialization on Android',()=>{
  const h=hook(),url=base+'dashboard-gym-client';h.render().onNavigation(url);h.render().onLoadEnd(url);
  const accepted=h.send({event:'document',active:false,client:true,documentUrl:url},new URL(base).origin);
  assert.equal(accepted.documentRole,'client');assert.equal(accepted.documentUrl,url);assert.equal(h.render().startup,'idle');
});
test('a stale admin event never authorizes the outer shell to clear a new client session',()=>{
  const h=hook(),oldId=JSON.parse(h.render().injectedScript.match(/\}\)\((\{.*\})\);true;$/s)[1]).documentId;
  h.render().onNavigation(base+'dashboard-gym-client');h.render().onLoadEnd(base+'dashboard-gym-client');
  const stale=h.send({event:'document',active:true,documentId:oldId,documentUrl:h.dashboard.url,page:h.dashboard,footer:[],menu:[]},new URL(base).origin);
  assert.equal(stale,true);assert.equal(stale.documentRole,undefined);assert.equal(h.render().document,null);
});
test('the complete injected-document handshake activates native administration with Android origin-only transport',()=>{
  const h=hook(),url=base+'memberships';
  const b=browser('<div class="memberships-page"><h1>Memberships</h1><article class="membership-toggle-card"><span class="membership-toggle-title">Test member</span><span class="membership-toggle-meta">Monthly</span></article></div>',url);
  b.w.ReactNativeWebView.postMessage=data=>h.render().onMessage({url:new URL(base).origin,data});
  h.ref.current.injectJavaScript=script=>b.w.eval(script);
  h.render().onNavigation(url);h.render().onLoadEnd(url);
  assert.equal(h.render().startup,'active');assert.equal(h.render().page.kind,'memberships');
  assert.equal(h.render().page.rows[0].title,'Test member');assert.equal(h.render().diagnostic,'');
  assert.ok(b.w.document.documentElement.classList.contains('__scNativeAdminFrame'));
  assert.ok(h.timers.size<=1,'Only idle preloading may remain after the document is ready');
  h.unmount();assert.equal(h.timers.size,0);b.dom.window.close();
});

const gymDefinition=require('./fixtures/gym-all.json');
const gymMenuMarkup=items=>'<ul>'+items.map(item=>'<li><a'+(item.url==='null'?'':' href="'+new URL(item.url,base).pathname+'"')+'><span>'+item.title+'</span></a>'+gymMenuMarkup(item.submenu||[])+'</li>').join('')+'</ul>';
const genericFooter='<div class="mobile-bottom-nav"><a href="/dashboard">Messages</a><div id="fabBtn">Menu</div><a href="/profile">Time clock</a></div>';
const signedHeader='<header id="page-topbar" data-fitness-account="'+'a'.repeat(64)+'"><button id="page-header-user-dropdown" data-user-level="admin"><span>Admin</span></button></header>';

test('Team footer fills all four permitted categories including alternatives to admin tabs',()=>{
 const prefix=signedHeader.replace('data-user-level="admin"','data-user-level="team"')+
  '<aside class="vertical-menu"><a href="/dashboard-gym">Dashboard</a><a href="/clients-list">Clients</a><a href="/gym-attendance">Attendance</a><a href="/waivers">Waivers</a><a href="/memberships" data-permission-blocked="1">Denied memberships</a><a href="/company/update">Edit company</a></aside>'+genericFooter;
 const b=browser('',base+'dashboard-gym',prefix);
 assert.deepEqual(Array.from(b.document().footer,item=>new URL(item.url).pathname),['/dashboard-gym','/clients-list','/gym-attendance','/waivers']);
 b.dom.window.close();
});

test('Team primary footer uses all four admin-style destinations only when supplied as allowed links',()=>{
 const prefix=signedHeader.replace('data-user-level="admin"','data-user-level="team"')+chrome.slice(chrome.indexOf('<aside'));
 const b=browser('',base+'dashboard-gym',prefix);
 assert.deepEqual(Array.from(b.document().footer,item=>new URL(item.url).pathname),['/dashboard-gym','/clients-list','/gym-classes','/memberships']);b.dom.window.close();
});
test('every gym-all destination and FAQ keeps gym navigation when the server supplies a generic footer',()=>{
 const flatten=items=>items.flatMap(item=>[...(item.url!=='null'?[new URL(item.url,base).href]:[]),...flatten(item.submenu||[])]);
 const prefix=signedHeader+'<aside class="vertical-menu">'+gymMenuMarkup(gymDefinition['left-menu'])+'</aside>'+genericFooter;
 for(const url of [...flatten(gymDefinition['left-menu']),base+'faqs']){
  const b=browser('<h1>Feature</h1><button id="original-control">Original website control</button>',url,prefix),doc=b.document();
  assert.equal(doc.active,true,url);assert.deepEqual(Array.from(doc.footer,item=>new URL(item.url).pathname.replace(/\/$/,'')),['/dashboard-gym','/clients-list','/gym-classes','/memberships'],url);
  b.run('frame',{enabled:true});assert.equal(b.w.getComputedStyle(b.w.document.querySelector('.mobile-bottom-nav')).display,'none');
  assert.ok(b.w.document.querySelector('#original-control'));b.dom.window.close();
 }
});
test('restricted gym users receive only footer destinations present in their current permitted navigation',()=>{
 const prefix=signedHeader.replace('data-user-level="admin"','data-user-level="team"')+'<aside class="vertical-menu"><a href="/dashboard-gym">Home</a><div data-permission-blocked="1"><a href="/clients-list">Denied</a></div></aside>'+genericFooter;
 const b=browser('<h1>FAQ</h1>',base+'faqs',prefix);assert.equal(b.document().active,true);assert.deepEqual(Array.from(b.document().footer,item=>new URL(item.url).pathname),['/dashboard-gym']);b.dom.window.close();
});

test('Team startup accepts explicit server role without admin dashboard links or account hash',()=>{
 for(const role of ['team','equipa']){
  const prefix='<header id="page-topbar" data-user-level="'+role+'"><button id="page-header-user-dropdown"><span>Coach</span></button></header>'+
   '<aside class="vertical-menu"><a href="/gym-attendance">Attendance</a><a href="#" data-permission-blocked="1">Company settings</a></aside>'+genericFooter;
  const b=browser('<h1>Gym dashboard</h1>',base+'dashboard-gym',prefix),doc=b.document();
  assert.equal(doc.active,true);assert.equal(doc.header.user.level,role);
  assert.deepEqual(Array.from(doc.footer,item=>new URL(item.url).pathname),['/gym-attendance'],'Use the permitted category without inventing admin tabs');
  assert.ok(doc.menu.some(item=>item.url===base+'gym-attendance'));
  assert.ok(!doc.menu.some(item=>item.label==='Company settings'));b.dom.window.close();
 }
});

test('legacy translated Team sidebar identifies staff without the new header metadata',()=>{
 for(const label of ['Level:','Nível:']){
  const prefix='<header id="page-topbar"><button id="page-header-user-dropdown"><span>Coach</span></button></header>'+
   '<aside class="vertical-menu"><div class="text-2"><span>'+label+'</span><span>Team</span></div><a href="/gym-classes">Classes</a></aside>'+genericFooter;
  const b=browser('<h1>Dashboard</h1>',base+'dashboard-gym',prefix),doc=b.document();
  assert.equal(doc.active,true);assert.equal(doc.header.user.level,'Team');
  assert.deepEqual(Array.from(doc.footer,item=>new URL(item.url).pathname),['/gym-classes']);b.dom.window.close();
 }
});

test('a client navigation link cannot override an explicit Team role, but client pages remain client-owned',()=>{
 const prefix='<header id="page-topbar" data-user-level="team"><button id="page-header-user-dropdown">Coach</button></header>'+genericFooter+
  '<div class="mobile-bottom-nav"><a href="/dashboard-gym-client">My bookings</a></div>';
 const staff=browser('',base+'dashboard-gym',prefix);assert.equal(staff.document().active,true);staff.dom.window.close();
 const self=browser('',base+'dashboard-gym-client',prefix);assert.equal(self.document().active,false);assert.equal(self.document().client,true);self.dom.window.close();
 const guest=browser('',base+'dashboard-gym','<header id="page-topbar"></header>'+genericFooter);assert.equal(guest.document().active,false);guest.dom.window.close();
});
test('client and public pages cannot inherit admin footer from a generic header shell',()=>{
 const client=browser('',base+'faqs',signedHeader.replace('data-user-level="admin"','data-user-level="client"')+genericFooter);assert.equal(client.document().active,false);assert.equal(client.document().client,true);client.dom.window.close();
 const publicPage=browser('',base+'faqs','<header id="page-topbar"></header>'+genericFooter);assert.equal(publicPage.document().active,false);publicPage.dom.window.close();
 const login=browser('',base+'login',signedHeader+genericFooter);assert.equal(login.document().active,false);login.dom.window.close();
});
