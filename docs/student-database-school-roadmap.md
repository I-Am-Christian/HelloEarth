# Hello Earth — Student database product direction

Updated: 20 November 2026

## Product definition

Hello Earth is a **student information and recordkeeping platform**, not a tutoring marketplace or a platform for selling lessons.

Its core promise: educators and educational organisations can keep learner information organised, track progress, and find the records they need without scattering them across spreadsheets, documents and unrelated apps.

### Who it serves

1. **Individual educators (available in early access):** privately manage student profiles, notes, progress observations, attendance and current assignments. Account data is currently isolated by the signed-in educator.
2. **Learning centres (future):** organise students across groups/classes, let authorised staff collaborate on learner records, and coordinate calendars and reporting.
3. **Schools and education institutions (future):** multi-user student databases with staff roles, classes, enrolments, school-year tracking, custom fields, attendance and institution reporting.

The school and centre products are **not** live and must not be marketed as production-ready.

## Keep / de-emphasise / retire

**Core now**
- Secure individual accounts and learner records
- Student import, lookup, searchable profiles, notes and learning goals
- Assessments, attendance and progress history
- Reporting and exports derived from actual saved information

**Optional supporting features**
- Calendar and class schedules
- Homework / preparation checklists
- Reusable templates
- Atlas AI (clearly labelled future development; not required to use the database)

**Retired as a product direction**
- Tutor ranking competitions and public performance leaderboard
- Tax-break, lesson commission, reward-per-paid-lesson concepts
- Tutor marketplace or public discovery for purchasing tutoring lessons

Legacy activity data and the dormant integration code should not be deleted without a separate retention/migration plan. The previously published public leaderboard API has been disabled.

## School database architecture: design first

Do **not** simply give several staff members one educator login. That would expose private student records and eliminate accountability.

Before school accounts launch, implement and verify:

### Organisation-scoped data model

- `organisations`: school/centre identity, settings, billing owner and timezone
- `organisation_memberships`: user ID, organisation ID, role and status
- `classes`: class/group name, organisation, academic term/year
- `class_memberships` or `enrolments`: student, class, dates and status
- `students`: school scope, required identity fields, optional custom fields
- `student_notes`, `assessments`, `attendance`, `documents`: consistently scoped to the organisation and record owner
- `audit_events`: who accessed/changed important student data and when
- `invites`: expiring, single-use, school-admin-controlled staff invitations
- `data_retention_settings`: configurable retention schedules where law permits

### Access roles and access rules

Proposed roles: **school owner**, **administrator**, **teacher**, **read-only staff member**. Every query must enforce the correct organisation and role through database row-level security and server-side checks. Never rely on client-side hiding, email-domain matching, or user-editable profile metadata to authorise access.

Decide whether a teacher can view all students at a school, only their assigned classes, or an explicit list. Document data sharing with guardians and students separately.

### Privacy and operations

- Use data minimisation, particularly for minors and sensitive school records
- Define lawful grounds and institutional responsibilities under relevant privacy rules (including South African POPIA where applicable)
- Design secure imports/exports, data portability, backup and restore
- Add audit logs, retention settings, account revocation and access reviews
- Require consent/authority before storing any children's data
- Avoid including school data in external AI services unless explicit controls and agreements are in place
- Penetration/access tests should demonstrate that staff in one school cannot read or mutate another school's records

### Development sequence

1. Keep the current individual-educator database stable.
2. Build an **organisation model and class roster prototype** in a separate test environment, with synthetic school data.
3. Implement security controls and automated multi-tenant permission tests before inviting real schools.
4. Add role-based school dashboard, imports, attendance and reporting.
5. Pilot with a school using an agreed privacy and retention process.
6. Offer institution subscriptions only after permissions, support and billing are in place.

## Pricing

Keep the existing individual-educator plans explicitly labelled proposals where payments are not live. **School pricing must be scoped separately**: based on institution size, staff seats, storage and support needs, not on lesson commissions. No 20%-to-12% tax or platform-fee promise applies.

## UI direction

Simple, professional, calm student recordkeeping. Main information hierarchy:
**Overview → Students → Classes (future) → Attendance → Progress → Reports → Settings**.

Retain the existing Earth branding and restrained violet/blue accents, but avoid marketplace badges, tutors-as-competitors, financial reward gimmicks and a public tutoring storefront.

## Implementation status

- Website and pricing copy repositioned for student databases; schools clearly marked planned.
- Tutor leaderboard/rewards retired from visible site/dashboard and public result API disabled without deleting historical account information.
- Current educator data, existing calendar controls, student management and report code left intact.
- No school-specific multi-tenant schema or shared staff access has been deployed; future institution features are a roadmap, not a promise of current functionality.
