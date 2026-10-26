import type { Metadata } from 'next'
import Link from 'next/link'
import { getServerTranslator } from '@/lib/i18n/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { listUpcomingEvents } from '@/lib/tickets/public'
import { dateBadge, formatEventShortDate, formatEventTime, formatPriceRange, pickLocalized } from '@/lib/tickets/format'
import { PageHead, Accent } from '@/components/marketing/site/PageHead'
import '../styles/events.css'

const T = 'tickets.list'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator()
  return { title: t(`${T}.metaTitle`), description: t(`${T}.lede`) }
}

export default async function EventsPage() {
  const { t, locale } = await getServerTranslator()
  const events = await listUpcomingEvents(getSupabaseAdmin())

  return (
    <>
      <PageHead
        crumbsLabel={t('marketing.common.breadcrumb')}
        crumbs={[{ label: t('marketing.site.common.home'), href: '/' }, { label: t(`${T}.crumb`) }]}
        title={<>{t(`${T}.title`)} <Accent>{t(`${T}.titleAccent`)}</Accent></>}
        lede={t(`${T}.lede`)}
      />
      <section className="sec" style={{ paddingTop: 'clamp(40px,5vw,80px)' }}>
        <div className="wrap">
          {events.length === 0 ? (
            <p className="ev-empty">{t(`${T}.empty`)}</p>
          ) : (
            <div className="ev-list">
              {events.map(({ event, fromCents, toCents, soldOut, salesOpen }) => {
                const badge = dateBadge(event.starts_at, event.timezone, locale)
                return (
                  <Link key={event.id} href={`/events/${event.slug}`} className="ev-card">
                    <div className="ev-art">
                      {event.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded Storage image of unknown size
                        <img src={event.image_url} alt="" loading="lazy" />
                      )}
                      <div className="ev-art-date" aria-hidden="true"><span>{badge.month}</span><b>{badge.day}</b></div>
                    </div>
                    <div className="ev-card-body">
                      <h2>{pickLocalized(event.title, event.title_es, locale)}</h2>
                      <p className="ev-card-meta">
                        {formatEventShortDate(event.starts_at, event.timezone, locale)} · {formatEventTime(event.starts_at, event.timezone, locale)}
                        {event.venue_name ? ` · ${event.venue_name}` : ''}
                      </p>
                      <div className="ev-card-foot">
                        {soldOut ? (
                          <span className="ev-status off">{t('tickets.event.soldOut')}</span>
                        ) : !salesOpen ? (
                          <span className="ev-status off">{t(`${T}.salesClosed`)}</span>
                        ) : fromCents !== null && toCents !== null ? (
                          <b>{formatPriceRange(fromCents, toCents, event.currency, locale, t('tickets.event.free'))}</b>
                        ) : <span />}
                        <span className="ev-status hot">{t(`${T}.view`)}</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
