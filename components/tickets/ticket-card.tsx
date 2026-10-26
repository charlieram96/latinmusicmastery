import { getTranslation, type Locale } from '@/lib/i18n'
import { qrSvg } from '@/lib/tickets/symbols'
import { formatEventTime, pickLocalized } from '@/lib/tickets/format'
import { ticketUrl } from '@/lib/tickets/pdf'
import { appUrl } from '@/lib/tickets/urls'
import type { Ticket, TicketedEvent, TicketTier } from '@/lib/tickets/types'

interface TicketCardProps {
  ticket: Ticket & { tier: TicketTier }
  event: TicketedEvent
  locale: Locale
  /** Hide the QR (order not paid, refunded, void). */
  inactive?: boolean
  /** 'download' on the ticket's own page, where "open" would link to itself. */
  links?: 'all' | 'download'
}

/** Web version of a ticket: the same QR the PDF carries, plus its state. */
export function TicketCard({ ticket, event, locale, inactive = false, links = 'all' }: TicketCardProps) {
  const t = (key: string, params?: Record<string, string | number>) => getTranslation(locale, `tickets.card.${key}`, params)
  const tier = pickLocalized(ticket.tier.name, ticket.tier.name_es, locale)
  const dim = inactive || ticket.status === 'void'
  const svg = qrSvg(ticketUrl(appUrl(), ticket.code), { title: t('qrLabel', { number: ticket.ticket_number }) })

  return (
    <article className="tk-card" data-dim={dim}>
      <div className="tk-card-top">
        <span className="eyebrow">{tier}</span>
        <h2>{pickLocalized(event.title, event.title_es, locale)}</h2>
        {ticket.attendee_name && <p>{ticket.attendee_name}</p>}
      </div>
      <div className="tk-card-qr">
        <div className="tk-qr" dangerouslySetInnerHTML={{ __html: svg }} />
        <span className="tk-num">{ticket.ticket_number}</span>
        {ticket.status === 'checked_in' ? (
          <span className="tk-chip used">
            {t('checkedIn', { time: ticket.checked_in_at ? formatEventTime(ticket.checked_in_at, event.timezone, locale, false) : '' })}
          </span>
        ) : dim ? (
          <span className="tk-chip void">{t('notValid')}</span>
        ) : (
          <span className="tk-chip ok">{t('valid')}</span>
        )}
        {!dim && (
          <div className="tk-card-links">
            {links === 'all' && <a href={`/t/${ticket.code}`}>{t('open')}</a>}
            <a href={`/api/tickets/pdf?ticket=${ticket.code}&lang=${locale}&download=1`}>{t('download')}</a>
          </div>
        )}
      </div>
    </article>
  )
}
