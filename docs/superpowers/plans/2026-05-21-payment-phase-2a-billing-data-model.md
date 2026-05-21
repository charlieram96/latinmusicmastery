# Payment System Phase 2a — Billing Data Model + Logic (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the database tables and pure billing-logic helpers for the new per-course payment model, runnable and testable without any Stripe integration.

**Architecture:** Two new tables — `instrument_subscriptions` (one row per user+instrument, holding cadence + Stripe subscription ids + status) and `subscription_courses` (the genre courses entitled under a subscription). They run **in parallel** with the legacy `subscriptions` table (0 rows; removed in Phase 3) and do **not** touch the existing access-tracking `course_enrollments` table. A pure `lib/payments/billing.ts` module encodes the pricing math and the Stripe "topology" (base interval, add-on quantity, whether the add-on needs its own subscription) that Phase 2b's checkout/webhooks will consume.

**Tech Stack:** Next.js 16, Supabase (Postgres + RLS), TypeScript, vitest (node env), Supabase MCP for applying migrations.

**Reference spec:** `docs/superpowers/specs/2026-05-21-new-payment-system-design.md`

**Deviations from spec (deliberate, based on the live DB):**
- The spec named the genre-entitlement table `course_enrollments`, but that name is already taken by an unrelated access-tracking table (7 rows). This plan uses **`subscription_courses`** instead, with a denormalized `user_id` for simple RLS.

**Out of scope (→ Phase 2b plan):** creating the 3 Stripe prices, the checkout route, and the webhook handler. Those require the user to create prices in Stripe (test mode) + a decision on the checkout mechanism for the annual two-subscription case.

---

### Task 1: Pure billing-logic helpers (TDD)

**Files:**
- Create: `lib/payments/billing.ts`
- Test:   `lib/payments/__tests__/billing.test.ts`

- [ ] **Step 1: Write the failing test** at `lib/payments/__tests__/billing.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  BASE_MONTHLY_CENTS,
  ADDON_MONTHLY_CENTS,
  BASE_ANNUAL_CENTS,
  addonQuantity,
  planTopology,
} from '@/lib/payments/billing'

describe('pricing constants', () => {
  it('uses 19.99 / 9.99 monthly and 15%-off annual base (203.90)', () => {
    expect(BASE_MONTHLY_CENTS).toBe(1999)
    expect(ADDON_MONTHLY_CENTS).toBe(999)
    expect(BASE_ANNUAL_CENTS).toBe(20390)
  })
})

describe('addonQuantity', () => {
  it('is 0 for the included single genre', () => {
    expect(addonQuantity(1)).toBe(0)
  })
  it('is genreCount - 1 for extra genres', () => {
    expect(addonQuantity(3)).toBe(2)
  })
  it('never goes negative', () => {
    expect(addonQuantity(0)).toBe(0)
  })
})

describe('planTopology', () => {
  it('monthly + 1 genre: base only, no add-on, single subscription', () => {
    expect(planTopology({ interval: 'month', genreCourseCount: 1 })).toEqual({
      base: { interval: 'month', priceKey: 'base_monthly', quantity: 1 },
      addon: null,
      separateAddonSubscription: false,
    })
  })
  it('monthly + 3 genres: add-on qty 2 on the same monthly subscription', () => {
    expect(planTopology({ interval: 'month', genreCourseCount: 3 })).toEqual({
      base: { interval: 'month', priceKey: 'base_monthly', quantity: 1 },
      addon: { interval: 'month', priceKey: 'addon_monthly', quantity: 2 },
      separateAddonSubscription: false,
    })
  })
  it('annual + 1 genre: annual base only, no add-on', () => {
    expect(planTopology({ interval: 'year', genreCourseCount: 1 })).toEqual({
      base: { interval: 'year', priceKey: 'base_annual', quantity: 1 },
      addon: null,
      separateAddonSubscription: false,
    })
  })
  it('annual + 3 genres: annual base + add-on on a SEPARATE monthly subscription', () => {
    expect(planTopology({ interval: 'year', genreCourseCount: 3 })).toEqual({
      base: { interval: 'year', priceKey: 'base_annual', quantity: 1 },
      addon: { interval: 'month', priceKey: 'addon_monthly', quantity: 2 },
      separateAddonSubscription: true,
    })
  })
})
```

- [ ] **Step 2: Run and confirm FAIL**

Run: `npx vitest run lib/payments/__tests__/billing.test.ts`
Expected: FAIL — `@/lib/payments/billing` not found.

- [ ] **Step 3: Implement** `lib/payments/billing.ts`:

```ts
// All money values are in integer cents.
export const BASE_MONTHLY_CENTS = 1999
export const ADDON_MONTHLY_CENTS = 999
export const ANNUAL_DISCOUNT = 0.15
// 15% off twelve months of the base, rounded to the nearest cent (→ 20390 = $203.90).
export const BASE_ANNUAL_CENTS = Math.round(BASE_MONTHLY_CENTS * 12 * (1 - ANNUAL_DISCOUNT))

export type BillingInterval = 'month' | 'year'
export type BasePriceKey = 'base_monthly' | 'base_annual'

/** Number of genre courses billed as add-ons (one genre is included in the base). */
export function addonQuantity(genreCourseCount: number): number {
  return Math.max(0, genreCourseCount - 1)
}

export interface PlanTopology {
  base: { interval: BillingInterval; priceKey: BasePriceKey; quantity: 1 }
  addon: { interval: 'month'; priceKey: 'addon_monthly'; quantity: number } | null
  /**
   * True when the add-on must live on its own monthly subscription: an annual
   * base and a monthly add-on cannot share one Stripe subscription (intervals
   * must match).
   */
  separateAddonSubscription: boolean
}

/** Describes how an instrument's plan maps onto Stripe subscriptions/line items. */
export function planTopology(input: {
  interval: BillingInterval
  genreCourseCount: number
}): PlanTopology {
  const qty = addonQuantity(input.genreCourseCount)
  const base = {
    interval: input.interval,
    priceKey: (input.interval === 'year' ? 'base_annual' : 'base_monthly') as BasePriceKey,
    quantity: 1 as const,
  }
  const addon =
    qty > 0 ? { interval: 'month' as const, priceKey: 'addon_monthly' as const, quantity: qty } : null
  return {
    base,
    addon,
    separateAddonSubscription: input.interval === 'year' && qty > 0,
  }
}
```

- [ ] **Step 4: Run and confirm PASS**

Run: `npx vitest run lib/payments/__tests__/billing.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/payments/billing.ts lib/payments/__tests__/billing.test.ts
git commit -m "feat(payments): pricing constants + plan topology helpers"
```

---

### Task 2: Billing tables + RLS migration

**Files:**
- Create: `supabase/migrations/021_billing_subscriptions.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/021_billing_subscriptions.sql`:

```sql
-- 021_billing_subscriptions.sql
-- Per-course payment model: one subscription per (user, instrument) plus the
-- set of genre courses entitled under it. Runs in parallel with the legacy
-- `subscriptions` table (0 rows, removed in Phase 3). Does NOT touch the
-- existing access-tracking `course_enrollments` table.

CREATE TABLE IF NOT EXISTS instrument_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  instrument TEXT NOT NULL,
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('month', 'year')),
  stripe_customer_id TEXT,
  stripe_base_subscription_id TEXT,
  stripe_addon_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'incomplete'
    CHECK (status IN ('active', 'past_due', 'canceled', 'incomplete')),
  base_current_period_end TIMESTAMPTZ,
  addon_current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  pending_interval TEXT CHECK (pending_interval IN ('month', 'year')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, instrument)
);

CREATE INDEX IF NOT EXISTS idx_instrument_subscriptions_user
  ON instrument_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS subscription_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_subscription_id UUID NOT NULL
    REFERENCES instrument_subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_subscription_courses_sub
  ON subscription_courses(instrument_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_courses_course
  ON subscription_courses(course_id);

ALTER TABLE instrument_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_courses ENABLE ROW LEVEL SECURITY;

-- Users read their own rows; admins read all. Writes go through the service
-- role (Stripe webhooks / server actions), which bypasses RLS.
CREATE POLICY "Users read own instrument subscriptions"
  ON instrument_subscriptions FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

CREATE POLICY "Users read own subscription courses"
  ON subscription_courses FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );
```

- [ ] **Step 2: Apply via Supabase MCP** `apply_migration`, `name: "billing_subscriptions"`, with the SQL above. Expected: `{ "success": true }`.

- [ ] **Step 3: Verify** with Supabase MCP `execute_sql`:

```sql
select table_name, count(*) as columns
from information_schema.columns
where table_schema='public' and table_name in ('instrument_subscriptions','subscription_courses')
group by table_name order by table_name;

select tablename, policyname from pg_policies
where schemaname='public' and tablename in ('instrument_subscriptions','subscription_courses')
order by tablename;
```

Expected: both tables present (14 and 5 columns respectively); one SELECT policy each; and `rowsecurity` enabled (the policies imply it).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/021_billing_subscriptions.sql
git commit -m "feat(db): instrument_subscriptions + subscription_courses tables with RLS"
```

---

### Task 3: Add the new tables to the TypeScript types

**Files:**
- Modify: `types/database.ts` (add two table blocks inside the `public.Tables` object)

- [ ] **Step 1: Insert the two table type blocks**

In `types/database.ts`, locate the `Tables: {` object (the same object that contains `courses`, `course_enrollments`, etc.) and add these two entries (alphabetical placement is fine; e.g. right after the `courses` block):

```ts
      instrument_subscriptions: {
        Row: {
          id: string
          user_id: string
          instrument: string
          billing_interval: string
          stripe_customer_id: string | null
          stripe_base_subscription_id: string | null
          stripe_addon_subscription_id: string | null
          status: string
          base_current_period_end: string | null
          addon_current_period_end: string | null
          cancel_at_period_end: boolean
          pending_interval: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          instrument: string
          billing_interval: string
          stripe_customer_id?: string | null
          stripe_base_subscription_id?: string | null
          stripe_addon_subscription_id?: string | null
          status?: string
          base_current_period_end?: string | null
          addon_current_period_end?: string | null
          cancel_at_period_end?: boolean
          pending_interval?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          instrument?: string
          billing_interval?: string
          stripe_customer_id?: string | null
          stripe_base_subscription_id?: string | null
          stripe_addon_subscription_id?: string | null
          status?: string
          base_current_period_end?: string | null
          addon_current_period_end?: string | null
          cancel_at_period_end?: boolean
          pending_interval?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instrument_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_courses: {
        Row: {
          id: string
          instrument_subscription_id: string
          user_id: string
          course_id: string
          created_at: string
        }
        Insert: {
          id?: string
          instrument_subscription_id: string
          user_id: string
          course_id: string
          created_at?: string
        }
        Update: {
          id?: string
          instrument_subscription_id?: string
          user_id?: string
          course_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_courses_instrument_subscription_id_fkey"
            columns: ["instrument_subscription_id"]
            isOneToOne: false
            referencedRelation: "instrument_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: `✓ Compiled successfully`, exit 0.

- [ ] **Step 3: Commit**

```bash
git add types/database.ts
git commit -m "feat(types): add instrument_subscriptions + subscription_courses tables"
```

---

## Self-review

**Spec coverage (the data-model slice of Phase 2):**
- `instrument_subscriptions` with cadence, Stripe ids, status, period ends, `cancel_at_period_end`, `pending_interval`, unique(user,instrument) → Task 2. ✓
- Genre-course entitlement table → Task 2 (`subscription_courses`, deviation noted). ✓
- Add-on quantity = genres − 1 and the annual "separate subscription" rule → Task 1 (`addonQuantity`, `planTopology`). ✓
- Pricing ($19.99 / $9.99 / $203.90) → Task 1 constants. ✓
- RLS (own + admin read; service-role writes) → Task 2. ✓
- Types → Task 3. ✓

**Placeholder scan:** none — all SQL, TS, tests, and commands are concrete. ✓

**Type consistency:** `planTopology`/`addonQuantity` signatures match between test and impl; table column names match across the migration (Task 2) and the TS types (Task 3) exactly (`billing_interval`, `stripe_base_subscription_id`, `pending_interval`, etc.). ✓

## Prerequisites for Phase 2b (next plan)
- Create 3 recurring Stripe prices in **test mode**: base_monthly $19.99, base_annual $203.90, genre_addon_monthly $9.99; put their IDs in env vars.
- Decide the checkout mechanism for the annual + add-on case (two subscriptions): Stripe Checkout per subscription vs. direct `subscriptions.create` via the API.
