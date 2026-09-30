import { describe, expect, it } from 'vitest'
import { quote } from '../pricing-calc'

const prices = { base_monthly: 1999, base_annual: 19999, addon_monthly: 999 }

describe('quote', () => {
  it('monthly with the included style is the base price', () => {
    expect(quote({ billing: 'm', styles: 1, maxStyles: 10, prices })).toEqual({ amountCents: 1999, per: 'mo', styles: 1, extraMonthlyCents: 0, savingsCents: 0 })
  })
  it('adds one add-on per extra style on monthly', () => {
    expect(quote({ billing: 'm', styles: 3, maxStyles: 10, prices }).amountCents).toBe(1999 + 2 * 999)
  })
  it('yearly bills the base yearly and keeps extras monthly', () => {
    expect(quote({ billing: 'y', styles: 3, maxStyles: 10, prices })).toEqual({ amountCents: 19999, per: 'yr', styles: 3, extraMonthlyCents: 1998, savingsCents: 1999 * 12 - 19999 })
  })
  it('clamps styles into [1, maxStyles]', () => {
    expect(quote({ billing: 'm', styles: 0, maxStyles: 4, prices }).styles).toBe(1)
    expect(quote({ billing: 'm', styles: 9, maxStyles: 4, prices }).styles).toBe(4)
  })
  it('treats an instrument with no style courses as one included style', () => {
    expect(quote({ billing: 'm', styles: 3, maxStyles: 0, prices }).styles).toBe(1)
  })
  it('never reports negative savings when the annual price is higher', () => {
    expect(quote({ billing: 'y', styles: 1, maxStyles: 3, prices: { ...prices, base_annual: 99999 } }).savingsCents).toBe(0)
  })
})
