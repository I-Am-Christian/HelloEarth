# HelloEarth — Supabase Auth setup

The public client is configured for **Hello Earth DB**
(`paziklvunckkmgrfmbhm`).

The publishable key in `supabase-config.js` is intentionally public and must
be used ONLY with Supabase Auth user sessions and verified RLS. Never commit
a service_role key, database password, or Google client secret.

## Site pages

- https://helloearth.co.za/login.html
- https://helloearth.co.za/register.html
- https://helloearth.co.za/dashboard.html
- https://helloearth.co.za/reset-password.html

## Supabase Auth > URL Configuration

In https://supabase.com/dashboard/project/paziklvunckkmgrfmbhm/auth/url-configuration:

- **Site URL:** `https://helloearth.co.za`
- **Additional redirect URLs:**
  - `https://helloearth.co.za/dashboard.html`
  - `https://helloearth.co.za/reset-password.html`

If you use www or local development domains, add ONLY the exact domains
and callback pages that you intentionally control.

## Enable Google sign-in

Google OAuth provider credentials **cannot be created automatically from
website code**. To enable the Google button:

1. In https://console.cloud.google.com/auth/overview, create/configure a
   Google Auth Platform project and its OAuth consent screen. Set audience,
   branding, contact and requested scopes appropriately.
2. Create an OAuth **Web application** client ID.
3. **Authorized JavaScript origin:** `https://helloearth.co.za`
4. **Authorized redirect URI:**
   `https://paziklvunckkmgrfmbhm.supabase.co/auth/v1/callback`
5. Enter the Google **Client ID** and **Client secret** only in:
   https://supabase.com/dashboard/project/paziklvunckkmgrfmbhm/auth/providers
   under **Google**. Enable and save.
6. Do not place the Google client secret in any GitHub file.
7. Verify Google OAuth end-to-end with your own account, then with a separate
   test account to confirm RLS student isolation.

Official documentation: https://supabase.com/docs/guides/auth/social-sign-in/auth-google

## Registration and password recovery

Supabase Auth email/password signup is implemented. Email confirmation
depends on the project Auth configuration. Ensure the built-in email
confirmation and redirect allowlist are correct. Supabase's default email
sending is intended for low-volume testing; configure your own SMTP before
public production.

Password recovery emails redirect to
`https://helloearth.co.za/reset-password.html`.

## Security and private student imports

Database tables: `atlas_students`, `atlas_lesson_notes`,
`atlas_lesson_plans`, `atlas_memories`. All use authenticated tutor-ID
RLS; requests from anonymous browsers do not receive grants.

The **Import students** button on your signed-in dashboard accepts your
private `Atlas_Student_Profiles_Private.json` file (schema_version 1).
It validates fields, reviews duplicates, and asks for confirmation before
writing records under the CURRENT signed-in tutor ID.
No student data is bundled with the public site. AI access is disabled
on every imported student.

**Do not import existing student records under the first random account to
sign up.** Sign into your own verified account first, then import.

Free plan does not have automatic database backups. Make secure, verified
backups and establish privacy/retention/consent practices before using real
children's information. Review the public Privacy Policy and Terms with
appropriate legal advice for your circumstances.
