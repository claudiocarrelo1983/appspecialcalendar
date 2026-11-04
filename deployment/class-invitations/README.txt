Class invitations for every active company account level

Search revision v2:
Searches full name, first name, last name and username, including multiple
name parts. Missing full_name is displayed using first_name + last_name.
Company app subdomains resolve their own company before sender authorization;
a different selected session company cannot redirect the directory search.
Responses identify this revision with X-SC-Class-Invitations: search-v2.
To fix existing installations, replace common/helpers/ClassInvitations.php
and frontend/controllers/ClassInvitationsController.php from this package.
These search fixes require no new mobile build or update.

Upload all included PHP files to the live Yii application, preserving paths:
common/helpers/ClassInvitations.php
common/helpers/CompanyNotificationService.php
common/helpers/NativeGymService.php
frontend/controllers/ClassInvitationsController.php

Back up the matching live files before replacing them. The two existing
service files were based on the local server source on 30 October 2026.
No database migration is added. The existing company_notification and
company_notification_recipient tables and push delivery worker must be present.

Install the server files before publishing the mobile update. Both are needed.
The application keeps company scopes and existing bulk notification-management permission,
approved active client memberships, CSRF protection and existing push preferences.
The directory returns at most 20 client names and IDs after 2 characters, never
emails or phone numbers. No global client directory is exposed.

Admins, clients, coaches and other active company members can select another
client in the same company and explicitly send a class invitation. This does
not grant access to bulk notifications or administrative functions.
Client class Share buttons open the same native popup as admin class cards.
Calendar actions remain available through the existing class calendar buttons.
Search and Send
use the authenticated WebView cookie jar. The server validates the schedule,
future occurrence and recipient again; it does not trust the mobile class URL.
Retries use an idempotency token. A per-sender 20-notices/minute limit applies.
Only the selected client gets the inbox notification. Push delivery is attempted
through the existing push queue; OS permission, club preferences, registration
and the queue worker still govern delivery. Durable inbox storage is the Send
success condition, not proof that a push reached the phone.

Push payloads for invitations contain type=class-invitation and a scoped URL:
/dashboard-gym-client/index?company_code=...&date=YYYY-MM-DD&schedule_id=...
The existing native push-tap handler opens it inside the app. The existing
gym-class-share.js booking dialog presents the current class, membership,
capacity and payment actions. It does not automatically reserve a place.
The mobile update suppresses the separate generic push information box for
class invitations, so it does not cover the booking dialog.

Client inbox rows also include bookingUrl; tapping one opens the same class.
FTX and Demo use the same React Native code. Preview searches/sends use sample
data only and do not send any messages or connect to real accounts.

Prepared locally only. Nothing was uploaded and no real invitations were sent.
Test on two signed-in physical phones after server upload and mobile update:
search, selection, Send, recipient inbox, foreground/background/cold-start push,
sign-in continuation, unavailable/full classes, disabled push and duplicate retry.
