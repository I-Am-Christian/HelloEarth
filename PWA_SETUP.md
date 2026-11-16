# HelloEarth app and notifications

The app is the existing HelloEarth website installed as a PWA, not a separate native interface. The website runs on GitHub Pages and the signed-in tutor's data stays in Supabase.

## Install

- **iPhone/iPad (iOS/iPadOS 16.4+):** Open https://helloearth.co.za in Safari, choose Share → Add to Home Screen, then open the installed HelloEarth icon.
- **Android / Chrome:** Open https://helloearth.co.za, choose Install app from the browser menu.
- **Desktop / Chrome or Edge:** Open https://helloearth.co.za and use the browser's Install option, if supported.

## Notifications

In the dashboard **Calendar** tab, tap **Enable notifications** and approve the device permission. On iPhone you need to do this inside the installed Home Screen app. The **Send test notification** button verifies this device's push service. **Turn off notifications** unsubscribes this device and clears its tutor account's pending reminders. Signing out also disables this device's subscription.

While notification opt-in is active, loading a week in connected Google Calendar queues reminders for that displayed week. The queue stores ONLY a keyed SHA-256 digest of the calendar/event identifier and the start/notification timestamps; no appointment titles, student names, private notes, Google tokens, descriptions or event URLs. Reminders are sent approximately 15 minutes before timed events. All-day events are excluded. If the browser never loads a future week, there is no reminder for events from that week. The app does not silently fetch the Google calendar in the background, because provider tokens are short-lived.

A Supabase Edge Function validates the user's account for subscription, testing, and reminder synchronization. It sends encrypted standards-based Web Push messages with VAPID, supported by Chromium, Firefox and installed iOS Web Apps. A pg_cron job invokes the dispatcher every minute using a separate secret stored exclusively in Supabase. The service worker handles incoming notifications; it **never** intercepts network requests or caches private content. Notifications show generic text only. No client or VAPID private secrets are stored in GitHub.

**Important:** A notification can be late, lost or blocked by a browser, OS, battery optimization, permission revocation, or connectivity issue. This is not a guaranteed alarm service. Google Calendar changes are reflected only when the matching calendar week is next loaded or refreshed. This release supports one signed-in account and up to 5 push devices per account.

## Tests

1. Confirm /site.webmanifest and /notification-sw.js return successfully over HTTPS.
2. Open installed app, sign in, and enable notifications in Calendar.
3. Press Send test notification; the device should receive "Notifications are working on this device."
4. Connect Google Calendar and load an upcoming week, noting the queued event count.
5. Leave the app closed until 15 minutes before a test appointment; verify generic reminder.
6. Turn off notifications, then confirm no further reminders.
7. Sign out and make sure that device stops receiving pushes.

## Developer components

- `notifications.js` (opt-in, device subscription, calendar queue, test)
- `notifications.css` (dashboard controls)
- `notification-sw.js` (push handling without caching)
- `pwa-register.js` (worker registration on home page)
- Supabase Edge Function `helloearth-notifications` (deployed, non-JWT platform check; its own bearer validation and dispatch-secret check)
- SQL tables: `helloearth_push_config`, `helloearth_push_subscriptions`, `helloearth_lesson_reminders` (RLS on; client roles denied)
- Cron job: `helloearth-lesson-push-every-minute`
