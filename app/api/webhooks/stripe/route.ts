// Stripe webhook handler. Routes by `subscription.metadata.flow`:
//   - flow === 'per_course' → write to instrument_subscriptions + subscription_courses (new model).
//   - flow missing          → write to the legacy `subscriptions` table (old two-tier model).
// The legacy branch stays alive until M5 cleanup deletes it.

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

type SubStatus = 'active' | 'canceled' | 'past_due' | 'incomplete'

function normaliseStatus(s: string): SubStatus {
  if (s === 'active' || s === 'canceled' || s === 'past_due' || s === 'incomplete') return s
  // Treat trialing/unpaid/paused/etc. as their nearest equivalent.
  if (s === 'trialing') return 'active'
  if (s === 'unpaid') return 'past_due'
  return 'incomplete'
}

function periodEndIso(sub: Stripe.Subscription): string | null {
  const ts = (sub as any).current_period_end
  return ts ? new Date(ts * 1000).toISOString() : null
}

export async function POST(request: NextRequest) {
  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!
  const supabaseAdmin = getSupabaseAdmin()

  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')!

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (error) {
      console.error('[stripe webhook] signature verification failed:', error)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const flow = session.metadata?.flow ?? null
        const userId = session.metadata?.user_id
        if (!userId) {
          console.error('[stripe webhook] no user_id in session metadata')
          break
        }
        const subscriptionId = session.subscription as string
        const customerId = session.customer as string
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)

        if (flow !== 'per_course') {
          console.warn('[stripe webhook] checkout.session.completed without per_course flow — ignoring (legacy path removed)')
          break
        }
        await handlePerCourseCheckout(supabaseAdmin, {
          userId,
          customerId,
          subscription,
          instrument: session.metadata?.instrument ?? '',
          interval: (session.metadata?.interval as 'month' | 'year') ?? 'month',
          genreCourseIds: (session.metadata?.genre_course_ids ?? '').split(',').filter(Boolean),
        })
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const status = normaliseStatus(subscription.status)
        const periodEnd = periodEndIso(subscription)

        await syncInstrumentSubscriptionFromStripe(
          supabaseAdmin,
          subscription,
          { status, periodEnd }
        )
        break
      }

      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subId = (invoice as any).subscription as string | null
        if (!subId) break
        const newStatus: SubStatus = event.type === 'invoice.payment_succeeded' ? 'active' : 'past_due'

        await supabaseAdmin
          .from('instrument_subscriptions')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('stripe_base_subscription_id', subId)
        await supabaseAdmin
          .from('instrument_subscriptions')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('stripe_addon_subscription_id', subId)
        break
      }

      default:
        // Other events are ignored for now.
        break
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[stripe webhook] handler error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Per-course flow helpers
// ──────────────────────────────────────────────────────────────────────────

interface PerCourseCheckoutInput {
  userId: string
  customerId: string
  subscription: Stripe.Subscription
  instrument: string
  interval: 'month' | 'year'
  genreCourseIds: string[]
}

async function handlePerCourseCheckout(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  input: PerCourseCheckoutInput
) {
  const { userId, customerId, subscription, instrument, interval, genreCourseIds } = input

  // Upsert the instrument_subscriptions row keyed by (user_id, instrument).
  const { data: subRow, error: subErr } = await supabaseAdmin
    .from('instrument_subscriptions')
    .upsert(
      {
        user_id: userId,
        instrument,
        billing_interval: interval,
        stripe_customer_id: customerId,
        stripe_base_subscription_id: subscription.id,
        status: normaliseStatus(subscription.status),
        base_current_period_end: periodEndIso(subscription),
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,instrument' }
    )
    .select('id')
    .single()

  if (subErr || !subRow) {
    console.error('[stripe webhook] per_course upsert instrument_subscriptions error:', subErr)
    return
  }

  // Insert subscription_courses rows for each genre course (idempotent via ON CONFLICT).
  if (genreCourseIds.length > 0) {
    const rows = genreCourseIds.map((courseId) => ({
      instrument_subscription_id: subRow.id,
      user_id: userId,
      course_id: courseId,
    }))
    const { error: scErr } = await supabaseAdmin
      .from('subscription_courses')
      .upsert(rows, { onConflict: 'user_id,course_id' })
    if (scErr) console.error('[stripe webhook] per_course upsert subscription_courses error:', scErr)
  }
}

/**
 * Update an `instrument_subscriptions` row whose base OR addon Stripe sub id
 * matches the incoming Stripe subscription. Returns true if any row was
 * touched. When the base is canceled, also drops the user's subscription_courses
 * entitlements for that row (fundamentals access ends with the base; genres
 * follow suit).
 */
async function syncInstrumentSubscriptionFromStripe(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  subscription: Stripe.Subscription,
  { status, periodEnd }: { status: SubStatus; periodEnd: string | null }
): Promise<boolean> {
  // Is this the base sub?
  const { data: baseRow } = await supabaseAdmin
    .from('instrument_subscriptions')
    .select('id')
    .eq('stripe_base_subscription_id', subscription.id)
    .single()

  if (baseRow) {
    await supabaseAdmin
      .from('instrument_subscriptions')
      .update({
        status,
        base_current_period_end: periodEnd,
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      })
      .eq('id', baseRow.id)

    if (status === 'canceled') {
      await supabaseAdmin
        .from('subscription_courses')
        .delete()
        .eq('instrument_subscription_id', baseRow.id)
    }
    return true
  }

  // Is this an addon sub?
  const { data: addonRow } = await supabaseAdmin
    .from('instrument_subscriptions')
    .select('id')
    .eq('stripe_addon_subscription_id', subscription.id)
    .single()

  if (addonRow) {
    await supabaseAdmin
      .from('instrument_subscriptions')
      .update({
        addon_current_period_end: periodEnd,
        // status on the row tracks the base; addon cancellation just clears the id.
        stripe_addon_subscription_id: status === 'canceled' ? null : subscription.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', addonRow.id)
    return true
  }

  return false
}
