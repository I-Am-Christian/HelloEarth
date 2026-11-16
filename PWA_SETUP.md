# Installing HelloEarth as an app

HelloEarth includes a standards-based web app manifest. It can be added to the home screen or desktop on supported browsers, and opens directly in the tutor dashboard in an app-style window. A tutor without an active session will be sent to the normal login flow.

## Install

- **Android / Chrome:** Visit https://helloearth.co.za, open the browser menu, then choose **Install app** or **Add to Home screen** (the wording varies).
- **iPhone / iPad / Safari:** Open https://helloearth.co.za in Safari, use **Share**, then **Add to Home Screen**.
- **Windows / macOS / Chrome or Edge:** Open https://helloearth.co.za and choose **Install** from the browser menu or address-bar install option if available.

Installation availability depends on browser/operating system support. The website continues to work normally in a browser.

## Safety and current limitations

- **Online-only:** Student records and calendar data still require an internet connection. This change intentionally does **not** register a service worker, cache authenticated pages, cache Google Calendar responses, or store student records offline.
- **No native app yet:** This is an installable web app, not an Android APK, iOS App Store release, or desktop executable.
- **Logins:** Existing Supabase sign-in, Google OAuth and Calendar authorization continue to apply. A web-app installation does not extend Google token lifetime.
- **Icons:** The web app reuses the existing HelloEarth SVG and PNG artwork. Browser icon selection and install prompts vary by platform.

## Quick smoke test

1. Check that https://helloearth.co.za/site.webmanifest returns valid JSON and that the start URL points to `/dashboard.html`.
2. Visit https://helloearth.co.za on Android Chrome and Safari on iOS and try the platform install flow.
3. Launch the installed app as a signed-out user and confirm it navigates to login.
4. Sign in and check student profiles and Google Calendar still work after navigating back to the dashboard.
5. Verify mobile rocket interaction remains functional on the homepage.

No student data, OAuth secrets or API keys are included in the manifest.
