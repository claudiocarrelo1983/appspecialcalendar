(function (global) {
    'use strict';
    // Rebuild an existing local route rather than navigating to QR-supplied URLs.
    function memberTarget(value, config) {
        try {
            if (typeof value !== 'string' || value.length > 2048) return null;
            var url = new URL(value.trim());
            // Previously issued passes can contain development URLs with the ID
            // in the path. Extract only that ID; never navigate to their origin.
            var legacyLocal = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname.toLowerCase());
            if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password
                || (!config.origins.includes(url.origin) && !legacyLocal)) return null;
            for (var key of ['r', 'id', 'company_code']) if (url.searchParams.getAll(key).length > 1) return null;
            var path = url.pathname.replace(/\/+$/, '');
            var route = path === '/index.php' ? '/' + (url.searchParams.get('r') || '').replace(/^\/+|\/+$/g, '') : path;
            var match = /^\/clients-list\/view(?:\/([1-9]\d{0,9}))?$/.exec(route);
            if (!match) return null;
            var id = match[1] || url.searchParams.get('id');
            if (!/^[1-9]\d{0,9}$/.test(id || '') || Number(id) > 2147483647) return null;
            if (match[1] && url.searchParams.has('id') && url.searchParams.get('id') !== id) return null;
            if (url.searchParams.has('company_code') && url.searchParams.get('company_code') !== config.companyCode) return null;
            var target = new URL(config.destination);
            if (config.checkinDestination) {
                var confirmation = new URL(config.checkinDestination);
                if (confirmation.origin !== target.origin || !/\/gym-checkin(?:\/index)?\/?$/.test(confirmation.pathname)) return null;
                confirmation.searchParams.set('member_id', id);
                confirmation.searchParams.set('company_code', config.companyCode);
                return confirmation.href;
            }
            target.searchParams.set('id', id);
            target.searchParams.set('company_code', config.companyCode);
            return target.href;
        } catch (e) { return null; }
    }
    global.gymMemberQrTarget = memberTarget;
    if (!global.document) return;
    var modal = document.getElementById('gymMemberQrScanner');
    if (!modal) return;
    var config = JSON.parse(modal.dataset.config), video = modal.querySelector('video');
    var status = modal.querySelector('[data-qr-status]'), canvas = document.createElement('canvas');
    var context = canvas.getContext('2d', {willReadFrequently: true});
    var stream = null, timer = null, revision = 0, active = false, opening = false;
    function message(key) { status.textContent = config.messages[key]; }
    function stop() {
        revision++;
        clearTimeout(timer);
        if (stream) stream.getTracks().forEach(function (track) { track.stop(); });
        stream = null;
        video.srcObject = null;
    }
    function accept(value) {
        var target = memberTarget(value, config);
        if (!target) { message('invalid'); return false; }
        if (opening) return true;
        opening = true;
        message('opening');
        stop();
        global.location.assign(target);
        return true;
    }
    function decode(source, width, height) {
        var scale = Math.min(1, 1280 / Math.max(width, height));
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        var pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        return global.jsQR(pixels.data, canvas.width, canvas.height, {inversionAttempts: 'attemptBoth'});
    }
    function scan(version) {
        if (!active || version !== revision || opening) return;
        if (video.readyState >= 2 && video.videoWidth) {
            try {
                var result = decode(video, video.videoWidth, video.videoHeight);
                if (result && accept(result.data)) return;
            } catch (e) { message('camera_error'); stop(); return; }
        }
        timer = setTimeout(function () { scan(version); }, 200);
    }
    async function start() {
        stop();
        var version = revision;
        message('starting');
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { message('camera_error'); return; }
        try {
            var camera = await navigator.mediaDevices.getUserMedia({audio: false, video: {facingMode: {ideal: 'environment'}, width: {ideal: 960}, height: {ideal: 960}}});
            if (!active || revision !== version) { camera.getTracks().forEach(function (track) { track.stop(); }); return; }
            stream = camera;
            video.srcObject = camera;
            await video.play();
            if (!active || revision !== version) return;
            message('ready');
            scan(version);
        } catch (e) { if (active && revision === version) { stop(); message('camera_error'); } }
    }
    modal.addEventListener('shown.bs.modal', function () {
        active = true; opening = false;
        var menu = document.getElementById('fabMenu'), button = document.getElementById('fabBtn');
        if (menu) menu.classList.remove('show');
        if (button) button.classList.remove('open');
        start();
    });
    modal.addEventListener('hide.bs.modal', function () { active = false; stop(); });
    modal.querySelector('[data-qr-start]').addEventListener('click', start);
    modal.querySelector('[data-qr-file]').addEventListener('change', function (event) {
        var file = event.target.files[0];
        event.target.value = '';
        if (!file) return;
        stop();
        var version = revision, image = new Image(), objectUrl = URL.createObjectURL(file);
        image.onload = function () {
            try {
                if (!active || revision !== version) return;
                var result = decode(image, image.naturalWidth, image.naturalHeight);
                if (result) accept(result.data); else message('not_found');
            } catch (e) { message('not_found'); }
            finally { URL.revokeObjectURL(objectUrl); }
        };
        image.onerror = function () { URL.revokeObjectURL(objectUrl); if (active) message('not_found'); };
        image.src = objectUrl;
    });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else if (active && !opening) start(); });
    global.addEventListener('pagehide', stop);
}(window));
