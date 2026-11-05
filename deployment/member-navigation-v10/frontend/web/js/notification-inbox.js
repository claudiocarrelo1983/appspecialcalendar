(function () {
    'use strict';
    var root = document.querySelector('[data-notification-inbox]');
    if (!root || root.dataset.ready) return;
    root.dataset.ready = '1';
    var labels = JSON.parse(root.dataset.labels), schedules = new Map();
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
        input.checked = checked; input.dataset.checked = checked ? '1' : '0'; input.disabled = disabled;
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
        loadBooking(row, false).catch(function () { row.querySelector('[data-inbox-reason]').textContent = labels.unavailable; });
    });
    root.addEventListener('change', async function (event) {
        var input = event.target.closest('[data-inbox-check]'); if (!input) return;
        var row = input.closest('[data-inbox-row]'), old = input.dataset.checked === '1', wanted = input.checked;
        input.checked = old;
        if (row.dataset.busy === '1') return;
        if (row.dataset.kind === 'class-invitation' && !window.confirm(wanted ? labels.confirmBook : labels.confirmCancel)) return;
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
