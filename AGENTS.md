# Company mobile apps

- The user wants to avoid spending Expo build credits. Do not start an EAS cloud build unless the user explicitly requests a cloud build. Local validation does not authorize a cloud build.
- Prefer local tests, company-profile/source-parity checks, bundle exports, visual previews, and local Android compilation.
- Keep FTX and Demo on the same React Native implementation. Only company identity, branding, and URLs differ.
- Report separately what was verified locally and what still requires a signed-in physical phone. A sample-data preview is not a live-device test.
