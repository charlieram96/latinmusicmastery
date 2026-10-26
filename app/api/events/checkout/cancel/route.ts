// Stripe Checkout cancel_url: release the buyer's hold right away (instead of
// waiting for the session to expire) and send them back to the event page.

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe'
import { expirePendingOrder } from '@/lib/tickets/orders'
import { appUrl, eventPagePath } from '@/lib/tickets/urls'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? ''
  const admin = getSupabaseAdmin()
  const { data: order } = /^[A-Za-z0-9_-]{22}$/.test(token)
    ? await admin.from('ticket_orders').select('id, status, event_id, stripe_checkout_session_id').eq('access_token', token).maybeSingle()
    : { data: null }
  if (!order) return NextResponse.redirect(`${appUrl()}/events`)

  const { data: event } = await admin.from('ticketed_events').select('slug').eq('id', order.event_id).single()
  if (order.status === 'pending' && order.stripe_checkout_session_id) {
    try {
      const stripe = getStripe()
      const session = await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id)
      // Never release a session that was actually paid.
      if (session.status === 'open') {
        await stripe.checkout.sessions.expire(session.id)
        await expirePendingOrder(admin, order.id)
      } else if (session.status === 'expired') {
        await expirePendingOrder(admin, order.id)
      }
    } catch (error) {
      console.error('[events checkout] cancel release failed', error)
    }
  }
  const target = event ? `${eventPagePath(event.slug)}?checkout=canceled` : '/events'
  return NextResponse.redirect(`${appUrl()}${target}`)
}
