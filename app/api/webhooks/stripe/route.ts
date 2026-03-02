import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { Database } from '@/types/database'

export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

  // Use service role key for webhook handler
  const supabaseAdmin = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')!

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (error) {
      console.error('Webhook signature verification failed:', error)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        if (session.mode === 'subscription') {
          const subscriptionId = session.subscription as string
          const customerId = session.customer as string
          const userId = session.metadata?.user_id

          if (!userId) {
            console.error('No user_id in session metadata')
            break
          }

          // Get subscription details
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const planType = subscription.metadata?.plan_type || 'all_access'
          const instrument = subscription.metadata?.instrument || null

          // Upsert keyed on stripe_subscription_id
          const { error } = await supabaseAdmin
            .from('subscriptions')
            .upsert(
              {
                user_id: userId,
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
                status: subscription.status as 'active' | 'canceled' | 'past_due' | 'incomplete',
                current_period_start: new Date((subscription as any).current_period_start * 1000).toISOString(),
                current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
                cancel_at_period_end: subscription.cancel_at_period_end,
                plan_type: planType,
                instrument: instrument,
              },
              { onConflict: 'stripe_subscription_id' }
            )

          if (error) {
            console.error('Error creating subscription:', error)
          }

          // Auto-cancel instrument subscriptions when upgrading to all-access
          if (planType === 'all_access') {
            const { data: instrumentSubs } = await supabaseAdmin
              .from('subscriptions')
              .select('stripe_subscription_id')
              .eq('user_id', userId)
              .eq('plan_type', 'instrument')
              .eq('status', 'active')

            if (instrumentSubs && instrumentSubs.length > 0) {
              for (const sub of instrumentSubs) {
                try {
                  await stripe.subscriptions.cancel(sub.stripe_subscription_id)
                  console.log(`Canceled instrument subscription ${sub.stripe_subscription_id} for user ${userId}`)
                } catch (cancelError) {
                  console.error(`Failed to cancel instrument subscription ${sub.stripe_subscription_id}:`, cancelError)
                }
              }
            }
          }
        }
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription

        // Update subscription record
        const { error } = await supabaseAdmin
          .from('subscriptions')
          .update({
            status: subscription.status as 'active' | 'canceled' | 'past_due' | 'incomplete',
            current_period_start: new Date((subscription as any).current_period_start * 1000).toISOString(),
            current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq('stripe_subscription_id', subscription.id)

        if (error) {
          console.error('Error updating subscription:', error)
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice

        if ((invoice as any).subscription) {
          // Update subscription status to active if payment succeeded
          const { error } = await supabaseAdmin
            .from('subscriptions')
            .update({
              status: 'active',
            })
            .eq('stripe_subscription_id', (invoice as any).subscription as string)

          if (error) {
            console.error('Error updating subscription status:', error)
          }
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice

        if ((invoice as any).subscription) {
          // Update subscription status to past_due if payment failed
          const { error } = await supabaseAdmin
            .from('subscriptions')
            .update({
              status: 'past_due',
            })
            .eq('stripe_subscription_id', (invoice as any).subscription as string)

          if (error) {
            console.error('Error updating subscription status:', error)
          }
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}
