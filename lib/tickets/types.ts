import type { Tables } from '@/types/database'

export type TicketedEvent = Tables<'ticketed_events'>
export type TicketTier = Tables<'ticket_tiers'>
export type TicketOrder = Tables<'ticket_orders'>
export type TicketOrderItem = Tables<'ticket_order_items'>
export type Ticket = Tables<'tickets'>
export type TicketScannerLink = Tables<'ticket_scanner_links'>

export type EventStatus = 'draft' | 'published' | 'closed' | 'cancelled'
export type OrderStatus = 'pending' | 'paid' | 'comp' | 'expired' | 'cancelled' | 'refunded'
export type TicketStatus = 'valid' | 'checked_in' | 'void'

export interface TierAvailability {
  tier_id: string
  /** Paid/comp admissions (minus voids) plus live checkout holds. */
  taken: number
  /** Paid/comp tickets issued, excluding void. */
  sold: number
  checked_in: number
}

/** Everything needed to show, email or render one order. */
export interface OrderBundle {
  order: TicketOrder
  event: TicketedEvent
  items: Array<TicketOrderItem & { tier: TicketTier }>
  tickets: Array<Ticket & { tier: TicketTier }>
}

export function isFulfilledStatus(status: string): boolean {
  return status === 'paid' || status === 'comp'
}
