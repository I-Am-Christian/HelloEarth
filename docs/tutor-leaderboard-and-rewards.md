# Hello Earth — Tutor Leaderboard & Fee Rewards

## What is live

- Public opt-in leaderboard: `/leaderboard.html`
- Signed-in dashboard leaderboard: `/dashboard.html#leaderboard`
- Backend: Supabase Edge Function `he-leaderboard`
- Private data tables: `he_leaderboard_profiles`, `he_verified_paid_lessons`
- Server-only aggregation RPCs: `he_leaderboard_snapshot()`, `he_leaderboard_private_totals(uuid)`
- Frontend: `leaderboard-core.js`, `leaderboard-dashboard.js`, `leaderboard-public.js`, `leaderboard.css`

Tutors may opt in by choosing an alias and explicitly checking the public leaderboard participation box. Until they do, they do not appear in public rankings. Opting out hides them from future results. Neither student records nor raw lesson notes appear in the published dataset.

## Rankings

All rankings use internal data stored by tutors. These **are not independently verified** and therefore cannot determine actual financial rewards.

| Category | Source | Calculation |
|---|---|---|
| Most lessons | `he_lesson_ledger` | Entries with `state='completed'` |
| Best attendance | `atlas_lesson_attendance` | Attended ÷ (attended + missed) × 100; minimum ten eligible records; cancellations excluded |
| Most popular | `he_booking_requests` | Confirmed requests originating on Hello Earth's public booking page |
| Most teaching hours | `he_lesson_ledger` | Sum of minutes for entries marked completed ÷ 60 |

The leaderboard includes only opted-in tutor aliases and aggregate activity. For rankings, ties are resolved by recorded lesson counts and alias. Public results are limited to the top 20 in each category. Badges are non-financial.

## Proposed service-fee discount

**This is not government tax.** Only the fee charged by the Hello Earth platform could be discounted in a future paid-lesson system. Teachers remain responsible for any applicable income tax and VAT.

The preview is a smooth reduction from 20% to 12% after 1,000 platform-verified paid lessons:

```js
const proposedPercent = Math.max(12,
  Math.round((20 - 8 * Math.min(verifiedPaidLessons, 1000) / 1000) * 100) / 100);
```

| Verified paid lessons | Preview fee |
|---:|---:|
| 0 | 20.0% |
| 100 | 19.2% |
| 250 | 18.0% |
| 500 | 16.0% |
| 750 | 14.0% |
| 1000+ | 12.0% |

For example, on a R200 lesson the **illustrative** 20% platform fee is R40, leaving R160 before tax and other costs. At 12%, it would be R24, leaving R176.

### Not yet live

The site does **not** currently process lesson payments, collect commissions, deliver payouts, verify paid lessons, or issue tax reductions. The platform fee calculator and milestone tracker are previews only. Self-recorded lessons and public rankings cannot unlock real financial fee discounts.

The `he_verified_paid_lessons` table has no client-accessible insert or update permissions. It is intentionally empty until a trusted server-side paid-lesson verification pipeline is operational. The private aggregate RPC is exposed only to the service role. This avoids granting discounts based on self-reported records.

## Before enabling real paid lessons

1. Select and integrate a payment provider that supports the company's merchant jurisdiction and required KYC/identity verification.
2. Define contractual fees, payout schedules, eligible paid lessons, discounts, chargebacks, refunds, disputes, applicable invoicing/VAT and payment-processor costs.
3. Accept payment webhook events **server-side only**. Verify provider signatures, unique event/payment references, the tutor's account, settled payment status, chargebacks and refunds before adjusting verified credits.
4. Add ledger reconciliation and reversal procedures so refunded or disputed lessons no longer count toward rewards; preserve historical rate decision records for auditability.
5. Prevent multiple credits from the same payment; authenticate all privileged operations. Never make financial decisions based on user-editable attendance or lesson entries.
6. Publish the final program terms before activating the fee program, and confirm legal/tax treatment with a qualified South African adviser.

## Operational security notes

- The leaderboard aggregator returns public aliases and summary counts, not internal student/contact records.
- Anon users cannot select `he_leaderboard_profiles` or `he_verified_paid_lessons` directly.
- Only tutors can edit their own opt-in preferences under RLS. 
- Only the server role can invoke cross-tutor aggregation functions and insert verified payment credits.
- Anonymous `list` requests are allowed for published public rankings. `mine` and `save` require a valid signed-in tutor access token, validated in the Edge Function.

## Validation completed

The 0, 100, 250, 500, 750 and 1,000 lesson rate checkpoints were tested. The public and private dashboard scripts parsed; page structures passed balanced-tag and duplicate-ID checks. Database function EXECUTE grants and table access were checked. A mock interaction test verified leaderboard loading, authenticated personal totals and 20% versus preview fee displays.

A live end-to-end browser and payment provider test has **not** been completed. The Edge Function was deployed, but direct HTTP testing from the execution environment was blocked by external DNS. Do not call these reward payments live until the future payment gateway and webhook verification are installed.
