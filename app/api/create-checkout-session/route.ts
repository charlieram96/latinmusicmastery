import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { priceId, planType, instrument } = await request.json()

    if (!priceId) {
      return NextResponse.json({ error: 'Price ID is required' }, { status: 400 })
    }

    if (!planType || !['instrument', 'all_access'].includes(planType)) {
      return NextResponse.json({ error: 'Valid planType is required' }, { status: 400 })
    }

    if (planType === 'instrument' && !instrument) {
      return NextResponse.json({ error: 'Instrument is required for instrument plans' }, { status: 400 })
    }

    // Check for duplicate active subscription
    let dupQuery = supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .eq('plan_type', planType)

    if (planType === 'instrument') {
      dupQuery = dupQuery.eq('instrument', instrument)
    }

    const { data: existingSub } = await dupQuery.limit(1)
    if (existingSub && existingSub.length > 0) {
      return NextResponse.json({ error: 'You already have an active subscription for this plan' }, { status: 409 })
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single()

    // Look up existing Stripe customer across all user subs
    const { data: anySub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .limit(1)

    const stripeCustomerId = anySub?.[0]?.stripe_customer_id

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId || undefined,
      customer_email: stripeCustomerId ? undefined : profile?.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/subscription?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
      metadata: {
        user_id: user.id,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan_type: planType,
          ...(instrument ? { instrument } : {}),
        },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
