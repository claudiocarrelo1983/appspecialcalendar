Upload common and frontend to the website root, preserving paths. Includes V7 notification retention fixes.

NEW REGISTRATIONS: Gym public signup creates User status 8 (awaiting admin approval), not active status 10. Existing approved accounts are unchanged. Non-gym signup behavior is preserved.
Admin: Clients -> Registration waiting list (/clients-list/waiting-list). Each card has POST/CSRF protected Approve and Delete buttons with confirmation. Only admin accounts can decide, only for their active company, only while the account remains pending. Delete disables the pending account; no existing approved account is deleted.

INVITATIONS: Sending/reading a notification never books a class. Native schedule now queries the signed-in recipient's exact company/schedule/date booking and returns booking evidence. Cancelled/inactive bookings cannot produce a checked invitation. Real existing bookings remain checked. The corresponding React Native validation change is in both FTX and Demo; publish an OTA update after uploading these server files. No native build is required for these JavaScript changes.

Translations and required translation catalog dependencies are included. No database migration or production data backfill. Local tests use synthetic records; signed-in physical-phone verification remains necessary.
V9: One recipient row per notification before inbox pagination, unread counts and native notification feeds. Read/unread synchronizes duplicate legacy delivery rows. No records are deleted; distinct notification IDs remain distinct. This server deduplication correction does not require an Expo build or OTA.
