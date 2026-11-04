Desktop website / mobile app login separation

Source of truth: C:\inetpub\wwwroot\workspace.
Only SiteController.php changes server behavior in this package.
Upload frontend/controllers/SiteController.php to the same path in the live Yii application.
No login view, logo, CSS, JavaScript website asset or database migration is included.

- Standard POST logout on specialcalendar.com and www.specialcalendar.com returns to /login,
  independently of the user's gym membership or a logout_context field.
- Existing company-subdomain logout and login-mobile flows remain separate.
- The native app authentication guard accepts only its configured HTTPS company subdomain;
  specialcalendar.com/login?pagecode=... is never a native authentication target.
- The native guard change is synchronized to FTX and Demo, and is not an uploaded PHP change.

Validated locally: isolated account-switch/logout regressions and PHP lint, mobile regression
suite, company source parity, Android/iOS bundle exports.
Live desktop login/logout and signed-in phones still require verification after deployment.
No server upload, EAS Update or cloud build was performed by this fix.
