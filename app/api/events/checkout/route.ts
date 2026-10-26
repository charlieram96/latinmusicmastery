// Ticket checkout. Holds inventory with reserve_ticket_order (atomic capacity
// check), then sends the buyer to a one-time Stripe Checkout Session. The
// webhook issues the tickets; free orders are issued here directly.

import { NextRequest, NextResponse, after } from 'next/server'
import Stripe from 'stripe'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe'
import { generateSecret } from '@/lib/tickets/codes'
import { reserveErrorToCartError, validateCart } from '@/lib/tickets/checkout'
import { pickLocalized } from '@/lib/tickets/format'
import { deliverOrderEmail, ensureTickets, expirePendingOrder } from '@/lib/tickets/orders'
import { appUrl, orderPagePath } from '@/lib/tickets/urls'
import type { TierAvailability } from '@/lib/tickets/types'

const bodySchema = z.object({
  eventId: z.string().uuid(),
  items: z.array(z.object({ tierId: z.string().uuid(), quantity: z.number().int().min(0).max(50) })).min(1).max(20),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  locale: z.enum(['en', 'es']).default('en'),
})

// Stripe requires Checkout Sessions to stay open at least 30 minutes; the hold
// outlives the session a little so a payment at the last second still fits.
const SESSION_MINUTES = 31
const HOLD_MINUTES = 36

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }
  const { eventId, items, name, email, locale } = parsed.data

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = getSupabaseAdmin()

  const [{ data: event }, { data: tiers }, { data: availability }] = await Promise.all([
    admin.from('ticketed_events').select('*').eq('id', eventId).maybeSingle(),
    admin.from('ticket_tiers').select('*').eq('event_id', eventId),
    admin.rpc('ticket_event_availability', { p_event_id: eventId }),
  ])
  if (!event) return NextResponse.json({ error: 'event_unavailable' }, { status: 404 })

  const cart = validateCart({
    event,
    tiers: tiers ?? [],
    availability: (availability ?? []) as TierAvailability[],
    items: items.map((i) => ({ tierId: i.tierId, quantity: i.quantity })),
    now: new Date(),
  })
  if (!cart.ok) return NextResponse.json({ error: cart.error, tierId: cart.tierId }, { status: 409 })

  const free = cart.totalCents === 0
  const accessToken = generateSecret()
  const { data: order, error: reserveError } = await admin.rpc('reserve_ticket_order', {
    p_event_id: event.id,
    p_items: cart.lines.map((l) => ({ tier_id: l.tier.id, quantity: l.quantity })),
    p_buyer_name: name,
    p_buyer_email: email,
    p_user_id: user?.id ?? null,
    p_locale: locale,
    p_access_token: accessToken,
    p_status: free ? 'paid' : 'pending',
    p_source: free ? 'free' : 'stripe',
    p_expires_at: free ? null : new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString(),
  })
  if (reserveError || !order) {
    const error = reserveErrorToCartError(reserveError?.message ?? '')
    return NextResponse.json({ error }, { status: 409 })
  }

  if (free) {
    await ensureTickets(admin, order.id)
    after(() => deliverOrderEmail(admin, order.id))
    return NextResponse.json({ url: orderPagePath(accessToken) })
  }

  const title = pickLocalized(event.title, event.title_es, locale)
  const base = appUrl()
  try {
    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      client_reference_id: order.id,
      locale,
      // Free tiers in a mixed order are issued with it but not charged, so
      // they are left out of Stripe (which rejects zero-amount lines).
      line_items: cart.lines.filter((l) => l.tier.price_cents > 0).map((l): Stripe.Checkout.SessionCreateParams.LineItem => ({
        quantity: l.quantity,
        price_data: {
          currency: event.currency,
          unit_amount: l.tier.price_cents,
          product_data: {
            name: `${title} — ${pickLocalized(l.tier.name, l.tier.name_es, locale)}`,
            ...(pickLocalized(l.tier.description, l.tier.description_es, locale)
              ? { description: pickLocalized(l.tier.description, l.tier.description_es, locale).slice(0, 500) }
              : {}),
          },
        },
      })),
      metadata: { flow: 'ticket', order_id: order.id, event_id: event.id },
      payment_intent_data: {
        description: title,
        metadata: { flow: 'ticket', order_id: order.id, event_id: event.id },
      },
      expires_at: Math.floor(Date.now() / 1000) + SESSION_MINUTES * 60,
      success_url: `${base}/api/events/checkout/success?token=${accessToken}`,
      cancel_url: `${base}/api/events/checkout/cancel?token=${accessToken}`,
    })
    await admin
      .from('ticket_orders')
      .update({ stripe_checkout_session_id: session.id, updated_at: new Date().toISOString() })
      .eq('id', order.id)
    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[events checkout] Stripe session failed', error)
    await expirePendingOrder(admin, order.id)
    return NextResponse.json({ error: 'payment_unavailable' }, { status: 502 })
  }
}
