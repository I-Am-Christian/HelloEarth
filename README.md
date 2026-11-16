# HelloEarth

**HelloEarth** is a responsive, space-themed tutoring-workspace website, hosted on GitHub Pages at https://helloearth.co.za. Data is stored privately in Supabase and is scoped to the logged-in tutor.

## Current dashboard features

- **Overview / My Teaching Day:** Google Calendar appointments in the currently loaded week, optional student-name matching, and quick links to a student's profile and lesson preparation. Unmatched calendar events do not automatically become students.
- **Students:** Profiles for goals, CEFR level, interests, strengths, improvement areas, current homework, teaching preferences and lesson history. Private notes and editable details.
- **Lesson planning:** Creates editable **template-based** draft lessons using the student profile and existing notes. Plans can be saved to the tutor's Supabase account and downloaded in Markdown. This is not an AI model.
- **Progress:** Tutor-recorded speaking, listening, reading, writing, grammar and confidence ratings over time; CEFR-level distribution; manual attendance tracking; printable progress report (browser Print / Save PDF).
- **Imports:** JSON v1 student import, plus CSV and .xlsx import. Recognizes common column headings, previews the first five students before confirmation, skips duplicate names, and does not upload the original spreadsheet to a separate conversion service. Template available in the Students tab. Files are limited to 2 MB and 250 rows per import.
- **Google Calendar:** User-initiated connection, account identification, multiple-calendar reading, selection, and weekly agenda. Appointment creation uses a **separately approved** Google event-editing scope. Scheduling writes directly to the selected Google Calendar; it does not automatically mark attendance. Short-lived Google access tokens are cached per tutor in browser local storage for up to approximately 45 minutes so reloads and browser restarts do not immediately forget a valid Calendar permission. On expiry or revocation, the linked email remains visible with a reconnect prompt. Google refresh tokens are **not** stored in browser storage; long-term automatic renewal requires a server-side encrypted token vault with Google's offline access flow.
- **Atlas AI:** Informational placeholder. AI lesson inference and optional transcription are not launched.

## Google Calendar setup

1. In Google Cloud, enable **Google Calendar API** in the same OAuth project as your Supabase Google sign-in.
2. Add these scopes under **Google Auth Platform → Data Access**:
   - Read access: `https://www.googleapis.com/auth/calendar.readonly`
   - For tutors explicitly authorizing event scheduling: `https://www.googleapis.com/auth/calendar.events`
3. In Google Cloud OAuth client credentials, keep the authorized redirect URI:
   `https://paziklvunckkmgrfmbhm.supabase.co/auth/v1/callback`
4. In Supabase Auth URL Configuration, allow `https://helloearth.co.za/dashboard.html?calendar=connected`.
5. In the dashboard, use **Connect Google Calendar** for read-only access. Choose **Authorize scheduling** to consent separately to creating events.

Google's unverified/Testing OAuth clients may only work for added test users and access can expire. Google Calendar synchronization after a browser or token expires is **not** a background service. Connecting an unrelated Google account to an existing Supabase account is not yet isolated from the HelloEarth login identity and should be treated cautiously.

## Security

Supabase enforces row-level security (RLS) for private student profiles, lesson notes, saved lesson plans, skill assessments and attendance. Code belongs in GitHub; **student records and calendar event contents do not**. No Supabase service-role key or Google client secret is included in public frontend files. Only record learner information you have permission to hold, and follow relevant laws on children's data.

## Development

The site uses static HTML/CSS/JS. Key files:

- `index.html`, `style.css`, `script.js`: public site.
- `dashboard.html`, `dashboard.js`: authenticated student workspace.
- `dashboard-navigation.js`: navigation, Google Calendar OAuth, reading and scheduling.
- `dashboard-features.js`, `dashboard-features.css`: teaching-day summaries, plans, progress, imports.
- `supabase-client.js`: common Supabase client with persisted authentication.

Subscription billing and hosted Atlas AI remain planned, not released.
