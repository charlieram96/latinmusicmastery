// New per-course checkout. Replaces the old two-tier `create-checkout-session`
// flow (which still exists for back-compat until M5 cleanup). Writes nothing
// to the DB itself — the webhook is the source of truth for what landed.

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'
import { getPricing } from '@/lib/payments/pricing-source'
import { planTopology } from '@/lib/payments/billing'

interface CheckoutBody {
  instrument: string
  interval: 'month' | 'year'
  genreCourseIds: string[]
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { instrument, interval, genreCourseIds } = (await request.json()) as CheckoutBody

    // Input validation
    if (!instrument || typeof instrument !== 'string') {
      return NextResponse.json({ error: 'Instrument is required' }, { status: 400 })
    }
    if (interval !== 'month' && interval !== 'year') {
      return NextResponse.json({ error: 'Interval must be month or year' }, { status: 400 })
    }
    if (!Array.isArray(genreCourseIds) || genreCourseIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one genre course is required' },
        { status: 400 }
      )
    }
    // Simplified v1: annual signup is base-only (1 genre). Multi-genre on annual
    // is added later via "Add to my plan" against the saved payment method.
    if (interval === 'year' && genreCourseIds.length > 1) {
      return NextResponse.json(
        { error: 'Annual signup currently supports one genre course. Add more after signup.' },
        { status: 400 }
      )
    }
    // Dedupe genres in the request.
    const uniqueGenres = Array.from(new Set(genreCourseIds))

    // Already subscribed to this instrument? Send them to "Add to my plan" instead.
    const { data: existingSub } = await supabase
      .from('instrument_subscriptions')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('instrument', instrument)
      .in('status', ['active', 'past_due'])
      .limit(1)
    if (existingSub && existingSub.length > 0) {
      return NextResponse.json(
        { error: 'You already have a subscription for this instrument. Use "Add to my plan" to add more genres.' },
        { status: 409 }
      )
    }

    // Validate the selected genre courses: must exist, match the chosen
    // instrument, and not be the fundamentals course (which is included).
    const { data: courseRows, error: courseErr } = await supabase
      .from('courses')
      .select('id, instrument, is_fundamentals, is_published')
      .in('id', uniqueGenres)
    if (courseErr) {
      return NextResponse.json({ error: courseErr.message }, { status: 500 })
    }
    if (!courseRows || courseRows.length !== uniqueGenres.length) {
      return NextResponse.json({ error: 'One or more selected courses do not exist' }, { status: 400 })
    }
    for (const c of courseRows) {
      if (c.instrument !== instrument) {
        return NextResponse.json(
          { error: 'Selected courses must all belong to the chosen instrument' },
          { status: 400 }
        )
      }
      if (c.is_fundamentals) {
        return NextResponse.json(
          { error: 'The fundamentals course is included automatically; do not select it' },
          { status: 400 }
        )
      }
      if (!c.is_published) {
        return NextResponse.json({ error: 'Course is not available' }, { status: 400 })
      }
    }

    // Resolve Stripe price IDs from the DB pricing table.
    const prices = await getPricing()
    const topology = planTopology({ interval, genreCourseCount: uniqueGenres.length })
    const basePriceId =
      topology.base.priceKey === 'base_annual'
        ? prices.base_annual.stripe_price_id
        : prices.base_monthly.stripe_price_id
    if (!basePriceId) {
      return NextResponse.json(
        { error: 'Base price is not configured in Stripe yet. Ask an admin to set the Stripe price_id in /admin/pricing.' },
        { status: 503 }
      )
    }
    const addonPriceId = topology.addon ? prices.addon_monthly.stripe_price_id : null
    if (topology.addon && !addonPriceId) {
      return NextResponse.json(
        { error: 'Add-on price is not configured in Stripe yet.' },
        { status: 503 }
      )
    }

    // Get or create the Stripe customer for this user.
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .single()

    const { data: priorSub } = await supabase
      .from('instrument_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .not('stripe_customer_id', 'is', null)
      .limit(1)
    let customerId = priorSub?.[0]?.stripe_customer_id ?? null

    const stripe = getStripe()
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email ?? user.email ?? undefined,
        name: profile?.full_name ?? undefined,
        metadata: { user_id: user.id },
      })
      customerId = customer.id
    }

    // Build Checkout line items.
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      { price: basePriceId, quantity: 1 },
    ]
    if (topology.addon && addonPriceId) {
      // Monthly + multi-genre path only — annual+addons is blocked above and
      // handled post-signup via Add-to-my-plan.
      lineItems.push({ price: addonPriceId, quantity: topology.addon.quantity })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: lineItems,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/subscription?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/subscribe?canceled=true`,
      metadata: {
        flow: 'per_course',
        user_id: user.id,
        instrument,
        interval,
        // Genre course IDs are serialised as CSV for the webhook to pick up.
        genre_course_ids: uniqueGenres.join(','),
      },
      subscription_data: {
        metadata: {
          flow: 'per_course',
          user_id: user.id,
          instrument,
          interval,
          role: 'base',
        },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[checkout] error:', error)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
