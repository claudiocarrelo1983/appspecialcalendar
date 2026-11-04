const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),babel=require('@babel/core'),{JSDOM}=require('jsdom');
const exportsObject={};
const {code}=babel.transformSync(fs.readFileSync('src/utils/summaryCardLayout.js','utf8'),{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']});
vm.runInNewContext(code,{exports:exportsObject});
const script=exportsObject.summaryCardLayoutScript;
test('the injected layout works when compiled functions cannot expose their source',()=>{
 const compiledExports={};
 vm.runInNewContext("Function.prototype.toString=function(){return 'function () { [native code] }';};\n"+code,{exports:compiledExports});
 const dom=new JSDOM('<main class="gym-app-layout"><div class="row"><div class="col-md"><div class="challenge-stat-card"><i class="bx bx-award"></i>Total challenges 1</div></div><div class="col-md"><div class="challenge-stat-card"><i class="bx bx-bolt"></i>Active challenges 1</div></div></div></main>',{runScripts:'outside-only'});
 assert.doesNotThrow(()=>dom.window.eval(compiledExports.summaryCardLayoutScript));
 assert.equal(dom.window.document.querySelectorAll('.gym-summary-card').length,2);
 assert.equal(dom.window.document.querySelectorAll('.gym-summary-icon').length,2);
 dom.window.close();
});
test('summary cards use equal columns across page families without replacing links or handlers',()=>{
 for(const type of ['challenge-stat-card','team-stat-card','events-stat-card','client-info-stat','report-kpi']){
  const dom=new JSDOM(`<main class="gym-app-layout"><div class="row">${[1,2,3,4,5].map(n=>`<div class="col-md"><a class="${type}" href="?filter=${n}"><i class="bx bx-group"></i><span class="text-muted">Long summary label ${n}</span><strong>${n}</strong></a></div>`).join('')}</div></main>`,{runScripts:'outside-only'});
  const doc=dom.window.document,link=doc.querySelector('a');let clicked=0;link.addEventListener('click',e=>{e.preventDefault();clicked++;});
  dom.window.eval(script);dom.window.eval(script);link.click();
  assert.equal(doc.querySelectorAll('.gym-summary-grid').length,1,type);
  assert.equal(doc.querySelectorAll('.gym-summary-cell').length,5,type);
  assert.equal(doc.querySelectorAll('.gym-summary-card').length,5,type);
  assert.equal(doc.querySelectorAll('.gym-summary-icon').length,5,type);
  assert.equal(doc.querySelector('a'),link);assert.equal(clicked,1);assert.equal(link.getAttribute('href'),'?filter=1');
  assert.equal(doc.querySelectorAll('#gym-summary-card-styles').length,1);
  assert.match(doc.querySelector('style').textContent,/repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(doc.querySelector('style').textContent,/right:10px!important/);
  assert.match(doc.querySelector('style').textContent,/min-height:66px!important/);
  assert.match(doc.querySelector('style').textContent,/margin-top:16px!important/);
  assert.match(doc.querySelector('style').textContent,/linear-gradient/);
  dom.window.close();
 }
});
test('summary colours distinguish totals, active, waiting and cancelled cards in both languages',()=>{
 const tone=exportsObject.summaryCardTone;
 assert.equal(tone('Total participants').color,'#3156a0');
 assert.equal(tone('Registered').color,'#198754');
 assert.equal(tone('Active challenges').color,'#198754');
 assert.equal(tone('Waiting list').color,'#b77909');
 assert.equal(tone('Cancelled').color,'#64748b');
 assert.equal(tone('Inscritos').color,'#198754');
 assert.equal(tone('Lista de espera').color,'#b77909');
 assert.equal(tone('Cancelados').color,'#64748b');
 assert.equal(tone('Overdue').color,'#c24141');
 assert.equal(tone('Em atraso').color,'#c24141');
});
test('task summary markup keeps its live counters and uses the same tones as native cards',()=>{
 const dom=new JSDOM('<main class="gym-app-layout"><section class="task-stat-grid">'+[['Total','all',14],['Pending','pending',11],['Completed','completed',3],['Overdue','overdue',8]].map(([label,key,count])=>`<article class="task-stat-card rounded-4 shadow-sm"><span class="task-stat-icon task-tone-green"><i class="bx bx-list-ul" aria-hidden="true"></i></span><div><div class="task-stat-label">${label}</div><strong data-task-count="${key}">${count}</strong></div></article>`).join('')+'</section></main>',{runScripts:'outside-only'});
 const doc=dom.window.document,counter=doc.querySelector('[data-task-count="pending"]');
 dom.window.eval(script);
 assert.equal(doc.querySelectorAll('.gym-summary-card').length,4);
 assert.equal(doc.querySelectorAll('.gym-summary-icon').length,4);
 for(const card of doc.querySelectorAll('.task-stat-card'))assert.equal(card.style.getPropertyValue('--gym-summary-color'),exportsObject.summaryCardTone(card.textContent).color);
 counter.textContent='10';doc.dispatchEvent(new dom.window.Event('gym:content-updated'));
 assert.equal(doc.querySelector('[data-task-count="pending"]'),counter);
 assert.equal(counter.textContent,'10');
 assert.match(doc.querySelector('style').textContent,/\[class\*="-stat-label"\]/);
 dom.window.close();
});
test('mixed content, forms, unrelated pages and opted-out layouts retain their structure',()=>{
 const dom=new JSDOM('<main class="gym-app-layout"><div id="mixed"><div class="team-stat-card">1</div><form>Keep form</form></div><form><div class="team-stat-card">1</div><div class="team-stat-card">2</div></form><div data-gym-keep-layout><div class="team-stat-card">1</div><div class="team-stat-card">2</div></div></main><div><div class="team-stat-card">1</div><div class="team-stat-card">2</div></div>',{runScripts:'outside-only'});
 dom.window.eval(script);assert.equal(dom.window.document.querySelectorAll('.gym-summary-card').length,0);dom.window.close();
});
test('embedded pages and subsequent content updates receive the same layout',()=>{
 const dom=new JSDOM('<html class="__scNativeAdminFrame"><main class="page-content"><div id="cards"></div></main></html>',{runScripts:'outside-only'});
 dom.window.eval(script);
 dom.window.document.getElementById('cards').innerHTML='<div class="challenge-stat-card">1</div><div class="challenge-stat-card">2</div>';
 dom.window.document.dispatchEvent(new dom.window.Event('gym:content-updated'));
 assert.equal(dom.window.document.querySelectorAll('.gym-summary-card').length,2);dom.window.close();
});
