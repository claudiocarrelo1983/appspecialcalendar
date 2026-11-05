(function () {
    'use strict';
    var root = document.querySelector('[data-notification-inbox]');
    if (!root || root.dataset.ready) return;
    root.dataset.ready = '1';
    var labels = JSON.parse(root.dataset.labels), schedules = new Map();
    var activeDialog = null;
    function readableDate(message) {
        return String(message).replace(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::\d{2})?/g, '$3/$2/$1 · $4:$5');
    }
    function dialog(title, message, subtitle, confirmLabel) {
        if (activeDialog) activeDialog(false);
        if (!document.getElementById('sc-inbox-dialog-style')) {
            var style=document.createElement('style');style.id='sc-inbox-dialog-style';
            style.textContent='.sc-inbox-dialog-overlay{position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box}.sc-inbox-dialog{position:relative;width:100%;max-width:390px;max-height:calc(100dvh - 40px);overflow:auto;box-sizing:border-box;background:#fff;border:1px solid #e4eaf2;border-radius:24px;padding:26px;box-shadow:0 24px 70px #0f172a33;color:#14243b;font-family:inherit}.sc-inbox-dialog-close{position:absolute;right:8px;top:8px;width:44px;height:44px;border:0;background:transparent;color:#718099;font-size:28px;cursor:pointer}.sc-inbox-dialog-icon{display:grid;place-items:center;width:52px;height:52px;border-radius:17px;background:#edf8f3;color:var(--sc-primary,#198754);margin-bottom:18px}.sc-inbox-dialog h2{font-size:21px;line-height:1.3;letter-spacing:-.3px;margin:0 22px 10px 0;font-weight:700}.sc-inbox-dialog-subtitle{font-size:13px;color:#718099;margin:0 0 16px;line-height:1.5}.sc-inbox-dialog-message{background:#f4f8fb;border:1px solid #e4eaf2;border-radius:14px;padding:15px;font-size:14px;line-height:1.7;white-space:pre-line;overflow-wrap:break-word;margin:0 0 22px}.sc-inbox-dialog-actions{display:flex;gap:10px}.sc-inbox-dialog-action{flex:1;min-height:48px;border:0;border-radius:14px;padding:12px;font:inherit;font-size:14px;font-weight:700;background:var(--sc-primary,#198754);color:white;cursor:pointer}.sc-inbox-dialog-action.secondary{background:#f1f5f9;color:#475569}.sc-inbox-dialog button:focus-visible{outline:3px solid #93c5fd;outline-offset:3px}';
            document.head.appendChild(style);
        }
        return new Promise(function (resolve) {
            var previous=document.activeElement,overflow=document.body.style.overflow;
            var overlay=document.createElement('div');overlay.className='sc-inbox-dialog-overlay';
            var panel=document.createElement('section');panel.className='sc-inbox-dialog';panel.setAttribute('role','alertdialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','sc-inbox-dialog-title');panel.setAttribute('aria-describedby','sc-inbox-dialog-message');
            var close=document.createElement('button');close.type='button';close.className='sc-inbox-dialog-close';close.textContent='×';close.setAttribute('aria-label',labels.close||'Close');
            var icon=document.createElement('div');icon.className='sc-inbox-dialog-icon';icon.setAttribute('aria-hidden','true');icon.innerHTML='<svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
            var heading=document.createElement('h2');heading.id='sc-inbox-dialog-title';heading.textContent=title;
            var detail=document.createElement('p');detail.className='sc-inbox-dialog-subtitle';detail.textContent=subtitle||'';
            var body=document.createElement('p');body.className='sc-inbox-dialog-message';body.id='sc-inbox-dialog-message';body.textContent=readableDate(message);
            var actions=document.createElement('div');actions.className='sc-inbox-dialog-actions';
            function finish(value){overlay.remove();document.body.style.overflow=overflow;activeDialog=null;if(previous&&previous.isConnected)previous.focus();resolve(value);}
            activeDialog=finish;close.onclick=function(){finish(false);};
            if(confirmLabel){var back=document.createElement('button');back.type='button';back.className='sc-inbox-dialog-action secondary';back.textContent=labels.back||'Back';back.onclick=function(){finish(false);};actions.appendChild(back);}
            var okay=document.createElement('button');okay.type='button';okay.className='sc-inbox-dialog-action';okay.textContent=confirmLabel||labels.gotIt||'Got it';okay.onclick=function(){finish(true);};actions.appendChild(okay);
            panel.append(close,icon,heading,detail,body,actions);overlay.appendChild(panel);document.body.appendChild(overlay);document.body.style.overflow='hidden';
            overlay.onclick=function(event){if(event.target===overlay)finish(false);};
            overlay.onkeydown=function(event){
                if(event.key==='Escape'){event.preventDefault();finish(false);}
                if(event.key==='Tab'){var buttons=Array.from(panel.querySelectorAll('button')),first=buttons[0],last=buttons[buttons.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
            };
            okay.focus();
        });
    }
    function safe(url) {
        var target = new URL(url, location.href);
        if (target.origin !== location.origin || target.username || target.password) throw Error(labels.failed);
        return target;
    }
    async function request(url, data) {
        var target = safe(url), options = { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } };
        if (data) {
            options.method = 'POST';
            options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            options.headers['X-CSRF-Token'] = document.querySelector('meta[name="csrf-token"]')?.content || window.yii?.getCsrfToken() || '';
            options.body = new URLSearchParams(data).toString();
        }
        var controller = new AbortController(), timeout = setTimeout(function () { controller.abort(); }, 20000);
        options.signal = controller.signal;
        var response;
        try { response = await fetch(target.href, options); } finally { clearTimeout(timeout); }
        var final = safe(response.url || target.href);
        if (!response.ok || /\/(?:site\/)?login\/?$/.test(final.pathname)) throw Error(labels.failed);
        var result = await response.json();
        if (result.success !== true) throw Error(result.message || labels.failed);
        return result;
    }
    function setState(row, checked, text, disabled) {
        var input = row.querySelector('[data-inbox-check]'), state = row.querySelector('[data-inbox-state]');
        input.checked = checked; input.dataset.checked = checked ? '1' : '0'; input.disabled = false;
        input.dataset.blocked = disabled ? '1' : '0';
        input.style.opacity = disabled ? '.55' : '';
        input.setAttribute('aria-label', (row.dataset.kind === 'class-invitation' ? (checked ? labels.cancel : labels.book) : row.dataset.kind === 'task' ? (checked ? labels.reopen : labels.complete) : (checked ? labels.unread : labels.read)) + ': ' + row.dataset.title);
        state.textContent = text; state.classList.toggle('is-positive', checked); state.classList.toggle('is-negative', !checked && row.dataset.kind === 'class-invitation');
        row.classList.toggle('is-unread', !checked);
    }
    async function loadBooking(row, force) {
        var query = JSON.parse(row.dataset.bookingQuery), key = JSON.stringify(query);
        if (force) schedules.delete(key);
        if (!schedules.has(key)) schedules.set(key, request('/dashboard-gym-client/native-schedule?' + new URLSearchParams(query)).catch(function (failure) { schedules.delete(key); throw failure; }));
        var result = await schedules.get(key), page = result.data;
        if (!page || page.companyCode !== query.company_code || page.date !== query.date || !Array.isArray(page.rows)) throw Error(labels.failed);
        var booking = page.rows.find(function (item) { return String(item.schedule_id) === row.dataset.schedule && item.date === query.date; });
        if (!booking) throw Error(labels.unavailable);
        if (booking.booked === true && (!Number.isSafeInteger(booking.booking_id) || booking.booking_id < 1
            || booking.booking_client_guid !== page.clientGuid)) throw Error(labels.unavailable);
        var action = (booking.actions || []).find(function (item) { return item.kind === (booking.booked ? 'cancel-booking' : 'book'); });
        row.bookingAction = action || null;
        setState(row, !!booking.booked, booking.booked ? labels.booked : labels.notBooked, !action || action.enabled !== true);
        row.querySelector('[data-inbox-reason]').textContent = booking.reason || '';
    }
    root.querySelectorAll('[data-booking-query]').forEach(function (row) {
        loadBooking(row, false).catch(function () {
            var input=row.querySelector('[data-inbox-check]');input.disabled=false;input.dataset.blocked='1';
            row.querySelector('[data-inbox-reason]').textContent = labels.unavailable;
        });
    });
    function explain(row) {
        var reason=row.querySelector('[data-inbox-reason]').textContent || labels.unavailable;
        row.querySelector('[data-inbox-error]').textContent='';
        var checked=row.querySelector('[data-inbox-check]').dataset.checked==='1';
        var title=/\bopen|abrem/i.test(reason)?labels.bookingNotOpen:(checked?labels.cancellationUnavailable:labels.bookingUnavailable);
        dialog(title||labels.unavailable,reason,row.dataset.title);
    }
    root.addEventListener('click', function (event) {
        var input=event.target.closest('[data-inbox-check]');if(!input)return;
        var row=input.closest('[data-inbox-row]');
        if(row.dataset.kind==='class-invitation' && input.dataset.blocked==='1' && row.dataset.busy!=='1'){
            event.preventDefault();explain(row);
        }
    });
    root.addEventListener('change', async function (event) {
        var input = event.target.closest('[data-inbox-check]'); if (!input) return;
        var row = input.closest('[data-inbox-row]'), old = input.dataset.checked === '1', wanted = input.checked;
        input.checked = old;
        if (row.dataset.busy === '1') return;
        if (row.dataset.kind === 'class-invitation' && input.dataset.blocked === '1') { explain(row); return; }
        if (row.dataset.kind === 'class-invitation' && !await dialog(wanted?labels.book:labels.cancel,wanted?labels.confirmBook:labels.confirmCancel,row.dataset.title,wanted?labels.book:labels.cancel)) return;
        row.dataset.busy = '1'; input.disabled = true;
        var error = row.querySelector('[data-inbox-error]'); error.textContent = '';
        try {
            if (row.dataset.kind === 'class-invitation') {
                var action = row.bookingAction;
                if (!action || action.enabled !== true || action.kind !== (wanted ? 'book' : 'cancel-booking')) throw Error(labels.unavailable);
                var target = '/dashboard-gym-client/' + action.kind + '?' + new URLSearchParams(action.params);
                await request(target, action.params);
                await loadBooking(row, true);
            } else {
                var payload = { checked: wanted ? '1' : '0' };
                if (row.dataset.kind === 'task') payload.id = row.dataset.id;
                var response = await request(row.dataset.action, payload);
                if (response.checked !== wanted) throw Error(labels.failed);
                setState(row, response.checked, row.dataset.kind === 'task' ? (wanted ? labels.completed : labels.pending) : (wanted ? labels.readState : labels.unreadState), false);
            }
        } catch (failure) {
            input.checked = old;
            error.textContent = failure.message || labels.failed;
            if (row.dataset.kind === 'class-invitation') await loadBooking(row, true).catch(function () {});
        } finally {
            row.dataset.busy = '0';
            if (row.dataset.kind !== 'class-invitation') input.disabled = false;
        }
    });
}());
