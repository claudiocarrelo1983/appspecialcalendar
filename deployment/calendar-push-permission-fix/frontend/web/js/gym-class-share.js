(function ($) {
    'use strict';

    $(document).on('click', '[data-gym-calendar-event]', function (event) {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        const appleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
            (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
        const embeddedApple = appleMobile && (window.ReactNativeWebView || !/Safari\//i.test(navigator.userAgent));
        if (!window.ReactNativeWebView || !window.__specialCalendarNativeCalendar) {
            if (!embeddedApple) return;
            const dialog = document.getElementById('gymAppleCalendarDialog');
            if (!dialog) return;
            event.preventDefault();
            dialog.querySelector('input').value = this.href;
            dialog.querySelector('[role="status"]').textContent = '';
            if (dialog.showModal) dialog.showModal();
            else dialog.setAttribute('open', '');
            return;
        }
        event.preventDefault();
        if (!event.originalEvent || event.originalEvent.isTrusted !== true) return;
        window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'gym.calendar.create',
            version: 1,
            userInitiated: true,
            interactionAt: Date.now(),
            language: document.documentElement.lang || 'en',
            event: JSON.parse(this.dataset.gymCalendarEvent)
        }));
    });

    $(document).on('click', '[data-gym-calendar-close]', function () {
        const dialog = document.getElementById('gymAppleCalendarDialog');
        if (dialog.close) dialog.close();
        else dialog.removeAttribute('open');
    });

    $(document).on('click', '[data-gym-calendar-copy]', async function () {
        const dialog = document.getElementById('gymAppleCalendarDialog');
        const input = dialog.querySelector('input');
        let copied = false;
        // Selection also allows manual copying on older WKWebView versions.
        input.focus();
        input.select();
        input.setSelectionRange(0, input.value.length);
        try { copied = document.execCommand('copy'); } catch (error) { /* Try Clipboard next. */ }
        if (!copied && navigator.clipboard && window.isSecureContext) {
            try { await navigator.clipboard.writeText(input.value); copied = true; } catch (error) { /* Keep the selected URL. */ }
        }
        dialog.querySelector('[role="status"]').textContent = copied ? dialog.dataset.copied : dialog.dataset.manualCopy;
    });

    $(document).on('click', '[data-gym-share]', async function (event) {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        const link = this;
        const messages = document.getElementById('gymClassShareMessages');
        try {
            if (navigator.share) {
                await navigator.share({title: link.dataset.shareTitle, url: link.href});
                return;
            }
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(link.href);
                const status = document.getElementById('gymClassShareStatus');
                status.textContent = messages.dataset.copied;
                window.setTimeout(function () { status.textContent = ''; }, 4000);
                return;
            }
        } catch (error) {
            if (error.name === 'AbortError') return;
        }
        window.prompt(messages.dataset.copy, link.href);
    });

    $(function () {
        const modal = document.getElementById('gymClientClassModal');
        if (!modal || !window.bootstrap) return;
        const dialog = bootstrap.Modal.getOrCreateInstance(modal);

        function setConfirmationMode(isConfirmation) {
            modal.classList.toggle('is-booking-confirmation', isConfirmation);
            $(modal).find('.modal-dialog').removeClass('modal-fullscreen-sm-down');
            $(modal).find('.modal-title').text(isConfirmation ? modal.dataset.confirmTitle : modal.dataset.detailsTitle);
        }

        function openBookingConfirmation(card) {
            const form = card.find('.gym-client-modal-booking').first().clone();
            if (!form.length) return;
            const values = {
                class: card.find('.gym-client-class-main h3').first().text().trim(),
                date: String(card.attr('data-class-date') || '').split('-').reverse().join('/'),
                time: card.find('.gym-client-class-time strong').first().text().trim()
            };
            const message = String(modal.dataset.confirmMessage || '').replace(/\{(class|date|time)\}/g, function (_, key) { return values[key]; });
            // Retain the original booking fields and card context for the existing AJAX handler.
            const content = card.clone().empty().removeClass('d-none is-due-hidden is-filter-hidden is-dued').addClass('gym-client-class-dialog-card');
            content.append($('<div class="gym-client-class-flash">'));
            content.append($('<p class="gym-client-booking-confirm-message">').text(message));
            form.removeClass('d-none d-inline').addClass('gym-client-confirm-form');
            form.find('button[type="submit"]').empty().append($('<i class="bx bx-check" aria-hidden="true">'), $('<span>').text(modal.dataset.confirmButton));
            const cancel = $('<button type="button" class="btn btn-reset-modern rounded-4" data-bs-dismiss="modal">').text(modal.dataset.cancelButton);
            content.append($('<div class="gym-client-booking-confirm-actions">').append(cancel, form));
            setConfirmationMode(true);
            $(modal).find('.modal-body').empty().append(content);
            dialog.show();
        }

        function openClass(card) {
            setConfirmationMode(false);
            const content = card.clone();
            // Keep a single copy of payment dialogs and participant collapse IDs.
            content.children().not('.gym-client-class-top, .gym-client-class-flash').remove();
            content.removeClass('d-none is-due-hidden is-filter-hidden is-dued');
            content.find('[data-gym-class-book-trigger]').remove();
            content.find('.gym-client-modal-booking').removeClass('d-none').addClass('d-inline');
            content.find('[data-gym-class-details]').replaceWith(function () { return document.createTextNode(this.textContent); });
            content.find('.gym-client-class-main h3').removeClass('text-truncate');
            content.addClass('gym-client-class-dialog-card');
            const actions = content.find('.gym-client-class-side').detach().addClass('gym-client-modal-booking-actions');
            const badges = actions.children('.badge').detach();
            const availability = badges.first().addClass('gym-client-modal-availability');
            const notices = badges.slice(1).removeClass('badge rounded-pill text-bg-light').addClass('gym-client-modal-notice');
            if (badges.length) content.append($('<div class="gym-client-modal-status">').append(availability, notices));
            const utilities = $('<div class="gym-client-modal-tools">').append(actions.children('.gym-class-utility-btn').detach());
            const description = card.attr('data-class-description');
            if (description) $('<p class="text-muted gym-client-modal-description">').text(description).appendTo(content);
            content.append(utilities);
            if (actions.children().length) content.append(actions);
            $(modal).find('.modal-body').empty().append(content);
            dialog.show();
        }

        $(document).on('click', '[data-gym-class-details]', function () {
            const card = $(this).closest('.gym-client-class');
            if (this.hasAttribute('data-gym-class-book-trigger')) openBookingConfirmation(card);
            else openClass(card);
        });
        $(document).on('gym:classes-refresh', function () { dialog.hide(); });
        modal.addEventListener('hidden.bs.modal', function () { $(modal).find('.modal-body').empty(); });

        const params = new URLSearchParams(window.location.search);
        const pushInformation = document.getElementById('gymPushInformationModal');
        const actionablePush = pushInformation && pushInformation.dataset.pushActionable === '1';
        if (params.has('schedule_id') && (!pushInformation || actionablePush)) {
            const card = $('#gymClientClasses .gym-client-class').filter(function () {
                return this.dataset.scheduleId === params.get('schedule_id') && this.dataset.classDate === params.get('date');
            }).first();
            if (card.length) {
                openClass(card);
                if (pushInformation) {
                    const status = pushInformation.querySelector('[data-push-status]');
                    if (status) $(modal).find('.modal-body').prepend($(status).clone().addClass('mb-3'));
                    // A booked class presents Cancel rather than a misleading
                    // "Book a class" title. Actions come from this fresh card.
                    $(modal).find('.modal-title').text(card.find('.gym-client-class-main h3').first().text().trim());
                }
            }
            else if (!pushInformation) {
                setConfirmationMode(false);
                $(modal).find('.modal-body').empty().append($('<div class="alert alert-info rounded-4 mb-0" role="alert">').text(modal.dataset.unavailable));
                dialog.show();
            }
        }
        $(document).on('gym:classes-refresh', function () {
            if (pushInformation) bootstrap.Modal.getOrCreateInstance(pushInformation).hide();
        });
    });
})(jQuery);
