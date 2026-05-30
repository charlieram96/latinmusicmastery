// Client-safe types and formatters for pricing. The server-only loader lives in
// `pricing-source.ts` (which imports next/headers transitively and must not be
// pulled into the client bundle).

export type PricingKey = 'base_monthly' | 'base_annual' | 'addon_monthly'

export interface PricingRow {
  key: PricingKey
  amount_cents: number
  currency: string
  stripe_price_id: string
  description: string | null
  updated_at: string
}

export type PricingMap = Record<PricingKey, PricingRow>

/** USD format from integer cents, no trailing `.00`. */
export function formatCents(cents: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}

/**
 * USD format from a dollar amount. Kept for legacy callers that already deal
 * in dollars (admin financials computes MRR in dollars). Prefer `formatCents`
 * for new code that holds amounts in cents (the DB shape).
 */
export function formatCurrency(amount: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount)
}
