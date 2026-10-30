Company domain configuration for Special Calendar apps

Main configuration: config/app-domains.json in the mobile project.
Each exact company domain has its own appId, projectId, pagecode, title, icon,
splash image and Firebase client file paths. No secret values belong in this file.

Configured companies:
  c20261027151705426.specialcalendar.com -> com.demoteam.app
  c20260531125358085.specialcalendar.com -> com.ftxteam.app

Android installation builds:
  npx eas-cli@latest build --platform android --profile preview-demo
  npx eas-cli@latest build --platform android --profile preview-ftx

Store builds:
  npx eas-cli@latest build --platform android --profile production-demo
  npx eas-cli@latest build --platform android --profile production-ftx
For iOS use --platform ios with the appropriate production profile.
The local iOS Firebase file is currently for com.demoteam.app. Before building
FTX for iOS, supply its own Firebase plist at firebase/ftx/GoogleService-Info.plist
or update that domain's iosGoogleServicesFile to the correct local path.
Expo push on iOS uses APNs; Firebase's plist does not replace the Apple push key.

Native and animated splash screens, WebView URL, booking route, universal links,
package IDs and names now follow the selected domain. Update channels and native
runtime versions are separate per app, even when apps share the same EAS project.
The old preview/production profiles still default to Demo for compatibility.

WEBSITE DEPLOYMENT (required once)
Back up the website files you are replacing. Upload the common/ directory from
this package into the website project root, preserving this structure:
  common/config/mobile-push-domains.json
  common/helpers/MobilePushDomains.php
  common/helpers/MobilePushApps.php
  common/components/MobilePushBootstrap.php
Do not upload or replace params-local.php, database files, signing keys or tokens.
This package preserves explicitly configured legacy app entries and their aliases.
Both the website and reminder worker read the same domain registry. The existing
reminder worker schedule does not change. No database migration is required.

Only each entry's exact HTTPS origin is accepted. App ID, EAS project, active
company and authenticated company access are still validated. Unknown domains and
cross-company registrations are rejected. An app ID cannot be reassigned to a
different company by adding another domain entry.

Optional server overrides:
  Yii params['mobilePushDomains'] (array), or MOBILE_PUSH_DOMAINS_JSON (JSON).
Precedence: Yii params, then the environment variable, then the JSON file.
Credential environment variable NAMES can be configured per domain with
accessTokenEnv. Both current entries share an EAS project and reuse its existing
EXPO_ACCESS_TOKEN_FTX variable. Keep actual credentials on the server/EAS only.

After uploading, both read-only checks must return HTTP 200 when logged out:
https://c20261027151705426.specialcalendar.com/mobile-notifications/context?appId=com.demoteam.app&projectId=2c8e7c35-68dc-40c6-b7ea-461f61de6c93
https://c20260531125358085.specialcalendar.com/mobile-notifications/context?appId=com.ftxteam.app&projectId=2c8e7c35-68dc-40c6-b7ea-461f61de6c93
Expected JSON: {"authenticated":false}. Reopen each app and log in after deployment
to register its device. Credentials and an active sender/worker are still needed
for real delivery; registering a Firebase app alone does not enable server pushes.

ADDING ANOTHER COMPANY
1. Add an entry keyed by its exact domain in config/app-domains.json. Use a unique
   app ID, the actual company pagecode, EAS project, title and local asset paths.
2. Add its splash image as a literal require in src/utils/companyBranding.js so
   Metro can bundle the image. Add its Firebase Android/iOS client configuration
   locally. Android client files must contain the matching package; iOS files must
   match the bundle identifier. Keep these client config files out of Git.
3. Add named EAS profiles extending preview/production with APP_DOMAIN and
   EXPO_PUBLIC_SITE_URL set to the company domain. Give each app its own channels.
4. Run npm run prepare:domains. This refreshes the server JSON from the same
   master configuration. Upload that JSON to common/config/mobile-push-domains.json
   on the website. Future domains need no registration/controller code changes.
5. Configure FCM V1/APNs credentials for the new identifier in EAS and build its
   profile. Test the context endpoint, then permission, registration and delivery.

Local backend checks (run from the website project root):
  php scripts/mobile_push_domains_test.php
  php scripts/mobile_push_backend_test.php
The domain test uses isolated SQLite fixtures, never sends a push, and does not
touch the live database. Enable PDO SQLite in the test PHP runtime if needed.

This package is prepared locally. It has not been uploaded to the live website.
