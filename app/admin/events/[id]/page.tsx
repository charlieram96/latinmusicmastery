import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { normalizeTicketDesign } from '@/lib/tickets/design'
import { scannerPageUrl, appUrl } from '@/lib/tickets/urls'
import { qrSvg } from '@/lib/tickets/symbols'
import type { TierAvailability } from '@/lib/tickets/types'
import { EventManager, type ManagerOrder, type ManagerScannerLink } from '@/components/admin/events/event-manager'

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function AdminEventPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const supabase = await createClient()
  if ('error' in (await requireAdmin(supabase))) notFound()
  const service = getSupabaseAdmin()

  const { data: event } = await service.from('ticketed_events').select('*').eq('id', id).maybeSingle()
  if (!event) notFound()

  const [{ data: tiers }, { data: availability }, { data: orders }, { data: links }, { data: scans }] = await Promise.all([
    service.from('ticket_tiers').select('*').eq('event_id', id).order('sort_order').order('created_at'),
    service.rpc('ticket_event_availability', { p_event_id: id }),
    service
      .from('ticket_orders')
      .select('id, status, source, buyer_name, buyer_email, locale, access_token, amount_total_cents, currency, paid_at, created_at, expires_at, refunded_at, email_status, email_sent_at, email_error, notes, user_id, items:ticket_order_items(tier_id, quantity, unit_price_cents), tickets(id, tier_id, seq, ticket_number, code, attendee_name, status, checked_in_at, checked_in_by)')
      .eq('event_id', id)
      .order('created_at', { ascending: false }),
    service.from('ticket_scanner_links').select('*').eq('event_id', id).order('created_at', { ascending: false }),
    service
      .from('ticket_scans')
      .select('id, result, scanned_value, created_at, ticket:tickets(ticket_number, attendee_name)')
      .eq('event_id', id)
      .order('created_at', { ascending: false })
      .limit(25),
  ])

  const scanCounts = await Promise.all(
    (links ?? []).map((l) => service.from('ticket_scans').select('id', { count: 'exact', head: true }).eq('scanner_link_id', l.id)),
  )
  const scannerLinks: ManagerScannerLink[] = (links ?? []).map((l, i) => ({
    id: l.id,
    label: l.label,
    url: scannerPageUrl(l.token),
    qrSvg: l.revoked_at ? null : qrSvg(scannerPageUrl(l.token), { title: l.label }),
    expiresAt: l.expires_at,
    revokedAt: l.revoked_at,
    lastUsedAt: l.last_used_at,
    createdAt: l.created_at,
    scans: scanCounts[i].count ?? 0,
  }))

  const tab = typeof query.tab === 'string' ? query.tab : 'overview'

  return (
    <EventManager
      initialTab={tab}
      event={event}
      design={normalizeTicketDesign(event.ticket_design)}
      tiers={tiers ?? []}
      availability={(availability ?? []) as TierAvailability[]}
      orders={(orders ?? []) as unknown as ManagerOrder[]}
      scannerLinks={scannerLinks}
      recentScans={(scans ?? []).map((s) => ({
        id: s.id,
        result: s.result,
        value: s.scanned_value,
        at: s.created_at,
        ticketNumber: (s.ticket as { ticket_number: string } | null)?.ticket_number ?? null,
        attendee: (s.ticket as { attendee_name: string | null } | null)?.attendee_name ?? null,
      }))}
      publicUrl={`${appUrl()}/events/${event.slug}`}
    />
  )
}
