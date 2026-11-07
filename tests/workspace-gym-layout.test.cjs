const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const server=fs.existsSync('C:/inetpub/wwwroot/workspace')?'C:/inetpub/wwwroot/workspace':path.join(__dirname,'../deployment/workspace-mobile-layout');
const script=fs.readFileSync(server+'/frontend/web/js/gym-mobile-layout.js','utf8');
function page(content){const dom=new JSDOM('<!doctype html><html lang="en"><body><main class="gym-app-layout">'+content+'</main></body></html>',{url:'https://club.example/memberships',runScripts:'outside-only'});dom.window.gymMobileLayoutLabels={search:'Search',filter:'Filter'};dom.window.eval(script);dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));return dom;}

test('workspace search/filter toolbar preserves original forms, field names, filters and submission handlers',()=>{
 const dom=page('<form id="search" method="get"><input type="hidden" name="company_code" value="club"><label>Name<input name="Search[q]" value="Alex"></label><select name="Search[active]"><option value="1" selected>Active</option></select><button type="submit">Apply</button></form>');
 const w=dom.window,d=w.document,form=d.querySelector('form'),original=form.querySelector('input[name="Search[q]"]');let submitted=0;
 form.addEventListener('submit',event=>{event.preventDefault();submitted++;});
 const toolbar=d.querySelector('.gym-app-filter-toolbar'),proxy=toolbar.querySelector('input'),toggle=toolbar.querySelector('button');
 assert.equal(form.hidden,true);assert.equal(proxy.value,'Alex');assert.equal(toggle.getAttribute('aria-controls'),'search');
 toggle.click();assert.equal(form.hidden,false);assert.equal(toggle.getAttribute('aria-expanded'),'true');assert.equal(submitted,0);
 proxy.value='Taylor';proxy.dispatchEvent(new w.Event('input',{bubbles:true}));assert.equal(original.value,'Taylor');
 proxy.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));assert.equal(submitted,1);
 const fields=new w.FormData(form);assert.equal(fields.get('company_code'),'club');assert.equal(fields.get('Search[active]'),'1');assert.equal(fields.get('Search[q]'),'Taylor');
 original.value='Changed in advanced filters';original.dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(proxy.value,original.value);
 w.GymMobileLayout.enhance();assert.equal(d.querySelectorAll('.gym-app-filter-toolbar').length,1);assert.equal(form.querySelector('input[name="Search[q]"]'),original);dom.window.close();
});

test('server-side filter validation remains visible, and rich page content headings are not globally hidden',()=>{
 const dom=page('<form method="get"><div class="has-error"><input name="q" aria-invalid="true"></div></form>');
 assert.equal(dom.window.document.querySelector('form').hidden,false);
 assert.equal(dom.window.document.querySelector('.gym-app-filter-button').getAttribute('aria-expanded'),'true');dom.window.close();
 const css=fs.readFileSync(server+'/frontend/web/css/gym-ui.css','utf8');
 const headings=new JSDOM('<style>'+css+'</style><main class="gym-menu-content"><div class="gym-canonical-page-heading"><h1 class="gym-page-heading__title">Page title</h1></div><article><h1 id="article">Agreement content</h1></article><div class="ql-editor" contenteditable="true"><h1 id="editor">Editable content</h1></div></main>');
 assert.notEqual(headings.window.getComputedStyle(headings.window.document.getElementById('article')).display,'none');
 assert.notEqual(headings.window.getComputedStyle(headings.window.document.getElementById('editor')).display,'none');headings.window.close();
});

test('workspace enhancements leave post forms, dialogs, calendars and unrelated pages alone',()=>{
 const dom=page('<form method="post"><input name="Member[name]"><button>Save</button></form><div class="modal"><form method="get"><input name="q"></form></div><section class="gym-client-portal"><form method="get"><input name="date"></form></section>');
 assert.equal(dom.window.document.querySelectorAll('.gym-app-filter-toolbar').length,0);
 assert.ok([...dom.window.document.forms].every(form=>!form.hidden));dom.window.close();
 const outside=new JSDOM('<form method="get"><input name="q"></form>',{runScripts:'outside-only'});outside.window.eval(script);outside.window.document.dispatchEvent(new outside.window.Event('DOMContentLoaded'));assert.equal(outside.window.document.querySelectorAll('.gym-app-filter-toolbar').length,0);outside.window.close();
});

test('simple record tables become labeled cards without replacing links, selection inputs or sorting headers',()=>{
 const dom=page('<div class="grid-view"><table><thead><tr><th><a href="?sort=name">Name</a></th><th>Status</th><th>Actions</th></tr></thead><tbody><tr><td>Alex<input type="checkbox" name="selection[]" value="7"></td><td>Active</td><td><a data-method="post" href="/memberships/delete?id=7">Delete</a></td></tr></tbody></table></div>');
 const d=dom.window.document,table=d.querySelector('table'),row=table.tBodies[0].rows[0];
 assert.ok(table.classList.contains('gym-app-card-table'));assert.equal(row.dataset.gymRecord,'1');assert.equal(row.cells[0].dataset.gymLabel,'Name');
 assert.equal(d.querySelector('input').value,'7');assert.equal(d.querySelector('a[data-method]').getAttribute('data-method'),'post');assert.ok(row.cells[2].classList.contains('gym-app-actions'));
 assert.equal(d.querySelector('thead a').getAttribute('href'),'?sort=name');dom.window.close();
});

test('complex matrices stay tables; updates can be enhanced repeatedly without observers or duplicate controls',()=>{
 const dom=page('<div class="table-responsive"><table><thead><tr><th colspan="2">Week</th></tr></thead><tbody><tr><td>A</td><td>B</td></tr></tbody></table></div>');
 const d=dom.window.document;assert.ok(!d.querySelector('table').classList.contains('gym-app-card-table'));
 const form=d.createElement('form');form.method='get';form.innerHTML='<input name="q">';d.querySelector('main').appendChild(form);d.dispatchEvent(new dom.window.Event('gym:content-updated'));assert.equal(d.querySelectorAll('.gym-app-filter-toolbar').length,1);
 dom.window.GymMobileLayout.enhance();assert.equal(d.querySelectorAll('.gym-app-filter-toolbar').length,1);assert.ok(!script.includes('MutationObserver'));dom.window.close();
});

test('all three workspace gym layouts register the shared asset and scope without changing navigation JSON',()=>{
 for(const name of ['admin','admin-mobile','main']){const source=fs.readFileSync(server+'/frontend/views/layouts/'+name+'.php','utf8');assert.ok(source.includes('GymMobileLayoutAsset::register($this)'));assert.ok(source.includes('gym-menu-content gym-app-layout'));}
 const css=fs.readFileSync(server+'/frontend/web/css/gym-mobile-layout.css','utf8');assert.ok(css.includes('@media(max-width:767.98px)'));assert.ok(css.includes('var(--sc-primary'));assert.ok(css.includes('[hidden]'));
});

test('shared input padding reserves space for leading icons without shifting plain controls or validation icons',()=>{
 const css=fs.readFileSync(server+'/frontend/web/css/gym-mobile-layout.css','utf8');
 const dom=new JSDOM('<style>'+css+'</style><main class="gym-app-layout"><div class="input-group-modern"><i id="leading"></i><input id="email" class="form-control" placeholder="Email address"></div><div class="input-group-modern"><i></i><select id="select" class="form-select"><option>Select user</option></select></div><div class="input-group-modern"><i id="autocomplete-icon"></i><div class="form-group"><input id="autocomplete" class="form-control"><div class="help-block">Validation message</div></div></div><div class="input-group-modern"><i></i><textarea id="notes" class="form-control"></textarea><span class="select2-container"><span class="select2-selection__rendered" id="select2">Selected name</span></span></div><input id="plain" class="form-control"></main>');
 const style=id=>dom.window.getComputedStyle(dom.window.document.getElementById(id));
 for(const id of ['email','select','autocomplete','notes'])assert.equal(style(id).paddingLeft,'42px');
 assert.equal(style('plain').paddingLeft,'12px');assert.equal(style('select2').paddingLeft,'40px');
 assert.equal(style('leading').top,'24px');assert.equal(style('autocomplete-icon').top,'24px');assert.equal(style('leading').pointerEvents,'none');
 dom.window.close();
});
