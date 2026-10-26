import { describe, expect, it } from 'vitest'
import { eventSalesCloseAt, reserveErrorToCartError, seatPlan, tierSaleState, validateCart } from '../checkout'
import type { TicketTier, TicketedEvent } from '../types'

const now = new Date('2026-11-01T12:00:00Z')

function event(overrides: Partial<TicketedEvent> = {}): TicketedEvent {
  return {
    id: 'e1', slug: 'noche', status: 'published', title: 'Noche', title_es: null, subtitle: null, subtitle_es: null,
    description: null, description_es: null, venue_name: null, venue_address: null,
    starts_at: '2026-11-22T01:00:00Z', ends_at: null, doors_at: null, timezone: 'America/New_York', currency: 'usd',
    capacity: null, max_per_order: 6, image_url: null, ticket_design: {}, email_message: null, email_message_es: null,
    created_by: null, created_at: '', updated_at: '', ...overrides,
  }
}

function tier(id: string, overrides: Partial<TicketTier> = {}): TicketTier {
  return {
    id, event_id: 'e1', name: id, name_es: null, description: null, description_es: null, price_cents: 2500,
    capacity: null, sales_start_at: null, sales_end_at: null, is_active: true, sort_order: 0, created_at: '', updated_at: '', ...overrides,
  }
}

const avail = (tier_id: string, taken: number) => ({ tier_id, taken, sold: taken, checked_in: 0 })

describe('validateCart', () => {
  it('totals a valid cart and merges duplicate lines', () => {
    const result = validateCart({
      event: event(),
      tiers: [tier('ga', { sort_order: 1 }), tier('vip', { price_cents: 6000, sort_order: 0 })],
      availability: [avail('ga', 0), avail('vip', 0)],
      items: [{ tierId: 'ga', quantity: 1 }, { tierId: 'vip', quantity: 1 }, { tierId: 'ga', quantity: 1 }, { tierId: 'vip', quantity: 0 }],
      now,
    })
    expect(result).toMatchObject({ ok: true, totalCents: 11000, totalQuantity: 3 })
    if (result.ok) expect(result.lines.map((l) => [l.tier.id, l.quantity])).toEqual([['vip', 1], ['ga', 2]])
  })

  it('enforces per-order, tier and event limits', () => {
    const base = { tiers: [tier('ga', { capacity: 10 })], now }
    expect(validateCart({ ...base, event: event(), availability: [avail('ga', 0)], items: [{ tierId: 'ga', quantity: 7 }] })).toMatchObject({ ok: false, error: 'too_many' })
    expect(validateCart({ ...base, event: event(), availability: [avail('ga', 9)], items: [{ tierId: 'ga', quantity: 2 }] })).toMatchObject({ ok: false, error: 'sold_out', tierId: 'ga' })
    expect(validateCart({ ...base, event: event(), availability: [avail('ga', 10)], items: [{ tierId: 'ga', quantity: 1 }] })).toMatchObject({ ok: false, error: 'sold_out' })
    expect(validateCart({ ...base, event: event({ capacity: 5 }), availability: [avail('ga', 4)], items: [{ tierId: 'ga', quantity: 2 }] })).toMatchObject({ ok: false, error: 'sold_out' })
  })

  it('rejects empty, malformed, unknown and closed purchases', () => {
    const tiers = [tier('ga'), tier('late', { sales_start_at: '2026-11-10T00:00:00Z' }), tier('off', { is_active: false })]
    const availability = [avail('ga', 0)]
    expect(validateCart({ event: event(), tiers, availability, items: [], now })).toMatchObject({ ok: false, error: 'empty' })
    expect(validateCart({ event: event(), tiers, availability, items: [{ tierId: 'ga', quantity: 1.5 }], now })).toMatchObject({ ok: false, error: 'invalid_quantity' })
    expect(validateCart({ event: event(), tiers, availability, items: [{ tierId: 'zzz', quantity: 1 }], now })).toMatchObject({ ok: false, error: 'unknown_tier' })
    expect(validateCart({ event: event(), tiers, availability, items: [{ tierId: 'late', quantity: 1 }], now })).toMatchObject({ ok: false, error: 'tier_unavailable' })
    expect(validateCart({ event: event(), tiers, availability, items: [{ tierId: 'off', quantity: 1 }], now })).toMatchObject({ ok: false, error: 'tier_unavailable' })
    expect(validateCart({ event: event({ status: 'draft' }), tiers, availability, items: [{ tierId: 'ga', quantity: 1 }], now })).toMatchObject({ ok: false, error: 'event_unavailable' })
    expect(validateCart({ event: event(), tiers, availability, items: [{ tierId: 'ga', quantity: 1 }], now: new Date('2026-11-22T05:00:00Z') })).toMatchObject({ ok: false, error: 'event_unavailable' })
  })
})

describe('tierSaleState', () => {
  it('reports each state', () => {
    const e = event()
    expect(tierSaleState(tier('a'), e, 0, 0, now)).toBe('on_sale')
    expect(tierSaleState(tier('a', { is_active: false }), e, 0, 0, now)).toBe('inactive')
    expect(tierSaleState(tier('a', { sales_start_at: '2026-11-02T00:00:00Z' }), e, 0, 0, now)).toBe('not_started')
    expect(tierSaleState(tier('a', { sales_end_at: '2026-10-31T00:00:00Z' }), e, 0, 0, now)).toBe('ended')
    expect(tierSaleState(tier('a', { capacity: 3 }), e, 3, 3, now)).toBe('sold_out')
    expect(tierSaleState(tier('a'), event({ capacity: 5 }), 0, 5, now)).toBe('sold_out')
  })

  it('closes sales at the end, or three hours after the start', () => {
    expect(eventSalesCloseAt(event()).toISOString()).toBe('2026-11-22T04:00:00.000Z')
    expect(eventSalesCloseAt(event({ ends_at: '2026-11-22T06:00:00Z' })).toISOString()).toBe('2026-11-22T06:00:00.000Z')
  })
})

describe('seatPlan', () => {
  it('numbers one seat per admission in tier order', () => {
    const plan = seatPlan([
      { tier_id: 'ga', quantity: 2, tier: { sort_order: 1 } },
      { tier_id: 'vip', quantity: 1, tier: { sort_order: 0 } },
    ])
    expect(plan).toEqual([{ seq: 1, tierId: 'vip' }, { seq: 2, tierId: 'ga' }, { seq: 3, tierId: 'ga' }])
  })
})

describe('reserveErrorToCartError', () => {
  it('maps database exceptions', () => {
    expect(reserveErrorToCartError('sold_out:abc')).toBe('sold_out')
    expect(reserveErrorToCartError('event_sold_out')).toBe('sold_out')
    expect(reserveErrorToCartError('tier_not_found')).toBe('unknown_tier')
    expect(reserveErrorToCartError('something else')).toBe('event_unavailable')
  })
})
