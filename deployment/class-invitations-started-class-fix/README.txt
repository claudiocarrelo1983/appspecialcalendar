Clear error for class invitations after the class has started

Replace these two live server files, preserving their paths:
common/helpers/ClassInvitations.php
frontend/controllers/ClassInvitationsController.php

This patch includes the current company-host and split-name search fixes.
The server keeps blocking invitations to classes that have already started,
using the server's Europe/Lisbon clock and the occurrence's actual start time.
The Send endpoint returns HTTP 409 JSON with reason=class_started.
No notification is created and no push is sent for that rejected request.
Other invalid requests, permissions and CSRF checks retain their own status.

Publish the latest mobile source through EAS Update to the installed app's
channel and matching runtime. FTX preview APKs use ftx-preview; FTX production
builds use ftx-production. No new native module or cloud build is required.
Both server upload and the app update are needed for the new message.

English: This class has already started. Choose an upcoming class.
Portuguese: Esta aula ja comecou. Escolha uma aula futura.

Verified locally: controller JSON rejection, no stored invitation for a past
class, preserved error reason through the native bridge, and one localized
popup error. Hosting and signed-in physical phones have not been tested.
