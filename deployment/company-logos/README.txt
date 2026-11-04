Separate company logos

Source of truth: C:\inetpub\wwwroot\workspace
All included PHP changes were implemented in that workspace.

Hosting deployment:
1. Back up the corresponding files and database.
2. Upload these folders into the Yii application root, preserving paths.
3. From that application root run:
   php yii migrate/up --migrationPath=@console/migrations/company-branding --interactive=0
   This runs only the company-branding migration, not other pending migrations.
4. Open /company. Choose a Desktop logo and/or Mobile app logo, then save.

Desktop logo controls website/sidebar branding. Mobile app logo controls app headers.
Without a separate mobile logo, the desktop logo is used. Select 'Use desktop logo in app' to reset it.
These settings do not change installed launcher icons or OS splash-screen assets.

The local database migration has already been applied. Hosting still needs the migration.
The native admin header requires the updated JavaScript in this mobile workspace to be published/installed.
Client headers already use the logo delivered by the server snapshot.
No EAS build or update was started for this change. A signed-in phone test remains required after deployment.
