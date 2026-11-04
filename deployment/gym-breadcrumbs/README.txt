Gym workspace breadcrumb/header update

The authoritative files have already been changed in C:/inetpub/wwwroot/workspace.
This archive is copied from that workspace, preserving hosting paths.

Coverage: all 55 links in gym-all.json and gym-client.json, related Index,
Create, Update/Edit and View pages, and existing personal-class/report/health aliases.
Structure: company-colored icon tile, small category/navigation ancestry above
one page title. CRUD headings link back to their menu page. Existing view titles,
forms, action buttons, permissions and controller business rules are retained.
The three frontend layouts (admin, admin-mobile, main) supply the heading once.
English and Portuguese account-category labels are included.

Upload the nine files with their relative paths to apply this to live hosting.
No database migration, Expo cloud build or native dependency is required.
Do not replace either menu JSON; both menus remain the source of route metadata.

Validation: scripts/test-gym-breadcrumbs.php against actual workspace source:
55 menu links and 1003 route/action/alias/rendering/escaping checks passed.
Changed PHP files passed syntax checks. No signed-in live-hosting visual test
or hosting upload was performed.
