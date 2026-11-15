# Atlas AI architecture: local first, optional API, managed cloud later

## Product boundary (15 November 2026)

HelloEarth is the account-based tutor workspace. Atlas AI is a separate,
standalone Python application. Today it performs inference locally through
Ollama. The local app signs in to Supabase for student profiles and memory.

Local inference is **not the same thing as a fully offline application**:
the current prototype requires internet access for Supabase sign-in and sync.
A truly offline mode would require local encrypted storage and later
conflict-aware synchronization, which are not implemented yet.

The HelloEarth website does **not** currently run Atlas AI, accept an AI API
key, or offer hosted inference. Do not claim these services are live.

## Future user-selectable inference modes

1. **Local Ollama — default.**
   Tutor installs Atlas on their machine and uses a locally installed model.
   AI inference never needs to be sent to HelloEarth's model servers. Student
   records are still synchronized separately using Supabase authentication.
   This reduces recurring inference expense for HelloEarth.

2. **Bring your own AI API — planned.**
   Tutors choose a provider (for example OpenAI or another compatible
   model API) and use their personal provider billing account.
   If Atlas remains a desktop app, store API credentials in the OS keychain
   or another encrypted credential store, not in plaintext configuration.
   If future web support is added, route inference via an authenticated
   backend with server-side encryption and documented key rotation; never
   place user provider secrets in publicly served JavaScript or student data.
   Support provider selection, quotas and a predictable error/fallback path.

3. **Managed cloud Atlas — planned premium convenience.**
   A secure, authenticated cloud inference service managed by HelloEarth.
   No desktop AI installation would be necessary. Access would require
   server-verified subscription entitlements, tutor-scoped student records,
   consent controls, logging that does NOT store sensitive model prompts by
   default, strict token/response limits, monthly spend caps and rate limits.
   A server-side payment webhook would grant a paid entitlement; never
   enable cloud privileges from editable browser account metadata.

## Proposed tier positioning (not active offers)

| Tier | ZAR/mo | Planned AI positioning |
|---|---:|---|
| Free | 0 | Web student workspace; Atlas local prototype remains separate |
| Starter | 99 | Planned connect-your-own AI API; model provider bills the tutor |
| Growth | 199 | Planned BYO API and optional managed cloud Atlas add-on, separately metered |
| Studio | 349 | Planned hosted Atlas option with strict monthly included usage cap (size and final price TBD) |

Do NOT sell an unlimited hosted AI plan at R199 or R349 without unit-economics
tests. GPU compute, API token charges, retries, transcription and heavy tutor
usage could exhaust margins. Plan prices are provisional until verified
costs and billing functionality exist.

## Where to enforce cost limits

- The PostgreSQL student/lesson quotas already exist. They control **data
  storage only** and are NOT model inference quotas.
- Future cloud AI must have its own backend-authenticated ledger with
  request IDs, token accounting, per-account spend budgets, rate limits,
  concurrency limits and cutoff when the available allowance is exhausted.
- Do not allow the browser to set its own plan, AI quota, credit balance or
  provider unit price.
- Cache/reuse only safe, non-sensitive common materials; never share
  one tutor's student context with another.
- Recordings/transcripts require distinct opt-in, retention rules and
  private storage, with additional costs. They are currently unavailable.
- Review provider model costs immediately before committing to cloud pricing.

## Next engineering steps

1. Decide supported local models and API providers.
2. Build a provider-agnostic ModelGateway with a local Ollama adapter,
   a BYO API adapter and separately authenticated cloud adapter.
3. Keep model prompts isolated per student; consent controls default OFF.
4. Implement OS-keychain configuration on desktop.
5. Prototype a cloud AI service with realistic request/token logging on
   synthetic lesson data only; use a hard budget during testing.
6. Design a billing backend and signed payment webhooks.
7. Fix monthly cap numbers based on measured unit costs before launch.
8. Publish a truthful privacy notice and regional data/AI-processing policy.

Related: SUBSCRIPTIONS.md
