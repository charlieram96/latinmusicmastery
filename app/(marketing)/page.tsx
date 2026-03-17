import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Latin Music Mastery - Learn Authentic Latin Music Online',
  description: 'Master salsa, bossa nova, tango, cumbia and more with world-class instructors. Interactive lessons with real-time feedback for musicians of every level.',
  openGraph: {
    title: 'Latin Music Mastery - Learn Authentic Latin Music Online',
    description: 'Master salsa, bossa nova, tango, cumbia and more with world-class instructors.',
    type: 'website',
  },
}
import VideoHero from '@/components/marketing/VideoHero'
import StatsBar from '@/components/marketing/StatsBar'
import { HomeCourseShowcase } from './sections/HomeCourseShowcase'
import { HomeFeaturesSection } from './sections/HomeFeaturesSection'
import { HomeInstructorsSection } from './sections/HomeInstructorsSection'
import { HomeTestimonialsSection } from './sections/HomeTestimonialsSection'
import { HomePricingPreview } from './sections/HomePricingPreview'
import { WaitlistForm } from '@/components/marketing/WaitlistForm'

export default async function MarketingHomePage() {
  const supabase = await createClient()

  const [{ data: countries }, { data: teachers }] = await Promise.all([
    supabase
      .from('countries')
      .select(`
        id,
        name,
        slug,
        description,
        musical_styles (
          id,
          name,
          slug,
          description
        )
      `)
      .order('name'),
    supabase
      .from('teachers')
      .select('id, name, instrument, bio, image_url, specialties')
      .order('name'),
  ])

  return (
    <div data-marketing>
      <VideoHero />
      <StatsBar />
      {countries && countries.length > 0 && (
        <HomeCourseShowcase countries={countries} />
      )}
      <HomeFeaturesSection />
      {teachers && teachers.length > 0 && (
        <HomeInstructorsSection instructors={teachers} />
      )}
      <HomeTestimonialsSection />
      <HomePricingPreview />
      <section className="relative overflow-hidden bg-gradient-to-r from-primary/90 to-orange-500/90 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <WaitlistForm
            title="Ready to Start Your Musical Journey?"
            subtitle="Be the first to know when we launch. Join the waiting list for early access."
            variant="hero"
          />
        </div>
      </section>
    </div>
  )
}
