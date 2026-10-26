import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CalendarDays, Clock, MapPin } from 'lucide-react'
import { getServerTranslator } from '@/lib/i18n/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { loadPublicEvent } from '@/lib/tickets/public'
import { dateBadge, formatEventDate, formatEventTime, formatPriceRange, pickLocalized } from '@/lib/tickets/format'
import { TicketPicker } from '@/components/tickets/ticket-picker'
import '../../styles/events.css'

const T = 'tickets.event'

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const { locale } = await getServerTranslator()
  const data = await loadPublicEvent(getSupabaseAdmin(), slug)
  if (!data) return { robots: { index: false } }
  const { event } = data
  const title = pickLocalized(event.title, event.title_es, locale)
  const description = pickLocalized(event.subtitle, event.subtitle_es, locale) || pickLocalized(event.description, event.description_es, locale).slice(0, 160)
  return {
    title,
    description,
    openGraph: { title, description, images: event.image_url ? [event.image_url] : undefined },
  }
}

async function viewer() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { name: '', email: '', isAdmin: false }
  const { data: profile } = await supabase.from('profiles').select('full_name, email, is_admin').eq('id', user.id).maybeSingle()
  return { name: profile?.full_name ?? '', email: user.email ?? profile?.email ?? '', isAdmin: !!profile?.is_admin }
}

export default async function EventPage({ params, searchParams }: Props) {
  const [{ slug }, query, { t, locale }, who] = await Promise.all([params, searchParams, getServerTranslator(), viewer()])
  const data = await loadPublicEvent(getSupabaseAdmin(), slug, { includeDrafts: who.isAdmin })
  if (!data) notFound()
  const { event, tiers, salesOpen, soldOut, fromCents, toCents } = data

  const title = pickLocalized(event.title, event.title_es, locale)
  const subtitle = pickLocalized(event.subtitle, event.subtitle_es, locale)
  const description = pickLocalized(event.description, event.description_es, locale)
  // Spanish visitors see the English description when none was authored, labelled as such.
  const englishOnly = locale === 'es' && !event.description_es?.trim() && !!event.description?.trim()
  const badge = dateBadge(event.starts_at, event.timezone, locale)
  const mapQuery = [event.venue_name, event.venue_address].filter(Boolean).join(', ')

  const notice =
    event.status === 'draft' ? { kind: 'warn', text: t(`${T}.draftPreview`) }
    : event.status === 'cancelled' ? { kind: 'bad', text: t(`${T}.cancelled`) }
    : !salesOpen ? { kind: 'warn', text: t(`${T}.closed`) }
    : query.checkout === 'canceled' ? { kind: 'warn', text: t(`${T}.checkoutCanceled`) }
    : null

  return (
    <>
      <section className="ev-top">
        <div className="lights" aria-hidden="true"><div className="beam b1" /><div className="beam b2" /></div>
        <div className="wrap ev-hero">
          <div className="ev-art">
            {event.image_url && (
              // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded Storage image of unknown size
              <img src={event.image_url} alt="" />
            )}
            <div className="ev-art-date" aria-hidden="true"><span>{badge.month}</span><b>{badge.day}</b></div>
          </div>
          <div>
            <nav className="crumbs" aria-label={t('marketing.common.breadcrumb')}>
              <Link href="/events">{t(`${T}.crumb`)}</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{title}</span>
            </nav>
            <h1 className="ev-title">{title}</h1>
            {subtitle && <p className="lede ev-sub">{subtitle}</p>}
            <ul className="ev-facts">
              <li>
                <CalendarDays aria-hidden />
                <div><b>{formatEventDate(event.starts_at, event.timezone, locale)}</b></div>
              </li>
              <li>
                <Clock aria-hidden />
                <div>
                  <b>{formatEventTime(event.starts_at, event.timezone, locale)}</b>
                  {event.doors_at && <span>{t(`${T}.doors`, { time: formatEventTime(event.doors_at, event.timezone, locale, false) })}</span>}
                </div>
              </li>
              {event.venue_name && (
                <li>
                  <MapPin aria-hidden />
                  <div>
                    <b>{event.venue_name}</b>
                    {event.venue_address && (
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`} target="_blank" rel="noopener noreferrer">
                        {event.venue_address}
                      </a>
                    )}
                  </div>
                </li>
              )}
            </ul>
            <div style={{ marginTop: 26, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {soldOut ? (
                <span className="ev-status off">{t(`${T}.soldOut`)}</span>
              ) : salesOpen && fromCents !== null && toCents !== null ? (
                <>
                  <a href="#tickets" className="btn btn-hot">{toCents === 0 ? t(`${T}.getFree`) : t(`${T}.getTickets`)}</a>
                  <span className="ev-status">{formatPriceRange(fromCents, toCents, event.currency, locale, t(`${T}.free`))}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 'clamp(40px,5vw,80px)' }}>
        <div className="wrap ev-body">
          <div className="ev-desc">
            <h2>{t(`${T}.about`)}</h2>
            {englishOnly && <p className="ev-status off" style={{ justifySelf: 'start' }}>{t(`${T}.englishOnly`)}</p>}
            {description
              ? description.split(/\n{2,}/).map((p, i) => <p key={i} style={{ whiteSpace: 'pre-line' }}>{p}</p>)
              : <p>{subtitle || title}</p>}
          </div>
          <aside className="ev-buy" id="tickets" style={{ display: 'grid', gap: 14 }}>
            {notice && <p className={`ev-notice ${notice.kind}`} role="status">{notice.text}</p>}
            {tiers.length > 0 ? (
              <TicketPicker
                eventId={event.id}
                currency={event.currency}
                timezone={event.timezone}
                maxPerOrder={event.max_per_order}
                salesOpen={salesOpen}
                defaultName={who.name}
                defaultEmail={who.email}
                tiers={tiers.map(({ tier, state, left }) => ({
                  id: tier.id,
                  name: pickLocalized(tier.name, tier.name_es, locale),
                  description: pickLocalized(tier.description, tier.description_es, locale),
                  priceCents: tier.price_cents,
                  state,
                  left,
                  salesStartAt: tier.sales_start_at,
                }))}
              />
            ) : (
              <p className="ev-notice">{t(`${T}.noTiers`)}</p>
            )}
          </aside>
        </div>
      </section>
    </>
  )
}
