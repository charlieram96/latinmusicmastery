// Pure sale rules shared by the public event page (what to show) and the
// checkout route (what to accept). Capacity is enforced again atomically in
// the reserve_ticket_order SQL function; these checks give friendly errors.

import type { TicketedEvent, TicketTier, TierAvailability } from './types'

export type TierSaleState = 'on_sale' | 'sold_out' | 'not_started' | 'ended' | 'inactive'

/** Online sales close when the event ends (or 3 hours after it starts). */
export function eventSalesCloseAt(event: Pick<TicketedEvent, 'starts_at' | 'ends_at'>): Date {
  if (event.ends_at) return new Date(event.ends_at)
  return new Date(new Date(event.starts_at).getTime() + 3 * 60 * 60 * 1000)
}

export function remaining(tier: Pick<TicketTier, 'capacity'>, taken: number): number | null {
  return tier.capacity === null ? null : Math.max(0, tier.capacity - taken)
}

export function tierSaleState(
  tier: Pick<TicketTier, 'is_active' | 'capacity' | 'sales_start_at' | 'sales_end_at'>,
  event: Pick<TicketedEvent, 'starts_at' | 'ends_at' | 'capacity'>,
  taken: number,
  eventTaken: number,
  now: Date,
): TierSaleState {
  if (!tier.is_active) return 'inactive'
  if (tier.sales_start_at && now < new Date(tier.sales_start_at)) return 'not_started'
  if (tier.sales_end_at && now >= new Date(tier.sales_end_at)) return 'ended'
  if (now >= eventSalesCloseAt(event)) return 'ended'
  if (tier.capacity !== null && taken >= tier.capacity) return 'sold_out'
  if (event.capacity !== null && eventTaken >= event.capacity) return 'sold_out'
  return 'on_sale'
}

export interface CartItem {
  tierId: string
  quantity: number
}

export type CartError =
  | 'event_unavailable'
  | 'empty'
  | 'invalid_quantity'
  | 'too_many'
  | 'unknown_tier'
  | 'tier_unavailable'
  | 'sold_out'

export type CartResult =
  | { ok: true; lines: Array<{ tier: TicketTier; quantity: number }>; totalCents: number; totalQuantity: number }
  | { ok: false; error: CartError; tierId?: string }

export function validateCart(input: {
  event: TicketedEvent
  tiers: TicketTier[]
  availability: TierAvailability[]
  items: CartItem[]
  now: Date
}): CartResult {
  const { event, tiers, availability, now } = input
  if (event.status !== 'published' || now >= eventSalesCloseAt(event)) return { ok: false, error: 'event_unavailable' }

  const merged = new Map<string, number>()
  for (const item of input.items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 0) return { ok: false, error: 'invalid_quantity' }
    if (item.quantity === 0) continue
    merged.set(item.tierId, (merged.get(item.tierId) ?? 0) + item.quantity)
  }
  if (merged.size === 0) return { ok: false, error: 'empty' }

  const totalQuantity = [...merged.values()].reduce((a, b) => a + b, 0)
  if (totalQuantity > event.max_per_order) return { ok: false, error: 'too_many' }

  const takenByTier = new Map(availability.map((a) => [a.tier_id, a.taken]))
  const eventTaken = availability.reduce((sum, a) => sum + a.taken, 0)
  const lines: Array<{ tier: TicketTier; quantity: number }> = []
  let totalCents = 0
  for (const [tierId, quantity] of merged) {
    const tier = tiers.find((t) => t.id === tierId && t.event_id === event.id)
    if (!tier) return { ok: false, error: 'unknown_tier', tierId }
    const taken = takenByTier.get(tierId) ?? 0
    const state = tierSaleState(tier, event, taken, eventTaken, now)
    if (state === 'sold_out') return { ok: false, error: 'sold_out', tierId }
    if (state !== 'on_sale') return { ok: false, error: 'tier_unavailable', tierId }
    const left = remaining(tier, taken)
    if (left !== null && quantity > left) return { ok: false, error: 'sold_out', tierId }
    lines.push({ tier, quantity })
    totalCents += tier.price_cents * quantity
  }
  if (event.capacity !== null && eventTaken + totalQuantity > event.capacity) return { ok: false, error: 'sold_out' }

  lines.sort((a, b) => a.tier.sort_order - b.tier.sort_order)
  return { ok: true, lines, totalCents, totalQuantity }
}

/** Map the reserve_ticket_order exception text to a cart error. */
export function reserveErrorToCartError(message: string): CartError {
  if (message.includes('sold_out')) return 'sold_out'
  if (message.includes('invalid_quantity')) return 'invalid_quantity'
  if (message.includes('empty_order')) return 'empty'
  if (message.includes('tier_not_found')) return 'unknown_tier'
  return 'event_unavailable'
}

/**
 * Ticket seats for an order: one per admission, numbered from 1 in tier
 * display order. Fulfillment inserts exactly these (order_id, seq) rows.
 */
export function seatPlan(items: Array<{ tier_id: string; quantity: number; tier: Pick<TicketTier, 'sort_order'> }>): Array<{ seq: number; tierId: string }> {
  const sorted = [...items].sort((a, b) => a.tier.sort_order - b.tier.sort_order || a.tier_id.localeCompare(b.tier_id))
  const seats: Array<{ seq: number; tierId: string }> = []
  for (const item of sorted) {
    for (let i = 0; i < item.quantity; i++) seats.push({ seq: seats.length + 1, tierId: item.tier_id })
  }
  return seats
}
