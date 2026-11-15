# HelloEarth subscription architecture

## Status

The Free tutor workspace is available. Paid plans shown on pricing.html are
proposed prices and cannot be purchased yet. No charges are being collected.
Production billing requires verified server-side integration with a payment
processor.

## Pricing catalogue and database limits

The source of truth is the public Supabase table helloearth_plans:

| Tier | ZAR/month | Students | New notes per month | Total stored notes |
|---|---:|---:|---:|---:|
| Free | 0 | 3 | 10 | 30 |
| Starter | 99 | 20 | 250 | 3,000 |
| Growth | 199 | 75 | 1,200 | 12,000 |
| Studio | 349 | 250 | 5,000 | 50,000 |

## Planned Atlas entitlement matrix (not yet live)

| Plan | Atlas processing | Connect your own AI API |
|---|---|---|
| Free | Local Ollama-based Atlas desktop | Yes — planned |
| Starter | Local Ollama-based Atlas desktop | Yes — planned |
| Growth | Managed cloud Atlas with included capped usage | Yes — planned |
| Studio | Managed cloud Atlas with a larger included capped allowance | Yes — planned |

Local Atlas exists today as a separate Python prototype; it is not
integrated with the public HelloEarth workspace. Cloud Atlas and external
API integration remain in development and are NOT enabled by the current
student/notes subscription system. All paid pricing is proposed.

External providers may use different API protocols. Planned "bring your
own API" support means a documented, expandable selection of supported
AI providers plus compatible custom endpoints, not arbitrary HTTP APIs.
Users pay their own provider charges separately, regardless of tier.
No API credentials may be embedded in the static site or stored in
student data.

Growth and Studio are intended to INCLUDE cloud Atlas rather than require
a separately purchased add-on; their included usage budgets and final
prices must be set based on measured cloud inference costs before billing.
Existing student/notes quotas do not cap inference usage.

The public helloearth_plans table now includes descriptive
planned_atlas_runtime (local/cloud) and planned_byo_api_support (true on
every plan), solely to keep the public catalogue aligned with the
product roadmap. These fields grant no actual AI entitlement.

Student and note limits are enforced in PostgreSQL by quota triggers,
including concurrent inserts and direct API calls. The user's existing
internal founder account is administratively exempt from these quotas.

## Security model

- helloearth_plans is a public read-only catalogue.
- helloearth_subscriptions is readable only by its owning authenticated tutor.
- Authenticated browser clients have NO permission to write subscriptions.
- A payment callback or browser redirect must never grant paid access.
- A future trusted payment backend must validate signed webhook requests,
  verify merchant account, price, currency, payment event, customer mapping
  and billing period, and process duplicate events idempotently.
- Expired or inactive paid entitlements fall back to Free insertion quotas.
- Existing notes and students are preserved if an account exceeds limits.
- Do not use a service-role or payment secret in GitHub Pages JavaScript.

## Lean storage policy

- Use Postgres structured text and JSONB; PostgreSQL compresses large values.
- Keep notes separate from profiles, associated by UUID.
- Validate the maximum UTF-8 byte length of profile fields, notes, and plans.
- Do not store image files, PDFs, audio, video or raw transcripts in database rows.
- Future files must use private Storage buckets with per-plan upload caps and retention.
- Before opening paid plans, implement secure backups, provider webhooks,
  subscription cancellation, receipts, customer support, monitoring, and
  properly configured SMTP for email confirmations.

## Recurring payments

Paystack is a candidate for South Africa and supports recurring card payments.
Pricing and webhook specifics must be verified at the time of integration.

References:
- https://paystack.com/za/pricing
- https://paystack.com/docs/payments/subscriptions/
- https://paystack.com/docs/payments/webhooks/
- https://supabase.com/pricing

Last updated: 15 November 2026.
