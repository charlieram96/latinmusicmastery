# New Payment System — Per-Course, Per-Instrument Pricing

**Date:** 2026-05-21
**Status:** Approved design (pre-implementation)

## Context

The current model is tier-based and instrument-scoped: **$14.99/mo per instrument**
(unlocks every course in that instrument) and **$69.99/mo all-access**. Pricing lives
in `lib/pricing.ts`; access is decided in `lib/subscriptions.ts::canAccessCourse` by
matching a subscription's `instrument` to a course's `instrument`; Stripe uses two
static price IDs and one subscription per instrument.

We are **replacing** this with a per-course model that charges per instrument with a
"first course" entry price plus per-course add-ons. The product is **pre-launch with no
live paying subscribers**, so the old tiers are removed cleanly (no migration of real
customers). A flat **$69.99/mo all-access** tier returns in a **future** phase; this
design must not block it.

## Pricing rules (final)

- **$19.99/mo per instrument** (the "base"). It includes:
  - the instrument's **beginner fundamentals course** (genreless, auto-included), and
  - **one genre course** chosen at checkout (required — no fundamentals-only entry).
- **+$9.99/mo** for each **additional** genre course in that same instrument.
- **Annual option, chosen per instrument**: 15% off the **base only** →
  **$203.90/yr** (`19.99 × 12 × 0.85 = 203.898`, charged as `$203.90`). Add-on courses
  remain **$9.99/mo** even when the base is annual.
- **Cadence is selected per instrument** (e.g. Piano annual + Congas monthly is valid).
- **All-access ($69.99/mo)**: future phase, out of scope here.

### Worked examples
| Scenario | Charges | Stripe subscriptions |
|---|---|---|
| Piano, monthly, 1 genre | $19.99/mo | 1 (base only) |
| Piano, monthly, 3 genres | $39.97/mo | 1 (base + add-on ×2) |
| Piano, annual, 1 genre | $203.90/yr | 1 (annual base) |
| Piano, annual, 3 genres | $203.90/yr + $19.98/mo | 2 (annual base + monthly add-on ×2) |
| Piano annual + Congas monthly | billed independently per instrument | per-instrument |

## Content model

Each instrument has **exactly one genreless beginner fundamentals course**. Today
`courses.musical_style_id` is `NOT NULL` and every course has a genre, so:

- Make `courses.musical_style_id` **nullable**.
- Add `courses.is_fundamentals BOOLEAN NOT NULL DEFAULT false` (a fundamentals course has
  `musical_style_id = NULL`, `is_fundamentals = true`, and an `instrument`).
- Enforce one per instrument: partial unique index
  `UNIQUE (instrument) WHERE is_fundamentals`.
- Admin course form gains a "Fundamentals (no genre)" mode that hides the genre selector
  and sets the flag; validation blocks a second fundamentals course for an instrument.
- Seed/author one fundamentals course per subscribable instrument
  (`lib/instruments.ts` lists them).

## Data model

Replace the single-tier `subscriptions` table with:

- **`instrument_subscriptions`** — one row per `(user_id, instrument)`:
  - `id`, `user_id`, `instrument`
  - `billing_interval` `'month' | 'year'`
  - `stripe_base_subscription_id` (yearly or monthly base)
  - `stripe_addon_subscription_id` (monthly add-ons; `NULL` until genres > 1)
  - `stripe_customer_id`
  - `status` `'active' | 'past_due' | 'canceled' | 'incomplete'`
  - `base_current_period_end`, `addon_current_period_end`
  - `cancel_at_period_end`
  - `pending_interval` `'month' | 'year' | NULL` (a scheduled cadence change)
  - `created_at`, `updated_at`
  - `UNIQUE (user_id, instrument)`
- **`course_enrollments`** — `(user_id, course_id)` for **genre** courses the user owns,
  plus `instrument_subscription_id` and `created_at`; `UNIQUE (user_id, course_id)`.
  Fundamentals access is **derived** from holding the instrument's base, so fundamentals
  are not rows here.

**Billing invariant:** for an instrument, **add-on quantity = (genre enrollments) − 1**.
The base always covers exactly one genre, so we never pin "which genre is free" — removing
any genre just decrements the add-on quantity; removing the **last** genre cancels the
instrument (see rules).

## Stripe structure

Three static recurring prices (IDs in env, mirroring the current static-price approach):

- `base_monthly` — $19.99 / month
- `base_annual` — $203.90 / year
- `genre_addon_monthly` — $9.99 / month

Subscription topology per instrument (G = number of genre courses owned, G ≥ 1):

- **Monthly instrument** → **one** subscription, items: `base_monthly ×1`
  + (if G > 1) `genre_addon_monthly ×(G−1)`.
- **Annual instrument** → base on its **own yearly** subscription (`base_annual ×1`);
  if G > 1, a **separate monthly** subscription `genre_addon_monthly ×(G−1)`.

Each Stripe subscription carries metadata: `user_id`, `instrument`, `role` (`'base'|'addon'`).

### Lifecycle operations
- **Add a genre course (G → G+1):** increment the add-on quantity (Stripe prorates). If
  no add-on subscription/item existed (G was 1), create it at quantity 1 — for an annual
  instrument this creates the separate monthly add-on subscription.
- **Remove a genre course (G → G−1):** decrement add-on quantity; when it hits 0, remove
  the add-on item / cancel the add-on subscription. Removing the **last** genre (G: 1→0)
  cancels the instrument's base subscription too; fundamentals access ends.
- **Add an instrument:** create a fresh base subscription (and add-on subscription if the
  user picks extra genres at checkout).
- **Swap the included genre:** free anytime — swap one genre enrollment for another with
  no change to counts or price.
- **Switch cadence (monthly ↔ annual):** takes effect at the **next base renewal** (no
  mid-cycle proration), access uninterrupted; recorded via `pending_interval` and
  implemented with Stripe subscription schedules (exact mechanism deferred to the plan).

## Access gating

Rewrite `lib/subscriptions.ts::canAccessCourse(userId, course, isAdmin)` from
instrument-match to **per-course**:

1. `isAdmin` → allow.
2. `course.is_free` → allow.
3. `course.is_fundamentals` → allow iff the user has an **active**
   `instrument_subscription` for `course.instrument`.
4. genre course → allow iff the user has an **active** `course_enrollment` for
   `course.id` (its instrument subscription active).
5. (future) all-access → allow everything.

**RLS (security-critical):** today the lessons policy allows "any active subscription,"
which under per-course pricing would let, say, a Piano subscriber read Congas content via
the data API. Add a `SECURITY DEFINER` SQL helper `has_course_access(course_id)`
implementing the same logic as above, and use it in the RLS policies for `lessons` and
`class_items` (resolving `class_items → classes → course_sections → courses` to the owning
course). App-layer checks remain (as in `app/dashboard/modules/[moduleId]/page.tsx`), with
RLS as the enforced backstop.

## Subscribe / manage UX

- **Checkout flow:** pick instrument → pick the included genre (required; fundamentals
  shown as "included") → optionally add more genres (+$9.99/mo each, running total) →
  choose **monthly or annual** for this instrument → pay (Stripe Checkout). The session
  creates the base subscription and, if extra genres were chosen, the add-on subscription.
- **Add later:** course pages and the subscription page get "Add to my plan (+$9.99/mo)."
- **Management page:** per instrument, show fundamentals + genre courses, cadence, and
  renewal date(s) — surfacing the **two billing streams** for annual instruments with
  add-ons, plus any `pending_interval` change. Cancel-course and cancel-instrument actions.
- Replace the current per-instrument tier picker in `app/dashboard/subscribe/*` and the
  marketing `app/(marketing)/pricing/*` copy.

## Webhooks (`app/api/webhooks/stripe`)

Handle base and add-on subscriptions keyed by `stripe_*_subscription_id` and `role`
metadata: keep `instrument_subscriptions` and `course_enrollments` in sync on
`checkout.session.completed`, `customer.subscription.updated/deleted`,
`invoice.payment_succeeded` (→ active), `invoice.payment_failed` (→ past_due). Apply a
scheduled `pending_interval` when the base renews.

## Out of scope / future

- **$69.99/mo all-access** tier (add a price + an `all_access` access short-circuit; the
  per-course schema already accommodates it).
- Migrating real subscribers (none exist — pre-launch).

## Removal / cleanup

Remove the old two-tier logic: `PLAN_PRICES`/`getPlanPrice` shape in `lib/pricing.ts`, the
old `subscriptions` table usage, the instrument/all-access price-ID env vars and the
tier-based subscribe UI, and the instrument-match branch of `canAccessCourse`.

## Phasing (for the implementation plan)

1. **Content model** — fundamentals course type (schema + admin form + one seeded per
   instrument). Independently shippable.
2. **Billing** — new tables, three Stripe prices, checkout for monthly + annual, webhooks.
3. **Access gating** — rewrite `canAccessCourse` + `has_course_access` RLS; remove old
   tier logic.
4. **UX** — subscribe flow, add-to-plan, management page, marketing pricing copy.

Dependencies: 3 needs 1 + 2; 4 needs 2. Start with 1.

## Verification

Stripe **test mode**, end-to-end:
- Subscribe monthly (1 genre) → one subscription; access to fundamentals + that genre only.
- Add a genre → add-on quantity increments; new genre accessible; others still locked.
- Subscribe annual (1 genre) → annual base only; add a genre → separate monthly add-on
  subscription appears.
- Add a second instrument → independent subscription(s); cross-instrument access denied.
- Remove the last genre → instrument fully cancels, fundamentals access ends.
- Webhook sync verified against `instrument_subscriptions` / `course_enrollments` (via
  Supabase MCP).
- RLS: a subscriber to instrument A cannot read instrument B's paid lessons via the data
  API.
- `npm run build` clean.
