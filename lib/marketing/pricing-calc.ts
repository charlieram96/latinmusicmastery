export type Billing = 'm' | 'y'

export interface PriceCents { base_monthly: number; base_annual: number; addon_monthly: number }

export interface Quote {
  amountCents: number
  per: 'mo' | 'yr'
  /** Styles after clamping (the first one is included). */
  styles: number
  /** Monthly add-on charge for the extra styles (billed monthly on both plans). */
  extraMonthlyCents: number
  /** What a year of monthly base billing costs above the annual price (0 on monthly). */
  savingsCents: number
}

/** Price one instrument subscription: base (monthly or yearly) + $addon/mo per extra style. */
export function quote({ billing, styles, maxStyles, prices }: { billing: Billing; styles: number; maxStyles: number; prices: PriceCents }): Quote {
  const n = Math.min(Math.max(1, Math.round(styles)), Math.max(1, maxStyles))
  const extraMonthlyCents = (n - 1) * prices.addon_monthly
  if (billing === 'y') {
    return { amountCents: prices.base_annual, per: 'yr', styles: n, extraMonthlyCents, savingsCents: Math.max(0, prices.base_monthly * 12 - prices.base_annual) }
  }
  return { amountCents: prices.base_monthly + extraMonthlyCents, per: 'mo', styles: n, extraMonthlyCents, savingsCents: 0 }
}

/** Whole-percent saving of yearly over twelve monthly payments. */
export function yearlySavingPercent(prices: PriceCents): number {
  const full = prices.base_monthly * 12
  return full > 0 ? Math.max(0, Math.round((1 - prices.base_annual / full) * 100)) : 0
}
