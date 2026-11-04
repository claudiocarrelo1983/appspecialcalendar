Same-account login warnings (both devices)

Upload this package to the Yii application root, preserving the paths:
common/helpers/AccountLoginWarnings.php
common/helpers/account-login-warning.js
frontend/components/WebUser.php
frontend/controllers/AccountLoginWarningController.php
console/migrations/account-login-warnings/m261030_150000_account_login_warnings.php

Then run from that application root:
php yii migrate --migrationPath=@console/migrations/account-login-warnings --interactive=0

The migration creates account_login_device (using your configured table prefix).
No existing account table or password is changed. If the migration has not run,
the optional warning feature stays disabled and normal login remains available.

Successful sign-ins from a different browser/app installation warn both that
device and the other signed-in devices belonging to the same account.
Another tab, a remembered login or ordinary app reopen does not create another
warning. Logout removes that device from tracking. Expired devices are ignored.
Same-browser tabs share a device/session and are not separate devices.

The warning appears on the website or as a native app alert. Active screens poll
every 30 seconds and check again when reopened. Closed apps show the warning
when opened again; this package does not send background push messages.
Continue acknowledges the warning only on that device and keeps it signed in.
Log out this device signs out the device showing the warning and returns to login.
The other devices stay signed in. The warning never forces a logout or blocks a login.
Logout is a CSRF-protected POST and checks that the warning still belongs to the
current account/device before signing out. The normal account-menu logout also remains available.
Only user IDs, hashed device identifiers, timestamps and opaque warning IDs are
stored. Passwords, login cookies, IP addresses and push tokens are not recorded.

Both FTX and Demo need the updated mobile build for the native alert handler.
The current local source is updated; nothing has been uploaded to hosting and
the migration has NOT been run against your real database.
