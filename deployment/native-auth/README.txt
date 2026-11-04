NATIVE AUTHENTICATION — Demo and FTX

Implemented presentation
- Native React Native login, company registration, password recovery and reset-password screens.
- Secure password inputs, native keyboard/autofill hints, show/hide control, searchable native selection sheets, consent checkbox, validation messages and retry states.
- Registration fields and options come from the current company form, including location, date of birth and consent. Hidden CSRF/company controls remain in the backing form.
- Existing Yii password validation, throttling, account approval, session cookies and recovery emails are retained. The WebView remains a hidden session/form transport; authentication screens themselves use native controls.
- Password values are omitted from snapshots and are not saved to SecureStore or logs. Native password input state is cleared after submission.
- Old/stale form revisions cannot submit; hidden web forms do not take keyboard focus. Auth errors show native retry controls rather than exposing an old page.
- Password reset email links use the registered company app host when configured, with a web fallback. Existing reset token validation and expiry rules are unchanged.

Workspace server changes
Source of truth: C:\inetpub\wwwroot\workspace
Upload common, frontend and the included files into the live Yii application root, preserving paths. No auth database migration is needed.
The app association endpoints must remain available without authentication/redirect:
  /.well-known/assetlinks.json -> app-links/android
  /.well-known/apple-app-site-association -> app-links/apple
Existing app registry bundle IDs, signing fingerprints and Apple application IDs are reused; no secrets/configuration files are included in this package.

Mobile release
Shared runtime suffix: -fitness2-auth1.
New signed builds are required for Android's expanded app-link filters and the native fitness changes from the preceding task. Existing installed runtimes will not receive these changes by an OTA update.
No EAS build, submission or OTA publication was started for this task.
The preceding native-fitness server package/migration is still required for workout-history synchronization if it has not been deployed.

Local verification
- Native auth bridge tests cover same-company routing, password redaction, hidden/CSRF preservation, consent, reset-link expiry, stale-form protection, timeout retries and engine-independent literal bridge scripts.
- Real FTX workspace login, gym registration and recovery forms were rendered with empty models and verified against the native schema; no login, account creation or email request was performed.
- Demo uses identical native source/configuration behavior. Its record is not in this local database, so live Demo sign-in/registration was not tested.
- Synthetic server reset tests and company association/reset-link tests.
- Complete mobile regression suite, company profile/source parity and Android/iOS bundle exports.
- Android app-link native configuration generated locally.

Physical phone checks required before production
- Valid/invalid login, password-manager autofill and retry after connection failure on iPhone and Android.
- Company registration: required location, date of birth, username/password and terms consent; verify normal server approval rules and success message.
- Forgot password: known and unknown email responses, then reset through a fresh email link. Confirm the installed correct company app opens it; verify expired and already-used links show the recovery action.
- Logout from both client and admin on iPhone: native sign-in must appear without pass/dashboard flashes or a loading loop.
- Terms/privacy links can open the public website and return to the still-native form. Other pages remain under their existing app navigation.

Sample previews (no account/email requests are sent)
http://127.0.0.1:4173/?app=1&auth=login
http://127.0.0.1:4173/?app=1&auth=register
http://127.0.0.1:4173/?app=1&auth=forgot
