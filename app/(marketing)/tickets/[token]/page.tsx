import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getServerTranslator } from '@/lib/i18n/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { loadOrderBundle } from '@/lib/tickets/orders'
import { orderReference } from '@/lib/tickets/codes'
import { formatEventDate, formatEventTime, pickLocalized } from '@/lib/tickets/format'
import { isFulfilledStatus } from '@/lib/tickets/types'
import { TicketCard } from '@/components/tickets/ticket-card'
import { PendingRefresh } from '@/components/tickets/pending-refresh'
import '../../styles/events.css'

const T = 'tickets.order'

export const metadata: Metadata = { robots: { index: false, follow: false } }

type Props = { params: Promise<{ token: string }> }

export default async function OrderPage({ params }: Props) {
  const [{ token }, { t, locale }] = await Promise.all([params, getServerTranslator()])
  if (!/^[A-Za-z0-9_-]{22}$/.test(token)) notFound()
  // Read-only: Stripe confirmation happens in /api/events/checkout/success.
  const bundle = await loadOrderBundle(getSupabaseAdmin(), { accessToken: token })
  if (!bundle) notFound()

  const { order, event, tickets } = bundle
  const title = pickLocalized(event.title, event.title_es, locale)
  const fulfilled = isFulfilledStatus(order.status)
  const live = tickets.filter((tk) => tk.status !== 'void')

  const banner =
    order.status === 'pending' ? { kind: 'warn', text: t(`${T}.pending`) }
    : order.status === 'refunded' ? { kind: 'bad', text: t(`${T}.refunded`) }
    : order.status === 'expired' || order.status === 'cancelled' ? { kind: 'bad', text: t(`${T}.expired`) }
    : event.status === 'cancelled' ? { kind: 'bad', text: t(`${T}.eventCancelled`) }
    : fulfilled && live.length > 0 ? { kind: 'good', text: t(`${T}.ready`, { email: order.buyer_email }) }
    : null

  return (
    <section className="tk-page">
      {order.status === 'pending' && <PendingRefresh />}
      <div className="wrap">
        <div className="tk-head">
          <span className="eyebrow">{t(`${T}.eyebrow`, { ref: orderReference(order.id) })}</span>
          <h1 className="tk-title">{t(`${T}.title`)}</h1>
          <p className="lede">
            {title} · {formatEventDate(event.starts_at, event.timezone, locale)} · {formatEventTime(event.starts_at, event.timezone, locale)}
            {event.venue_name ? ` · ${event.venue_name}` : ''}
          </p>
          {banner && <p className={`ev-notice ${banner.kind}`} role="status">{banner.text}</p>}
          <div className="tk-actions">
            {fulfilled && live.length > 0 && (
              <a className="btn btn-hot" href={`/api/tickets/pdf?order=${token}&lang=${locale}&download=1`}>{t(`${T}.downloadAll`)}</a>
            )}
            <Link className="btn btn-ghost" href={`/events/${event.slug}`}>{t(`${T}.viewEvent`)}</Link>
          </div>
        </div>
        {fulfilled && tickets.length > 0 && (
          <div className="tk-grid">
            {tickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} event={event} locale={locale} inactive={event.status === 'cancelled'} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
