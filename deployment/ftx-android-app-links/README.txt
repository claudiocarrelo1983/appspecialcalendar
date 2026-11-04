FTX Android class links

Cause confirmed on 30 October 2026:
https://c20260531125358085.specialcalendar.com/.well-known/assetlinks.json
returns HTTP 200 with [], so Android cannot associate this domain with FTX.

Upload .well-known/assetlinks.json to the DOCUMENT ROOT serving
c20260531125358085.specialcalendar.com. Preserve the .well-known folder.
For a Yii installation the public document root is normally frontend/web;
use the actual hosting document root for this company domain.
Do not put this file in frontend/controllers or common/helpers.

After upload, the URL above must return the JSON in this package (not []),
with HTTP 200 and Content-Type application/json, without a login or redirect.
If the Yii route continues returning [], configure the host to serve this
static file at the exact URL before routing the request into Yii.

The public signing-certificate SHA-256 was extracted from and verified
against the existing Expo preview-ftx Android build 25, package com.ftxteam.app.
No private key is included. An APK signed with a different key requires
its own certificate fingerprint. Google Play App Signing may use another key.

After the server file is live, enable Android Settings > Apps > FTX Team >
Open by default > Open supported links. Wording varies by Android version.
Android may need to re-verify the domain. With the phone connected via ADB:
adb shell pm verify-app-links --re-verify com.ftxteam.app
adb shell pm get-app-links com.ftxteam.app
The FTX company domain should show verified. Verification is asynchronous.
Alternatively reinstall the same Expo-signed FTX APK after publishing the file;
uninstalling first removes the app's local data and saved sign-in.

Tap an actual shared class link in another app, such as WhatsApp.
Typing/pasting a URL in a browser address bar is not an App Link tap test.
The shared link preserves company_code, date, schedule_id and routes to
/dashboard-gym-client/index. The recipient signs in if needed and confirms
their own booking. Without FTX installed, the website is the fallback.

Prepared locally only: nothing was uploaded to hosting and no phone was tested.
No EAS cloud build or update was started.
