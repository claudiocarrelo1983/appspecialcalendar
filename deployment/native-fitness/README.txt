NATIVE FITNESS RELEASE — Demo and FTX

Implementation
- Shared native My calendar menu for client/admin/team. Lists only event IDs created and tracked by this app for the current account. View event date/title; delete after confirmation. Deleting a phone event never cancels a class booking. Pre-feature calendar events have no ownership registry and are not imported automatically.
- Updated timer UI: clear phase/round display, offline state restore, expandable local workout history, explicit Apple Health save action.
- Native vibration at foreground interval transitions; OS-scheduled audible/vibrating set and completion notifications. New interval sessions support 1–30 sets to keep the alert queue bounded. Android asks for precise Alarms & reminders permission; notification and sound permissions are also required.
- iPhone Live Activity / Dynamic Island extension shows running, paused and elapsed/countdown progress using system clocks. Labels use the app language. User-disabled Live Activities cannot be overridden.
- Durable per-account local workout history, deduplicated upload retries and retrieval of recent cloud history while signed in. Offline tools remain accessible after a previously signed-in launch fails to connect. Signing out removes the offline account shortcut but does not delete recorded cloud/local workout history.
- Apple Health workout writing is requested only after the user chooses Save to Apple Health. Only timer duration/activity is saved; calories, heart rate and distance are not invented. Sync identifiers protect retries from duplicating Health workouts.

Server deployment — source of truth C:\inetpub\wwwroot\workspace
1. Upload the common, frontend and console folders in native-fitness.zip into the live Yii application root, preserving paths.
2. Run from that application root:
   php yii migrate/up --migrationPath=@console/migrations/native-fitness --interactive=0
3. This migration has ALREADY been applied to the local workspace database; live hosting still needs it.
4. The endpoint uses Yii session authentication, normal CSRF protection and server-side company/user ownership checks. /native-workouts/sync rejects an owner key that does not match the current signed-in identity. Retry keys are unique per company, user and workout.

Mobile release
The new runtime suffix is -fitness2. Existing signed binaries are deliberately excluded from these native changes.
New signed Android and iOS builds are required for both companies. Do not use an OTA update as a substitute for rebuilding these native permissions/modules/extensions.
The WorkoutProgress app extension has a separate company bundle identifier and will need matching signing/provisioning when building iOS.
No Expo cloud build, App Store submission or OTA publication was started for this implementation.

Local validation
- Full mobile regression suite, shared company configuration/source checks and Android/iOS JS bundle exports.
- Android native module compileDebugKotlin with installed SDK.
- Live Activity Xcode target generated against Expo's bundled template, including sources, embedding, company bundle identifiers and build versions; duplicate plugin runs do not duplicate targets.
- SQLite server migration, idempotent retries, company/user storage separation and input validation.
- Sample preview is a browser mock, not a real Calendar/HealthKit/notification/Live Activity test.

Required signed-device release checks
- iOS: compile the signed extension on macOS/EAS; test Live Activity running/paused/resumed/finished, Lock Screen and Dynamic Island.
- iOS: allow/deny Health writing; save twice/retry and verify a single correct-duration workout appears in Health.
- iOS and Android: add a class, reopen My calendar, confirm actual phone event, delete it and confirm booking remains intact. Test permission refusal and another account's registry isolation.
- iOS and Android: run a short 3-set timer with the app active, backgrounded and phone locked; test pause/reset/logout cancellation and phone sound settings. Focus/Do Not Disturb, muted notifications and Android force-stop/power policies can suppress/delay alerts.
- Enable airplane mode, relaunch after a prior sign-in, enter Offline workout timer & history, finish a workout and reopen. Restore connectivity, sign in to the same account and verify synchronization and no duplicates.
- A second signed-in device should retrieve recent cloud history. Switching company/account must never mix histories or calendar entries.

Suggested app description (publish only after the checks above pass)
Book fitness classes, manage your membership and keep track of workouts. Use native workout timers with set alerts, manage classes added to your phone calendar, record workouts offline and synchronize your history when connected. On iPhone, follow your timer on the Lock Screen and choose to save completed workouts to Apple Health.
