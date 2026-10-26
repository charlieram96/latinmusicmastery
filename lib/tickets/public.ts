// Read models for the public event pages (service role; only published or
// closed/cancelled events are returned, never drafts unless asked for).

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { eventSalesCloseAt, remaining, tierSaleState, type TierSaleState } from './checkout'
import type { TicketedEvent, TicketTier, TierAvailability } from './types'

type Admin = ReturnType<typeof getSupabaseAdmin>

export interface PublicTier {
  tier: TicketTier
  state: TierSaleState
  /** Tickets left, or null when the tier is uncapped. */
  left: number | null
}

export interface PublicEvent {
  event: TicketedEvent
  tiers: PublicTier[]
  /** Lowest and highest price among tiers currently on sale (null when none). */
  fromCents: number | null
  toCents: number | null
  soldOut: boolean
  salesOpen: boolean
}

export async function loadPublicEvent(admin: Admin, slug: string, { includeDrafts = false } = {}): Promise<PublicEvent | null> {
  const { data: event } = await admin.from('ticketed_events').select('*').eq('slug', slug).maybeSingle()
  if (!event || (event.status === 'draft' && !includeDrafts)) return null
  const [{ data: tiers }, { data: availability }] = await Promise.all([
    admin.from('ticket_tiers').select('*').eq('event_id', event.id).order('sort_order').order('created_at'),
    admin.rpc('ticket_event_availability', { p_event_id: event.id }),
  ])
  return summarize(event, tiers ?? [], (availability ?? []) as TierAvailability[], new Date())
}

export async function listUpcomingEvents(admin: Admin): Promise<PublicEvent[]> {
  const { data: events } = await admin
    .from('ticketed_events')
    .select('*')
    .in('status', ['published', 'closed'])
    .gte('starts_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('starts_at')
    .limit(60)
  if (!events?.length) return []
  const ids = events.map((e) => e.id)
  const [{ data: tiers }, availabilities] = await Promise.all([
    admin.from('ticket_tiers').select('*').in('event_id', ids).order('sort_order'),
    Promise.all(ids.map((id) => admin.rpc('ticket_event_availability', { p_event_id: id }))),
  ])
  const now = new Date()
  return events
    .map((event, i) =>
      summarize(event, (tiers ?? []).filter((t) => t.event_id === event.id), (availabilities[i].data ?? []) as TierAvailability[], now),
    )
    .filter((e) => now < eventSalesCloseAt(e.event))
}

function summarize(event: TicketedEvent, tiers: TicketTier[], availability: TierAvailability[], now: Date): PublicEvent {
  const takenByTier = new Map(availability.map((a) => [a.tier_id, a.taken]))
  const eventTaken = availability.reduce((sum, a) => sum + a.taken, 0)
  const eventLeft = event.capacity === null ? null : Math.max(0, event.capacity - eventTaken)
  const visible = tiers
    .filter((t) => t.is_active)
    .map((tier): PublicTier => {
      const taken = takenByTier.get(tier.id) ?? 0
      const tierLeft = remaining(tier, taken)
      const left = tierLeft === null ? eventLeft : eventLeft === null ? tierLeft : Math.min(tierLeft, eventLeft)
      return { tier, state: tierSaleState(tier, event, taken, eventTaken, now), left }
    })
  const onSale = visible.filter((t) => t.state === 'on_sale')
  const salesOpen = event.status === 'published' && now < eventSalesCloseAt(event)
  return {
    event,
    tiers: visible,
    fromCents: onSale.length ? Math.min(...onSale.map((t) => t.tier.price_cents)) : null,
    toCents: onSale.length ? Math.max(...onSale.map((t) => t.tier.price_cents)) : null,
    soldOut: salesOpen && visible.length > 0 && visible.every((t) => t.state === 'sold_out'),
    salesOpen,
  }
}
