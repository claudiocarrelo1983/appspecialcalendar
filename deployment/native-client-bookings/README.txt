Native client Book a class page

AUTHORITATIVE SERVER SOURCE
These files were implemented and checked in C:/inetpub/wwwroot/workspace first.
This package is generated from that workspace. Upload to the same live paths:
common/helpers/NativeClientBookings.php
frontend/controllers/DashboardGymClientController.php

The controller adds GET /dashboard-gym-client/native-schedule. Existing session
authentication, client-level checks, timeout handling, managed-family resolution,
company access and booking rules remain in the existing controller/helper.
The native endpoint pins company app domains to their company before resolving
the selected managed client. It validates calendar dates before building data.

Native booking/cancellation/waitlist/payment/alert requests call the EXISTING
POST actions through the authenticated WebView transport with its CSRF token.
Credentials and CSRF values are not sent into React Native state. The server
revalidates availability, membership, capacity and booking/cancellation windows.
The client DTO includes only explicit display data and authorized action params.
It never serializes whole User, membership, participant or payment records.

Native controls cover:
- Native app header/footer, month/day/week navigation and Today
- Day strip, class category filters, show/hide past classes
- Class cards, availability, booking/waitlist state, details and participants
- Book, cancel, join/leave waitlist, secure payment handoff
- Booking-opening alert switches using the existing push-registration flow
- Managed-family account selection, membership summary, booking/history list
- Reading pending agreements and explicit consent before signing
- Add to calendar and the shared company-client invitation popup
- Shared-class/push URLs open the matching native class details/booking box

Signing checks that the agreement exists in the selected company and supports
the same existing AJAX success format as other booking actions. Normal website
requests retain their redirect behavior. No agreement is signed automatically.
Stripe Checkout uses the external secure checkout.stripe.com flow. The app
refreshes the native page when it returns to the foreground.

The existing class-invitations server files are also required for sending an
invitation. They are maintained separately in the same actual server workspace.

DEPLOYMENT ORDER
1. Back up and upload the two PHP files, preserving paths.
2. Publish the current shared React Native code as EAS Update to the installed
   app's matching channel/runtime: ftx-preview or ftx-production, respectively.
No new native dependency, database migration or EAS cloud build is introduced.

LOCAL VERIFICATION
JavaScript tests exercise bridge allowlists/CSRF, rapid date changes, stale
responses, managed-client params, duplicate taps, native booking refreshes,
denied access/account clearing, push-permission gating, trusted payment handoff,
native filter/share/confirmation controls and single-modal sharing.
PHP tests exercise actual workspace DTO date/identity/closed-class handling,
calendar timezone data, contract text and exclusion of credential fields.

PREVIEW
node scripts/admin-mobile-preview.cjs --serve
http://127.0.0.1:4173/?app=1&client=1
The preview uses sample names and local state. It does not create real bookings,
send notifications, take payments or sign agreements.

Physical signed-in phones still need verification after server upload/update,
including real booking, cancellation cutoffs, opening alerts, family access,
payments returning to the app, calendar, invitation pushes and contract signing.
No live server upload, live booking, payment or message was performed here.

MEMBER SUMMARY UPDATE
Native Bookings now includes the selected member's name, photo, club, membership status and member number above the calendar, without a QR code. Upcoming bookings and history use separate expandable native sections. My pass keeps its QR code. The helper must be uploaded for member details and separate lists.


HTTP 404 ROUTE FIX
Upload ALL THREE PHP files, preserving their paths:
common/components/MobilePushBootstrap.php
common/helpers/NativeClientBookings.php
frontend/controllers/DashboardGymClientController.php
The bootstrap registers the native schedule and action routes before legacy company/page rules. The controller must include actionNativeSchedule; uploading the helper alone cannot add that action. This package is copied from the actual server workspace. No new app build is needed for this server fix.
After deployment, the unauthenticated /dashboard-gym-client/native-schedule request should redirect to login instead of returning HTTP 404. Sign in on a phone and tap Try again to test the protected JSON data. If the old PHP action remains cached, ask hosting to reload its PHP worker/OPcache for the updated files. Do not delete unrelated site files.

