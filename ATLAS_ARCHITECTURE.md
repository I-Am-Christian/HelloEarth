# Atlas AI: local on Free/Starter, cloud on Growth/Studio

Last updated: 15 November 2026.

## Confirmed product direction

HelloEarth is the authenticated tutor workspace with student profiles,
lesson notes, and progress. Atlas AI is a standalone Python assistant with
a local Ollama-based prototype. The current desktop prototype uses
Supabase Auth and data synchronization, so local **inference** does not
mean fully offline data storage.

The future HelloEarth tier design is:

| Plan | ZAR per month (proposed) | Atlas deployment | Bring your own AI API |
|---|---:|---|---|
| Free | R0 | Local on your machine | Planned: yes |
| Starter | R99 | Local on your machine | Planned: yes |
| Growth | R199 | Cloud-hosted by HelloEarth | Planned: yes |
| Studio | R349 | Cloud-hosted by HelloEarth, larger allowance | Planned: yes |

The intended cloud Atlas service is **included** in the higher plans,
subject to a separate, capped monthly usage allowance for Growth and
a larger capped allowance for Studio. It is not described as a paid
add-on. Exact token/request allowances and final subscription prices
must be determined from measured inference costs before checkout opens.

The existing Free web workspace is already available. The local Atlas
prototype is a **separate application**, not integrated into the public
HelloEarth dashboard. None of the planned subscriptions, managed cloud
inference, or bring-your-own API integrations are live yet.

## Bring your own API on every tier

Every plan should be able to connect a tutor-owned AI API provider;
this is independent of whether Atlas itself runs locally or in the
HelloEarth cloud. User chooses a provider as an alternative model
backend. The tutor pays that provider's usage fees directly.

"Any API" is an extensible provider-adapter design goal, not a claim
that arbitrary proprietary APIs already work out of the box. Design a
provider-neutral model interface; support common providers, compatible
custom endpoints, and progressively add other adapters.

A local application should store provider tokens in the OS keychain
or another secure credential store rather than plaintext files.
Never store third-party secrets in public JavaScript, student profiles,
git commits, or unencrypted local configuration. For any future web
integration, sensitive provider operations require a trusted backend,
encrypted credentials, input validation, authenticated tutor ownership
checks, and a private deletion/revocation path.

Do not send student data to external AI providers without a lawful
basis and clear opt-in. Existing imported student profiles default
to ai_context_enabled=false.

## Hosted Atlas cost and security rules

- Cloud service must verify an active Growth/Studio entitlement on
  the server. Browser display text alone must not authorize requests.
- Free and Starter must never receive managed inference through a
  direct API request, while BYO API use remains available on all tiers
  once implemented.
- Define and publish request/token limits and hard spend caps per tier.
- Use a server-side metering ledger and concurrency/rate limits;
  do not promise unlimited GPU inference, recordings or transcripts.
- Prevent cross-tutor context retrieval with scoped RLS and backend
  authorization, and do not store model prompts containing student
  information in operational logs.
- A signed payment webhook grants subscription access after payment
  verification; the user cannot edit their own subscription rows.
- Provide fair grace periods and preserve existing records when a
  plan is downgraded or usage is exhausted.
- Price hosted plans after testing real lesson-planning workloads
  on the intended models, including retries, token overhead, monitoring,
  customer support and taxes.

The current Supabase plan table records only **planned_atlas_runtime**
(local/cloud) and **planned_byo_api_support** (true for all).
Those columns are informational product metadata and do not grant
actual model access or represent an active billable feature.
Student-record quotas are already enforced separately by database
triggers.

## Next engineering steps

1. Make local Atlas easy to install and connect to HelloEarth login.
2. Build one ModelGateway interface with Ollama, hosted, and BYO adapters.
3. Provide a provider selector on each applicable client, with secure keys.
4. Implement isolated opt-in student context and provider-specific privacy.
5. Measure cloud workload costs; set Growth/Studio allowance caps.
6. Build and test subscription checkout, signed webhooks and hosted quotas.
7. Publish the final features, usage and provider compatibility before launch.

Related: SUBSCRIPTIONS.md and Atlas-AI/README.md.
