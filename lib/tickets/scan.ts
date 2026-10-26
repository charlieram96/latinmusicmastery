// Door check-in on the service-role client. Callers authorise first: an
// admin session, or a live scanner link (resolveScannerLink) for that event.

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { Locale } from '@/lib/i18n'
import { parseScannedValue } from './codes'
import { pickLocalized } from './format'
import { decideScan, type ScanMode, type ScanOutcome } from './scan-rules'
import type { TicketedEvent, TicketScannerLink } from './types'

type Admin = ReturnType<typeof getSupabaseAdmin>

export interface ScanActor {
  /** Shown as "checked in by" (scanner link label or admin name). */
  label: string
  scannerLinkId?: string | null
  adminUserId?: string | null
}

interface ScanRow {
  id: string
  event_id: string
  status: string
  ticket_number: string
  attendee_name: string | null
  checked_in_at: string | null
  checked_in_by: string | null
  tier: { name: string; name_es: string | null } | null
  order: { status: string } | null
}

export interface ScanStats {
  checkedIn: number
  total: number
}

export interface ScanResponse {
  outcome: ScanOutcome
  ticket: {
    ticketNumber: string
    attendeeName: string | null
    tierName: string
    checkedInAt: string | null
    checkedInBy: string | null
  } | null
  stats: ScanStats
}

export async function eventCheckInStats(admin: Admin, eventId: string): Promise<ScanStats> {
  const [total, checkedIn] = await Promise.all([
    admin
      .from('tickets')
      .select('id, order:ticket_orders!inner(status)', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .neq('status', 'void')
      .in('order.status', ['paid', 'comp']),
    admin.from('tickets').select('id', { count: 'exact', head: true }).eq('event_id', eventId).eq('status', 'checked_in'),
  ])
  return { total: total.count ?? 0, checkedIn: checkedIn.count ?? 0 }
}

export async function performScan(
  admin: Admin,
  input: { eventId: string; raw: string; mode: ScanMode; actor: ScanActor; locale: Locale },
): Promise<ScanResponse> {
  const { eventId, mode, actor, locale } = input
  const parsed = parseScannedValue(input.raw)

  let row: ScanRow | null = null
  if (parsed.kind !== 'invalid') {
    const query = admin
      .from('tickets')
      .select('id, event_id, status, ticket_number, attendee_name, checked_in_at, checked_in_by, tier:ticket_tiers(name, name_es), order:ticket_orders(status)')
    const { data } = await (parsed.kind === 'code' ? query.eq('code', parsed.code) : query.eq('ticket_number', parsed.ticketNumber)).maybeSingle()
    row = data as ScanRow | null
  }

  let outcome: ScanOutcome = decideScan(
    row ? { eventId: row.event_id, status: row.status, orderStatus: row.order?.status ?? '' } : null,
    eventId,
    mode,
  )

  let checkedInAt = row?.checked_in_at ?? null
  let checkedInBy = row?.checked_in_by ?? null
  if (row && outcome === 'admitted') {
    const now = new Date().toISOString()
    // Only one scanner can flip valid → checked_in; a racing scan sees the duplicate.
    const { data: updated } = await admin
      .from('tickets')
      .update({ status: 'checked_in', checked_in_at: now, checked_in_by: actor.label })
      .eq('id', row.id)
      .eq('status', 'valid')
      .select('checked_in_at, checked_in_by')
      .maybeSingle()
    if (updated) {
      checkedInAt = updated.checked_in_at
      checkedInBy = updated.checked_in_by
    } else {
      const { data: latest } = await admin.from('tickets').select('checked_in_at, checked_in_by').eq('id', row.id).single()
      outcome = 'already_checked_in'
      checkedInAt = latest?.checked_in_at ?? null
      checkedInBy = latest?.checked_in_by ?? null
    }
  }

  await Promise.all([
    admin.from('ticket_scans').insert({
      event_id: eventId,
      ticket_id: row && outcome !== 'wrong_event' ? row.id : null,
      scanner_link_id: actor.scannerLinkId ?? null,
      admin_user_id: actor.adminUserId ?? null,
      scanned_value: input.raw.slice(0, 200),
      result: outcome,
    }),
    actor.scannerLinkId
      ? admin.from('ticket_scanner_links').update({ last_used_at: new Date().toISOString() }).eq('id', actor.scannerLinkId)
      : null,
  ])

  const stats = await eventCheckInStats(admin, eventId)
  // Never reveal another event's attendee details.
  const ticket = row && outcome !== 'wrong_event' && outcome !== 'not_found'
    ? {
        ticketNumber: row.ticket_number,
        attendeeName: row.attendee_name,
        tierName: row.tier ? pickLocalized(row.tier.name, row.tier.name_es, locale) : '',
        checkedInAt,
        checkedInBy,
      }
    : null
  return { outcome, ticket, stats }
}

export type ScannerLinkState = 'ok' | 'revoked' | 'expired' | 'not_found'

/** A scanner link and its event, when the link may still be used. */
export async function resolveScannerLink(
  admin: Admin,
  token: string,
): Promise<{ state: ScannerLinkState; link?: TicketScannerLink; event?: TicketedEvent }> {
  if (!/^[A-Za-z0-9_-]{22}$/.test(token)) return { state: 'not_found' }
  const { data: link } = await admin.from('ticket_scanner_links').select('*').eq('token', token).maybeSingle()
  if (!link) return { state: 'not_found' }
  if (link.revoked_at) return { state: 'revoked' }
  if (link.expires_at && new Date(link.expires_at) <= new Date()) return { state: 'expired' }
  const { data: event } = await admin.from('ticketed_events').select('*').eq('id', link.event_id).maybeSingle()
  if (!event) return { state: 'not_found' }
  return { state: 'ok', link, event }
}
