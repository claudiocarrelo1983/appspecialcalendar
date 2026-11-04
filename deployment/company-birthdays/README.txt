Company birthday display update

Upload the ZIP contents to the Yii application root, preserving these paths:
common/helpers/CompanyBirthdays.php
common/helpers/NativeGymCompanyScope.php
frontend/controllers/api/v1/NativeGymController.php
frontend/views/admin/birthdays.php

The controller preserves the existing company-scope-v3 client authentication fix.
The new birthday helper includes all account levels within the current company's
primary/parent/approved access scope. It sends names and day/month only, with
today and isSelf flags. It never publishes another company's birthdays.

The admin website/header and native client endpoint show today's birthdays to
all signed-in company users. The birthday person receives a personal greeting.
Upcoming birthdays remain available for the next seven days.

The native app changes need a new APK. This package does not send push messages
or create a scheduled job. Nothing has been uploaded to your hosting server.
