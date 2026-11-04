(function () {
    'use strict';
    if (window.GymMobileLayout) return;
    var labels=window.gymMobileLayoutLabels||{};
    function text(key,fallback){return labels[key]||fallback;}
    function enhanceFilters(root){
        root.querySelectorAll('form').forEach(function(form){
            if((form.getAttribute('method')||'get').toLowerCase()!=='get'||form.dataset.gymFilterReady||form.closest('.modal,dialog,.fc,.dashboard-gym-page,.gym-client-portal,.classes-schedule-page,[data-gym-keep-layout]'))return;
            var fields=Array.from(form.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]),select,textarea')).filter(function(field){return !field.disabled;});
            if(!fields.length)return;
            form.dataset.gymFilterReady='1';
            var search=fields.find(function(field){return field.tagName==='INPUT'&&(/search/i.test(field.type)||/\[(q|query|search|full_name|username|name)\]$|^(q|query|search|name)$/i.test(field.name));});
            var toolbar=document.createElement('div');toolbar.className='gym-app-filter-toolbar';
            if(search){
                var proxy=document.createElement('input');proxy.type='search';proxy.className='form-control gym-app-search';proxy.placeholder=text('search','Search');proxy.setAttribute('aria-label',text('search','Search'));proxy.value=search.value;
                proxy.addEventListener('input',function(){search.value=proxy.value;search.dispatchEvent(new Event('input',{bubbles:true}));});
                function syncSearch(){proxy.value=search.value;}
                search.addEventListener('input',syncSearch);search.addEventListener('change',syncSearch);
                proxy.addEventListener('keydown',function(event){if(event.key==='Enter'){event.preventDefault();search.value=proxy.value;search.dispatchEvent(new Event('change',{bubbles:true}));if(form.requestSubmit)form.requestSubmit();else form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));}});
                form.addEventListener('reset',function(){setTimeout(function(){proxy.value=search.value;},0);});toolbar.appendChild(proxy);
            }
            if(!form.id){var id=0;do{form.id='gym-app-filter-'+(++id);}while(document.getElementById(form.id)!==form);}
            var button=document.createElement('button');button.type='button';button.className='btn gym-app-filter-button';button.textContent=text('filter','Filter');button.setAttribute('aria-controls',form.id);var invalid=form.querySelector('.has-error,.is-invalid,[aria-invalid="true"]');
            button.setAttribute('aria-expanded',String(!!invalid));
            button.addEventListener('click',function(){form.hidden=!form.hidden;button.setAttribute('aria-expanded',String(!form.hidden));if(!form.hidden){var first=fields.find(function(field){return field!==search;})||fields[0];if(first)first.focus();}});
            toolbar.appendChild(button);form.classList.add('gym-app-filter-panel');form.before(toolbar);form.hidden=!invalid;
        });
    }
    function enhanceTables(root){
        root.querySelectorAll('.grid-view table,.table-responsive > table').forEach(function(table){
            if(table.dataset.gymTableReady||table.classList.contains('detail-view')||table.closest('.fc,.calendar,.timetable,[data-gym-keep-table],[data-gym-keep-layout]'))return;
            var headers=Array.from(table.querySelectorAll('thead tr:first-child > th'));
            if(!headers.length||headers.some(function(cell){return cell.colSpan>1||cell.rowSpan>1;}))return;
            var rows=Array.from(table.querySelectorAll('tbody > tr'));
            if(rows.some(function(row){return Array.from(row.cells).some(function(cell){return cell.rowSpan>1||cell.colSpan>1&&!cell.querySelector('.empty');});}))return;
            var records=0;
            rows.forEach(function(row){
                if(row.cells.length!==headers.length||Array.from(row.cells).some(function(cell){return cell.colSpan>1;}))return;
                row.dataset.gymRecord='1';records++;
                Array.from(row.cells).forEach(function(cell,index){
                    var label=headers[index].textContent.replace(/\s+/g,' ').trim();
                    if(label)cell.dataset.gymLabel=label;
                    if(cell.querySelector('a,button')&&!cell.textContent.trim()||/^(actions|ações|acoes)$/i.test(label))cell.classList.add('gym-app-actions');
                });
            });
            if(records){table.classList.add('gym-app-card-table');table.dataset.gymTableReady='1';}
        });
    }
    function enhance(){document.querySelectorAll('.gym-app-layout').forEach(function(root){enhanceFilters(root);enhanceTables(root);});}
    window.GymMobileLayout={enhance:enhance};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance,{once:true});else enhance();
    document.addEventListener('gym:content-updated',enhance);
    if(window.jQuery)window.jQuery(document).on('pjax:end.gymMobileLayout',enhance);
})();
