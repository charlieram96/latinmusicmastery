import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getServerTranslator } from '@/lib/i18n/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { formatEventDate, formatEventTime, pickLocalized } from '@/lib/tickets/format'
import { isFulfilledStatus, type Ticket, type TicketTier } from '@/lib/tickets/types'
import { TicketCard } from '@/components/tickets/ticket-card'
import '../../styles/events.css'

export const metadata: Metadata = { robots: { index: false, follow: false } }

/** Where a ticket's QR leads when scanned with a phone camera: the holder's ticket. */
export default async function TicketPage({ params }: { params: Promise<{ code: string }> }) {
  const [{ code }, { t, locale }] = await Promise.all([params, getServerTranslator()])
  if (!/^[A-Za-z0-9_-]{22}$/.test(code)) notFound()
  const admin = getSupabaseAdmin()
  const { data: ticket } = await admin.from('tickets').select('*, tier:ticket_tiers(*), order:ticket_orders(status)').eq('code', code).maybeSingle()
  if (!ticket) notFound()
  const { data: event } = await admin.from('ticketed_events').select('*').eq('id', ticket.event_id).single()
  if (!event) notFound()
  const orderStatus = (ticket.order as { status: string } | null)?.status ?? ''
  const valid = isFulfilledStatus(orderStatus) && event.status !== 'cancelled'

  return (
    <section className="tk-page">
      <div className="wrap">
        <div className="tk-head">
          <span className="eyebrow">{t('tickets.ticket.eyebrow')}</span>
          <h1 className="tk-title">{pickLocalized(event.title, event.title_es, locale)}</h1>
          <p className="lede">
            {formatEventDate(event.starts_at, event.timezone, locale)} · {formatEventTime(event.starts_at, event.timezone, locale)}
            {event.venue_name ? ` · ${event.venue_name}` : ''}
          </p>
          <p className="ev-notice">{valid ? t('tickets.ticket.present') : t('tickets.ticket.invalid')}</p>
          <div className="tk-actions">
            <Link className="btn btn-ghost" href={`/events/${event.slug}`}>{t('tickets.order.viewEvent')}</Link>
          </div>
        </div>
        <div className="tk-single">
          <TicketCard ticket={ticket as Ticket & { tier: TicketTier }} event={event} locale={locale} inactive={!valid} links="download" />
        </div>
      </div>
    </section>
  )
}
