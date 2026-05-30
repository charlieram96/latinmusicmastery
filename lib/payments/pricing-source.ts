// Server-only: imports `@/lib/supabase/server` which uses `next/headers`.
// Do not import from this file in a client component — use `pricing-types.ts`
// for types and formatters that are safe on both sides.

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { PricingKey, PricingMap, PricingRow } from './pricing-types'

export type { PricingKey, PricingMap, PricingRow } from './pricing-types'
export { formatCents } from './pricing-types'

const FALLBACK: PricingMap = {
  base_monthly:  { key: 'base_monthly',  amount_cents: 1999,  currency: 'usd', stripe_price_id: '', description: null, updated_at: '' },
  base_annual:   { key: 'base_annual',   amount_cents: 20390, currency: 'usd', stripe_price_id: '', description: null, updated_at: '' },
  addon_monthly: { key: 'addon_monthly', amount_cents: 999,   currency: 'usd', stripe_price_id: '', description: null, updated_at: '' },
}

/**
 * Loads the three pricing rows. Memoised per request via React `cache()` so
 * marketing pages and the subscribe flow can call this freely without
 * re-querying. Falls back to the spec defaults if the row is missing.
 */
export const getPricing = cache(async (): Promise<PricingMap> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pricing')
    .select('key, amount_cents, currency, stripe_price_id, description, updated_at')

  if (error || !data) {
    console.warn('[pricing] failed to load, using fallback:', error?.message)
    return FALLBACK
  }

  const map = { ...FALLBACK }
  for (const row of data) {
    if (row.key === 'base_monthly' || row.key === 'base_annual' || row.key === 'addon_monthly') {
      map[row.key] = row as PricingRow
    }
  }
  return map
})

/** Convenience: returns just the Stripe price_id for one key. */
export async function getStripePriceId(key: PricingKey): Promise<string> {
  const prices = await getPricing()
  return prices[key].stripe_price_id
}
