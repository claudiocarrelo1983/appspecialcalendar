Workspace gym mobile-style layout

All production changes are already implemented in C:/inetpub/wwwroot/workspace.
This package is copied from that authoritative workspace; preserve its paths on hosting.

Coverage: gym-all.json and gym-client.json menu pages and their CRUD descendants,
including aliases. Both menus remain unchanged as the source of route metadata.
All three frontend layouts register a scoped GymMobileLayoutAsset.

Presentation: canonical category/icon/title heading, Poppins/Bricolage fonts,
brand-aware buttons and active controls, 20px cards, 48px fields, search/filter
toolbars, responsive form spacing, record tables as labeled cards on small screens,
compact detail views, badges and pagination. Desktop tables remain tables.

Original GET form inputs, IDs and event handlers are retained. Search proxies
submit the actual filter form. POST forms are not rewritten. Dialog forms,
calendar controls, multi-level tables and tables with merged cells are excluded
from structural enhancements. Action links, selections and sorting headers remain.
The CSS/JS apply only within the gym route layout scope; no global observers run.

Validation against actual workspace files:
- 55 menu links, 1003 route/CRUD/alias/rendering/escaping checks passed.
- 5 DOM integration tests for forms, actions, tables, exclusions and repeated enhancement passed.
- Changed PHP layouts, asset and translations passed syntax checks.

Local sample preview: http://127.0.0.1:4173/workspace-layout.html
This preview uses sample data. Signed-in production pages were not visually
verified; no live hosting upload, records, payments or messages were changed.
No database migration, native dependency or EAS build is needed.

Client View consistency update: includes frontend/views/clients-list/view.php. Its executable PHP tokens are unchanged; HTML wrappers provide consistent actions/tabs/details. Shared styling also normalizes embedded-page padding and dialogs. Publish the accompanying React Native update for native frame spacing and to preserve interactive View pages instead of flattening them into read-only tables.


All-pages audit: docs/gym-layout-audit.md lists all 55 menu links. Run php tests/layout/gym-layout-audit.php in the workspace to repeat its 346 controller/route/layout/asset checks. Advanced search now synchronizes both ways, validation errors stay visible, and content/editor headings are no longer hidden by broad page-title rules. These changes are in the workspace first; the ZIP is only a hosting copy.

