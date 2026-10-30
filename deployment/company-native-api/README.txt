Shared native API company resolution

Diagnostic revision: company-scope-v3
This revision preserves access decisions and adds deployment/denial diagnostics.
After uploading BOTH PHP files, GET /native-gym without a login should still return
HTTP 401, with header X-SC-Native-Api-Revision: company-scope-v3.
If this header is missing, the request is using a different controller/release,
the upload directory is wrong, or PHP/opcache is still serving older files.

Reproduce the 403 in the installed app, then download this dedicated file:
  frontend/runtime/logs/native-gym-access.log
It is written directly, independently of the site's main log target and severity.
Do not download app.log or the admin portal's log. Look for:
  native-gym-access-denied:REASON
Share only that line, not cookies, credentials, session data or a complete log file.
The response also carries the same reason in X-SC-Native-Access-Reason.
Each context request also writes native-gym-context-request:guest or :authenticated.
No usernames, IDs, cookies, tokens or session contents are written to this file.
If PHP cannot write it, the response has X-SC-Native-Log-Status: unwritable.
If the revision header is present but no denial reason appears, the request is
being refused outside the company-scope helper (for example middleware or nginx).

Deploy these two PHP files to the same website release serving both company URLs:
  common/helpers/NativeGymCompanyScope.php
  frontend/controllers/api/v1/NativeGymController.php

Keep the directory structure and back up the existing controller before replacing it.
Reload PHP/opcache through the hosting control panel if modified files are cached.
There are no database changes and no per-company hardcoded exceptions.

The native API now resolves the company from the requested c...specialcalendar.com
hostname. It then validates the logged-in client's approved, current, client-role
membership for that company. A different saved/primary company cannot choose the
tenant. Existing active client accounts that predate company memberships can use
their own account company only, and only if no explicit membership records exist.
Revoked, rejected, pending, expired, foreign-company and non-client access stays denied.

This server deployment is required for the native API correction to take effect.
Rebuilding the Android APK alone does not install PHP files on the website.
The React Native app folders now use identical source, without the FTX-only web fallback.

Local verification:
  php -d extension=pdo_sqlite -d extension=sqlite3 tests/native-gym-company-scope.test.php PATH_TO_YII_REPO
  node --test tests/native-gym-startup.test.cjs tests/app-domains.test.cjs
  npm run check:shared

After deployment, sign in to each company app and use Try again (or relaunch).
Confirm native bookings, pass, sessions and timer follow that company's settings.
An actual revoked or expired membership should still be denied.
