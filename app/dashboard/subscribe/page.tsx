import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SubscribeClient } from './subscribe-client'

export default async function SubscribePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: activeSubs } = await supabase
    .from('subscriptions')
    .select('plan_type, instrument')
    .eq('user_id', user.id)
    .eq('status', 'active')

  const hasAllAccess = (activeSubs || []).some((s) => s.plan_type === 'all_access')

  if (hasAllAccess) {
    redirect('/dashboard/subscription')
  }

  const subscribedInstruments = (activeSubs || [])
    .filter((s) => s.plan_type === 'instrument' && s.instrument)
    .map((s) => s.instrument as string)

  const instrumentPriceId = process.env.NEXT_PUBLIC_STRIPE_INSTRUMENT_PRICE_ID ?? ''
  const allAccessPriceId = process.env.NEXT_PUBLIC_STRIPE_ALL_ACCESS_PRICE_ID ?? ''

  return (
    <SubscribeClient
      subscribedInstruments={subscribedInstruments}
      instrumentPriceId={instrumentPriceId}
      allAccessPriceId={allAccessPriceId}
    />
  )
}
