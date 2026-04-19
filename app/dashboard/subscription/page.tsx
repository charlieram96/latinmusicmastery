import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SubscriptionView } from './subscription-view'

export default async function MySubscriptionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get all subscriptions (not just active)
  const { data: allSubs } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const activeSubs = (allSubs || []).filter((s) => s.status === 'active')
  const hasAllAccess = activeSubs.some((s) => s.plan_type === 'all_access')
  const instrumentSubs = activeSubs.filter((s) => s.plan_type === 'instrument')
  const hasAnySub = activeSubs.length > 0

  return (
    <SubscriptionView
      activeSubs={activeSubs}
      hasAllAccess={hasAllAccess}
      instrumentSubs={instrumentSubs}
      hasAnySub={hasAnySub}
    />
  )
}
