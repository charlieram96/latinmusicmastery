// Stripe Checkout success_url. The buyer often arrives before the webhook:
// confirm the session with Stripe here and fulfil (idempotent with the
// webhook), then show the order page. This lives in a Route Handler on
// purpose: Server Components memoize identical GET fetches within a render,
// so a page that writes and then re-reads would see stale rows.

import { NextRequest, NextResponse, after } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe'
import { deliverOrderEmail, fulfillPaidOrder } from '@/lib/tickets/orders'
import { appUrl, orderPagePath } from '@/lib/tickets/urls'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? ''
  if (!/^[A-Za-z0-9_-]{22}$/.test(token)) return NextResponse.redirect(`${appUrl()}/events`)
  const admin = getSupabaseAdmin()
  const { data: order } = await admin
    .from('ticket_orders')
    .select('id, status, stripe_checkout_session_id')
    .eq('access_token', token)
    .maybeSingle()
  if (!order) return NextResponse.redirect(`${appUrl()}/events`)

  if (order.status === 'pending' && order.stripe_checkout_session_id) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(order.stripe_checkout_session_id)
      if (session.payment_status === 'paid' && session.metadata?.order_id === order.id) {
        const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null
        const fulfilled = await fulfillPaidOrder(admin, order.id, { paymentIntentId, amountTotal: session.amount_total })
        if (fulfilled) after(() => deliverOrderEmail(admin, order.id))
      }
    } catch (error) {
      // The webhook still fulfils the order; the page shows it as pending meanwhile.
      console.error('[events checkout] success confirmation failed', error)
    }
  }
  return NextResponse.redirect(`${appUrl()}${orderPagePath(token)}?checkout=success`)
}
