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
