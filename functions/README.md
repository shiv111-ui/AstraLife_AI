# Trusted emergency dispatch

The callable functions in `index.js` use the Admin SDK through the Cloud
Functions runtime identity. Do not add a service-account key to this project or
to client environment variables.

## Required Firebase setup before deployment

1. Enable the **Anonymous** sign-in provider in Firebase Authentication. Patient
SOS uses an anonymous Firebase identity so Firestore can authorize reads of
that patient's own emergency document.
2. Register a reCAPTCHA v3 site in the reCAPTCHA admin console, allow each
production hostname and `localhost`, then register the web app in
**Firebase Console → App Check** with that site's public site key. Set the
site key as `VITE_FIREBASE_APPCHECK_SITE_KEY` in the frontend build
environment. Keep the reCAPTCHA secret key in the reCAPTCHA provider console;
it does not belong in Vite variables. Add `localhost` to Firebase
Authentication's authorized domains for local anonymous sign-in; provider
domain entries use the hostname `localhost` (the `:5173` port is not part of
that entry). Add each production host to Authentication's authorized domains
as well. The callable functions enforce App Check.
3. Install the Functions dependencies with `npm install` from this directory.
4. Review `../firestore.rules` against the live Staff and resource documents.
Deploy rules and Functions only through an explicitly approved release
process. The repository contains no deployment credentials.

### Local App Check debug token

Local development can use Firebase's App Check debug token with the same
reCAPTCHA v3 site key. Keep the setting in the ignored `.env.local` file in
the project root; never commit the generated token:

```dotenv
VITE_FIREBASE_APPCHECK_SITE_KEY=your-recaptcha-v3-site-key
VITE_FIREBASE_APPCHECK_DEBUG_TOKEN=true
```

Start the Vite server on `http://localhost:5173` and inspect the browser
console for Firebase's generated debug token. In Firebase Console, open
**App Check → your web app → Manage debug tokens**, register that token, then
put the registered value in `.env.local` as
`VITE_FIREBASE_APPCHECK_DEBUG_TOKEN=your-registered-debug-token` and restart
Vite. Treat the value like a secret: don't paste it into source files, commits,
screenshots, or issue reports. Debug-token activation is gated to Vite dev mode
on `localhost` or `127.0.0.1`; production builds cannot enable it through this
setting. The actual reCAPTCHA v3 provider must still be initialized, and
`submitPatientSOS` continues to require App Check.

Functions are configured for `asia-south1` and Node.js 22. `submitPatientSOS`
creates a deterministic, patient-scoped emergency document and attempts
transactional assignment. Existing hospital records do not currently contain
verified coordinates or an explicit emergency-acceptance field, so automatic
hospital matching intentionally leaves cases awaiting control-room review.
Manual control-room assignment still reserves the actual
`bed_availability` counts transactionally.

Pure validation and capacity helper tests can be run with `npm test` from this
directory. Firestore rules and transaction contention still require emulator
and deployed-project testing before release.
