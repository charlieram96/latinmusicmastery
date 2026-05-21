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
