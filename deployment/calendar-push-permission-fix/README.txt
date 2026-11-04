Calendar push/permission fix

Canonical website file already updated:
C:\inetpub\wwwroot\workspace\frontend\web\js\gym-class-share.js

Upload frontend/web/js/gym-class-share.js to the matching live website path.
This preserves normal browser behavior. The embedded app bridge sends a calendar request only after a trusted user click.

Also distribute the matching app JavaScript changes to BOTH FTX and Demo. No new native dependency or runtime change was added. This package contains only the website asset; uploading it alone does not update installed app code. Publish only to compatible installed app runtimes.

App changes: reject calendar bridge messages without a recent explicit action; route push calendar-export links to the dashboard; show distinct PT/EN calendar errors and an explicit Open settings button for denied permission. The actual triggering push payload was unavailable, so the original device issue is not yet reproduced.

Device checks still required: tap a class reminder with Calendar permission denied; it should open notification information without a calendar prompt. Separately tap Add to calendar, deny access, verify the permission message and Settings button. Grant permission and verify adding still works. Check Android and iPhone, signed in, for both companies.

No cloud build or OTA update was published for this change.