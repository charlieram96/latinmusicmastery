// Turns stored events/orders into ticket PDFs (server only).

import type { Locale } from '@/lib/i18n'
import { normalizeTicketDesign, type TicketDesign } from './design'
import { loadTicketFonts, resolveDesignImages } from './assets'
import { renderTicketsPdf, type TicketPdfEvent, type TicketPdfTicket } from './pdf'
import { orderReference } from './codes'
import { pickLocalized } from './format'
import { appUrl } from './urls'
import type { OrderBundle, TicketedEvent, TicketTier } from './types'

export function pdfEvent(event: TicketedEvent, locale: Locale): TicketPdfEvent {
  return {
    title: pickLocalized(event.title, event.title_es, locale),
    subtitle: pickLocalized(event.subtitle, event.subtitle_es, locale) || null,
    venueName: event.venue_name,
    venueAddress: event.venue_address,
    startsAt: event.starts_at,
    doorsAt: event.doors_at,
    timezone: event.timezone,
    currency: event.currency,
  }
}

export async function buildOrderPdf(
  bundle: OrderBundle,
  options: { locale?: Locale; ticketIds?: string[] } = {},
): Promise<Uint8Array> {
  const locale = options.locale ?? (bundle.order.locale as Locale)
  const design = normalizeTicketDesign(bundle.event.ticket_design)
  const priceByTier = new Map(bundle.items.map((i) => [i.tier_id, i.unit_price_cents]))
  const comp = bundle.order.status === 'comp'
  const tickets: TicketPdfTicket[] = bundle.tickets
    .filter((t) => t.status !== 'void' && (!options.ticketIds || options.ticketIds.includes(t.id)))
    .map((t) => ({
      ticketNumber: t.ticket_number,
      code: t.code,
      tierName: pickLocalized(t.tier.name, t.tier.name_es, locale),
      priceCents: priceByTier.get(t.tier_id) ?? t.tier.price_cents,
      comp,
      attendeeName: t.attendee_name ?? bundle.order.buyer_name,
      orderRef: orderReference(bundle.order.id),
    }))
  return renderEventTickets(bundle.event, design, tickets, locale)
}

/** Sample ticket for the admin designer, using unsaved design values. */
export async function buildPreviewPdf(
  event: TicketedEvent,
  tiers: TicketTier[],
  design: TicketDesign,
  locale: Locale,
): Promise<Uint8Array> {
  const tier = tiers.find((t) => t.is_active) ?? tiers[0]
  const sample: TicketPdfTicket = {
    ticketNumber: 'LMM-DEM0-2026',
    code: 'preview-not-a-real-tkt',
    tierName: tier ? pickLocalized(tier.name, tier.name_es, locale) : locale === 'es' ? 'Entrada general' : 'General Admission',
    priceCents: tier?.price_cents ?? 2500,
    comp: false,
    attendeeName: 'Alex Rivera',
    orderRef: 'PREVIEW1',
  }
  return renderEventTickets(event, design, [sample], locale)
}

async function renderEventTickets(event: TicketedEvent, design: TicketDesign, tickets: TicketPdfTicket[], locale: Locale) {
  const [fonts, images] = await Promise.all([loadTicketFonts(), resolveDesignImages(design, event.image_url)])
  return renderTicketsPdf({
    design,
    event: pdfEvent(event, locale),
    tickets,
    locale,
    appUrl: appUrl(),
    fonts,
    logo: images.logo,
    image: images.image,
  })
}

export function ticketsFilename(event: Pick<TicketedEvent, 'slug'>, suffix?: string): string {
  return `tickets-${event.slug}${suffix ? `-${suffix}` : ''}.pdf`
}
