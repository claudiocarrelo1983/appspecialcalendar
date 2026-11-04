Class invitation search correction v2

For a website where the original class-invitations.zip is already installed,
replace only these two files, preserving their paths:
common/helpers/ClassInvitations.php
frontend/controllers/ClassInvitationsController.php

Search now includes full_name, first_name, last_name and username, supports
multiple name parts, and displays first + last name when full_name is blank.
FTX/Demo app domains select their own company before authorizing the sender,
instead of using another company left selected in the account session.
Active-account, approved membership, client role and sender exclusion rules
remain in force. Accounts that cannot receive an app invitation are excluded.

No app build or EAS Update is required for these server search corrections.
After upload, close/reopen Share and type at least two letters of a client name.
GET /class-invitations/recipients?q=NAME while signed in uses the same search;
the response header X-SC-Class-Invitations: search-v2 identifies this revision.
Do not share cookies, tokens or full client lists when reporting a problem.

Validated locally against an isolated SQLite database: split names, combined
names, FTX host with a different session company, other-company exclusion,
inactive exclusion, clients/coaches sending, duplicate retries and scope checks.
Live hosting and the signed-in physical phone have not been verified.
