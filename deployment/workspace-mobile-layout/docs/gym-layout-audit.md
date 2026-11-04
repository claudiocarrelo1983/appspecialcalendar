# Gym mobile-style workspace layout audit

Authoritative source: `C:/inetpub/wwwroot/workspace`.

Both menu files remain unchanged. The shared layout applies to each menu route and its descendant Create, Update/Edit, and View screens. Existing actions are listed below; the audit does not create actions or grant permissions.

Admin, admin-mobile, and main layouts register the same scoped layout asset and canonical heading. Authentication, maintenance, public responses, calendar controls, complex tables, POST forms, and existing permission checks retain their own behavior.

| Menu | Route | Existing standard controller methods |
|---|---|---|
| gym-all | `/dashboard-gym` | index |
| gym-all | `/clients-list` | index, create, update, view |
| gym-all | `/memberships` | index, create, update, view |
| gym-all | `/gym-attendance` | index, create, update, view |
| gym-all | `/waivers` | index, create, update, view |
| gym-all | `/members-debts` | index, create, update, view |
| gym-all | `/classes-schedule` | index, view |
| gym-all | `/gym-classes` | index, create, update, view |
| gym-all | `/personal-classes` | index, create, update, view |
| gym-all | `/company-locations` | index, create, update, view |
| gym-all | `/gym-classes-rooms` | index, create, update, view |
| gym-all | `/gym-classes-categories` | index, create, update, view |
| gym-all | `/team-members` | index, create, update, view |
| gym-all | `/task-operations` | index, create, update, view |
| gym-all | `/vacations` | index, create, update, view |
| gym-all | `/permissions` | index, create, update, view |
| gym-all | `/hotel-clock` | index |
| gym-all | `/shift-planner` | index |
| gym-all | `/performance-dashboard` | index |
| gym-all | `/fitness-assessments` | index, create, update, view |
| gym-all | `/body-measurements` | index, create, update, view |
| gym-all | `/fitness-goals` | index, create, update, view |
| gym-all | `/personal-records` | index, create, update, view |
| gym-all | `/progress-photos` | index, create, update, view |
| gym-all | `/performance-messages` | index |
| gym-all | `/performance-reports` | index |
| gym-all | `/events-list` | index, create, update, view |
| gym-all | `/event-clients` | index, update |
| gym-all | `/challenges` | index, create, update, view |
| gym-all | `/competitions` | index, create, update, view |
| gym-all | `/revenue-reports` | index |
| gym-all | `/membership-reports` | index |
| gym-all | `/attendance-reports` | index |
| gym-all | `/coach-performance` | index |
| gym-all | `/workout-timer` | index, create, update, view |
| gym-all | `/gym-sessions` | index |
| gym-all | `/company` | index, update |
| gym-all | `/payments-setup` | index |
| gym-all | `/my-plan` | index, create, update, view |
| gym-all | `/profile` | index |
| gym-all | `/legal-documents` | index |
| gym-client | `/dashboard-gym-client` | index |
| gym-client | `/personal-classes-client` | index, create, update, view |
| gym-client | `/report-client` | index |
| gym-client | `/performance-dashboard-client` | index |
| gym-client | `/fitness-assessments-client` | index, create, update, view |
| gym-client | `/body-measurements-client` | index, create, update, view |
| gym-client | `/personal-records-client` | index, create, update, view |
| gym-client | `/progress-photos-client` | index, create, update, view |
| gym-client | `/fitness-goals-client` | index, create, update, view |
| gym-client | `/performance-reports-client` | index |
| gym-client | `/profile` | index |
| gym-client | `/workout-timer` | index, create, update, view |
| gym-client | `/gym-sessions` | index |
| gym-client | `/client-settings` | index |

55 menu links and 346 controller, route-variant, layout and asset checks passed.

Presentation tests additionally cover original form inputs/IDs/GET parameters, bidirectional search synchronization, visible validation errors, preserved rich-content headings, action links, checkbox selections, sorting headers, POST/calendar/dialog exclusions, and idempotent enhancement.

This is structural and regression verification, not a signed-in visual test of every production record. No live data, permissions, controller logic, database schema or menu destinations are changed by this audit.
