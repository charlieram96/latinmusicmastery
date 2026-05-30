import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getPricing } from '@/lib/payments/pricing-source'
import { SubscriptionView } from './subscription-view'

export default async function MySubscriptionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Per-instrument subscriptions with their entitled genre courses + the
  // fundamentals course for that instrument (which is included by default).
  const { data: subs } = await supabase
    .from('instrument_subscriptions')
    .select(`
      id,
      instrument,
      billing_interval,
      status,
      base_current_period_end,
      addon_current_period_end,
      cancel_at_period_end,
      pending_interval,
      stripe_addon_subscription_id,
      subscription_courses (
        id,
        course:courses ( id, title, slug, instrument )
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Fundamentals courses for each instrument (shown as "included" in each card).
  const instruments = (subs ?? []).map((s) => s.instrument)
  const { data: fundamentals } = await supabase
    .from('courses')
    .select('id, title, slug, instrument')
    .eq('is_fundamentals', true)
    .in('instrument', instruments.length > 0 ? instruments : [''])

  const fundamentalsByInstrument: Record<string, { id: string; title: string; slug: string }> = {}
  for (const f of fundamentals ?? []) {
    if (f.instrument) fundamentalsByInstrument[f.instrument] = { id: f.id, title: f.title, slug: f.slug }
  }

  const prices = await getPricing()

  return (
    <SubscriptionView
      subs={subs ?? []}
      fundamentalsByInstrument={fundamentalsByInstrument}
      prices={prices}
    />
  )
}
