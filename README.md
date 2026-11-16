# HelloEarth

HelloEarth is a mobile-friendly workspace for independent tutors, deployed through GitHub Pages at https://helloearth.co.za.

## Teaching dashboard

- **Overview / My Teaching Day:** Visible-week appointments from Google Calendar, plus student profile and plan shortcuts when an event can be matched to a student. Title-only matches are marked as possible matches.
- **Calendar:** Read all authorized calendars, select calendars, view appointments, and create Google events on writable calendars after explicit approval.
- **Students:** Private CEFR profile data, lesson notes, strengths, challenges, optional homework and next steps.
- **Lesson planner:** Editable, rule-based templates informed by student goals and previous notes; saved plans are scoped to the tutor account. These are not AI-generated.
- **Progress:** Historical 1–5 tutor ratings for speaking, listening, reading, writing, grammar and confidence, plus Print → Save as PDF reports.
- **Import:** Legacy JSON, or CSV/XLSX with column matching, duplicate-name skipping, and confirmation. ExcelJS 4.4.0 loads on demand for XLSX. Source files are not uploaded to GitHub.
- **Atlas AI:** In development; AI and transcription are not live.

## Google Calendar setup

1. Enable the Google Calendar API in your existing Google Cloud project.
2. Add the scopes https://www.googleapis.com/auth/calendar.readonly and https://www.googleapis.com/auth/calendar.events under Google Auth Platform → Data Access.
3. If your OAuth app is in Testing mode, allow the Google account under Test users.
4. Keep the Google OAuth redirect URI set to the Supabase auth callback and allow https://helloearth.co.za/dashboard.html?calendar=connected in Supabase redirect URLs.
5. On Dashboard → Calendar, choose Authorize scheduling and approve the event-editing scope, then use + Schedule appointment.

Access tokens are temporary and stored only in the browser tab's session. You may need to reconnect after expiry. The existing login-based Google OAuth may switch your HelloEarth identity if you choose a different Google account; the dashboard detects a mismatch. A truly independent, persistent Calendar connection requires further development. Disconnect Calendar only hides events within HelloEarth; revoke Google permissions separately in Google Account settings.

## Database and privacy

The applied SQL is documented at database/teaching-features-setup.sql. It creates atlas_skill_assessments with RLS and adds optional homework to atlas_lesson_notes, retaining the existing student ownership and plan quota rules.

Never put student data, private calendar events, OAuth tokens or Supabase secrets in GitHub. The site uses a public publishable key and authenticated RLS-scoped database queries. Do not record or transcribe students without appropriate consent.

## Development

Serve these HTML, CSS and JavaScript modules over HTTP locally or through GitHub Pages. The dashboard uses Supabase authentication and Google Calendar APIs; both require corresponding project configuration.
