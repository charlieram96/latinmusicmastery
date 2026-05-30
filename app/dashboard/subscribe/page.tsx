import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getPricing } from '@/lib/payments/pricing-source'
import { SUBSCRIBABLE_INSTRUMENTS } from '@/lib/instruments'
import { SubscribeClient } from './subscribe-client'

interface PageProps {
  searchParams: Promise<{ instrument?: string; course?: string; canceled?: string }>
}

export default async function SubscribePage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams

  // Load published genre courses (not fundamentals), grouped by instrument.
  const { data: genreCourses } = await supabase
    .from('courses')
    .select('id, title, slug, instrument, description')
    .eq('is_published', true)
    .eq('is_fundamentals', false)
    .not('instrument', 'is', null)
    .order('title')

  // The user's existing instrument subscriptions — those instruments are not
  // offered on the "Subscribe" step (use Add to Plan there instead).
  const { data: existingSubs } = await supabase
    .from('instrument_subscriptions')
    .select('instrument, status')
    .eq('user_id', user.id)
    .in('status', ['active', 'past_due'])

  const subscribedInstruments = (existingSubs ?? []).map((s) => s.instrument)
  const prices = await getPricing()

  // Build the picker data: { instrument → genre courses[] }
  const coursesByInstrument: Record<string, { id: string; title: string; slug: string; description: string | null }[]> = {}
  for (const inst of SUBSCRIBABLE_INSTRUMENTS) {
    coursesByInstrument[inst] = (genreCourses ?? [])
      .filter((c) => c.instrument === inst)
      .map((c) => ({ id: c.id, title: c.title, slug: c.slug, description: c.description }))
  }

  return (
    <SubscribeClient
      prices={prices}
      subscribedInstruments={subscribedInstruments}
      coursesByInstrument={coursesByInstrument}
      initialInstrument={params.instrument ?? null}
      initialCourseId={params.course ?? null}
      canceled={params.canceled === 'true'}
    />
  )
}
