export const PLAN_PRICES = {
  instrument: 14.99,
  all_access: 69.99,
} as const

export type PlanType = keyof typeof PLAN_PRICES

export function getPlanPrice(planType: string): number {
  return PLAN_PRICES[planType as PlanType] ?? 0
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}
