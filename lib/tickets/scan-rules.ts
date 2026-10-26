// Pure door-check rules. The scanner route looks the ticket up, asks
// decideScan what the outcome is, and only then performs the atomic check-in.

export type ScanMode = 'checkin' | 'verify'

export type ScanOutcome =
  | 'admitted'
  | 'verified'
  | 'already_checked_in'
  | 'void'
  | 'refunded'
  | 'wrong_event'
  | 'not_found'

export interface ScanTicketState {
  eventId: string
  status: string
  orderStatus: string
}

export function decideScan(ticket: ScanTicketState | null, eventId: string, mode: ScanMode): ScanOutcome {
  if (!ticket) return 'not_found'
  if (ticket.eventId !== eventId) return 'wrong_event'
  if (ticket.orderStatus === 'refunded') return 'refunded'
  if (ticket.status === 'void' || (ticket.orderStatus !== 'paid' && ticket.orderStatus !== 'comp')) return 'void'
  if (ticket.status === 'checked_in') return 'already_checked_in'
  return mode === 'checkin' ? 'admitted' : 'verified'
}

/** Outcomes that let the holder in (shown green at the door). */
export function isEntryOutcome(outcome: ScanOutcome): boolean {
  return outcome === 'admitted' || outcome === 'verified'
}
