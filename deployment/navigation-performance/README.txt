Navigation and check-in experience — FTX and Demo

Canonical server files are already implemented in C:\inetpub\wwwroot\workspace.
Upload the frontend folder preserving its paths in the live Yii application root.
These assets extend the existing GymMobileLayoutAsset. The existing gym-shared-theme.css,
gym-mobile-layout.css and gym-mobile-layout.js must remain deployed.
No database migration or controller changes are needed for this fix.

Changes:
- Preserve viewport and identified nested scroll containers after check-in/out and clock-in/out.
- Handle normal forms, explicit submitter form actions and Yii data-method POST links.
- Restore through delayed font/image/panel layout; stop on user scrolling/touch.
- Save only coordinates and a timestamp for 45 seconds, never form values.
- Shared mobile native login shows editable username/password immediately; credentials remain
  only in React component memory and submit remains disabled until the real server form is ready.
- Preload up to three server-supplied native admin list destinations while idle.
  Cached navigation retains existing 60-second freshness rules. Mutations, logout and real
  document navigation cancel background requests logically and discard obsolete responses.
  No forms, action links or cross-company destinations are prefetched.
- Main client Settings and root admin Company/Preferences use the standard main header;
  nested admin edit pages retain back navigation.

Local verification: 215 tests, 70 company profile checks, 91 shared source files/dependencies,
Android/iOS bundle exports and PHP asset lint. No Expo cloud build or publication was started.

Physical phone verification before production:
- Check in and out after scrolling in client and staff areas on iPhone and Android.
- Navigate Dashboard/Clients/Classes/Memberships before and after idle preloading.
- Change account/permissions and confirm previous account data is not shown.
- Open Settings from the client footer and admin menu; check root and nested edit navigation.
- Cold start login on a slow connection, type before the form arrives, test autofill,
  invalid/valid login, timeout retry, logout and a fresh sign-in.
- Network response time still depends on the live server and connection. Local checks do not
  establish physical-device performance or replace signed-in account testing.

The preceding native fitness/authentication changes require new signed builds on the new
runtime. These JavaScript changes do not remove that requirement.
