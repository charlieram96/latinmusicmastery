// Order confirmation email with the tickets PDF attached.

import { getTranslation, type Locale } from '@/lib/i18n'
import { wrapBrandedEmail } from '@/lib/email/templates'
import { orderReference } from './codes'
import { formatEventDate, formatEventTime, formatMoney, pickLocalized } from './format'
import { orderPageUrl } from './urls'
import type { OrderBundle } from './types'

const AMBER = '#D8943C'
const INK = '#1f1819'
const MUTED = '#6b6466'

export function composeOrderEmail(bundle: OrderBundle): { subject: string; html: string; text: string } {
  const { order, event } = bundle
  const locale = order.locale as Locale
  const t = (key: string, params?: Record<string, string | number>) => getTranslation(locale, `tickets.email.${key}`, params)
  const title = pickLocalized(event.title, event.title_es, locale)
  const tickets = bundle.tickets.filter((tk) => tk.status !== 'void')
  const subject = t('subject', { event: title })

  const date = formatEventDate(event.starts_at, event.timezone, locale)
  const time = formatEventTime(event.starts_at, event.timezone, locale)
  const doors = event.doors_at ? formatEventTime(event.doors_at, event.timezone, locale, false) : null
  const message = pickLocalized(event.email_message, event.email_message_es, locale).trim()
  const messageInEnglish = locale === 'es' && !event.email_message_es?.trim() && !!message
  const link = orderPageUrl(order.access_token)

  const rows: Array<[string, string]> = [
    [t('when'), `${date} · ${time}${doors ? ` (${t('doors', { time: doors })})` : ''}`],
  ]
  if (event.venue_name) rows.push([t('where'), [event.venue_name, event.venue_address].filter(Boolean).join(' — ')])
  rows.push([t('order'), orderReference(order.id)])
  if (order.status === 'paid' && order.amount_total_cents > 0) {
    rows.push([t('total'), formatMoney(order.amount_total_cents, order.currency, locale)])
  }

  const detailRows = rows
    .map(([label, value]) => `<tr>
      <td style="padding:6px 12px 6px 0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${MUTED};vertical-align:top;white-space:nowrap;">${esc(label)}</td>
      <td style="padding:6px 0;font-size:15px;color:${INK};line-height:1.45;">${esc(value)}</td>
    </tr>`)
    .join('')

  const ticketRows = tickets
    .map((tk) => `<tr>
      <td style="padding:8px 0;border-top:1px solid #eee5dc;font-size:15px;color:${INK};">${esc(pickLocalized(tk.tier.name, tk.tier.name_es, locale))}${tk.attendee_name ? ` <span style="color:${MUTED};">· ${esc(tk.attendee_name)}</span>` : ''}</td>
      <td style="padding:8px 0;border-top:1px solid #eee5dc;font-size:13px;color:${MUTED};text-align:right;font-family:Menlo,Consolas,monospace;">${esc(tk.ticket_number)}</td>
    </tr>`)
    .join('')

  const messageHtml = message
    ? (messageInEnglish ? `<p style="margin:0 0 6px 0;font-size:13px;color:${MUTED};">${esc(t('messageEnglishOnly'))}</p>` : '') +
      message
        .split(/\n{2,}/)
        .map((p) => `<p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:${INK};">${esc(p).replace(/\n/g, '<br />')}</p>`)
        .join('')
    : ''

  const bodyHtml = `
    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:${AMBER};font-weight:600;">${esc(t('eyebrow'))}</p>
    <h1 style="margin:0 0 14px 0;font-size:26px;line-height:1.2;color:${INK};">${esc(title)}</h1>
    <p style="margin:0 0 18px 0;font-size:15px;line-height:1.6;color:${INK};">${esc(t('greeting', { name: order.buyer_name }))} ${esc(t(`${order.status === 'comp' ? 'introComp' : 'intro'}${tickets.length === 1 ? 'One' : 'Many'}`, { count: tickets.length }))}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;">${detailRows}</table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0;">${ticketRows}</table>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0;"><tr><td style="border-radius:999px;background:${AMBER};">
      <a href="${link}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#1a0b0f;text-decoration:none;border-radius:999px;">${esc(t('viewOnline'))}</a>
    </td></tr></table>
    ${messageHtml}
    <p style="margin:0 0 8px 0;font-size:14px;line-height:1.6;color:${MUTED};">${esc(t('howTo'))}</p>
  `

  const { html, text } = wrapBrandedEmail({ subject, bodyHtml, footerNote: t('footer'), lang: locale })
  return { subject, html, text }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
