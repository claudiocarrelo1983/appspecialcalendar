Fix for HTTP 403 SecurityAccess.php -> GymStaffClock::isGym -> DashboardGymController::actionIndex.
Upload the common and frontend folders into httpdocs, preserving paths. Files are also in C:/inetpub/wwwroot/workspace.
Allows active pre-membership Gym admin/Team accounts to use only their identity-assigned active company.
Explicit membership records (including revoked, rejected, expired and pending) still prevent legacy fallback.
Existing role permissions remain enforced. No database changes or new Expo build are required for this server fix.
