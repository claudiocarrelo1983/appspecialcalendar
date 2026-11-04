Class reminder tap fix

Implemented directly in C:\inetpub\wwwroot\workspace.
Upload common/helpers/ClassReminderService.php into the live Yii application root, preserving this path.
No database migration is needed.

Reminder redirects retain authorized date and schedule links for in-progress and finished classes.
This does not authorize booking after its cutoff or expose unavailable/cancelled classes.
The mobile source also waits for the requested schedule date before opening the class details popup.
Publish/install the updated mobile JavaScript for Demo and FTX after uploading the server helper.
No app update or cloud build was started for this fix.

Locally verified: reminder state regression test, mobile tests, shared company source parity and Android/iOS exports.
A signed-in physical device reminder tap remains to be tested on live hosting.
