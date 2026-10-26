// Ticket PDF download. Authorised by a secret: the order's access token (all
// tickets of the order) or a ticket's QR code (that ticket only).

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { isLocale } from '@/lib/i18n'
import { loadOrderBundle } from '@/lib/tickets/orders'
import { buildOrderPdf, ticketsFilename } from '@/lib/tickets/render'
import { isFulfilledStatus } from '@/lib/tickets/types'

const SECRET = /^[A-Za-z0-9_-]{22}$/

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const orderToken = params.get('order') ?? ''
  const ticketCode = params.get('ticket') ?? ''
  const lang = params.get('lang')
  const admin = getSupabaseAdmin()

  let orderWhere: { accessToken: string } | { id: string } | null = null
  let ticketIds: string[] | undefined
  let ticketNumber: string | null = null
  if (SECRET.test(orderToken)) {
    orderWhere = { accessToken: orderToken }
  } else if (SECRET.test(ticketCode)) {
    const { data: ticket } = await admin.from('tickets').select('id, order_id, ticket_number').eq('code', ticketCode).maybeSingle()
    if (ticket) {
      orderWhere = { id: ticket.order_id }
      ticketIds = [ticket.id]
      ticketNumber = ticket.ticket_number
    }
  }
  const bundle = orderWhere ? await loadOrderBundle(admin, orderWhere) : null
  if (!bundle || !isFulfilledStatus(bundle.order.status) || !bundle.tickets.some((t) => t.status !== 'void' && (!ticketIds || ticketIds.includes(t.id)))) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const pdf = await buildOrderPdf(bundle, { locale: isLocale(lang) ? lang : undefined, ticketIds })
  const filename = ticketsFilename(bundle.event, ticketNumber ?? undefined)
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${params.get('download') ? 'attachment' : 'inline'}; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  })
}
