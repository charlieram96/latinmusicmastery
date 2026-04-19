import type { Metadata } from 'next'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { getServerTranslator } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator()
  return {
    title: t('metadata.home.title'),
    description: t('metadata.home.description'),
    openGraph: {
      title: t('metadata.home.title'),
      description: t('metadata.home.ogDescription'),
      type: 'website',
    },
  }
}
import VideoHero from '@/components/marketing/VideoHero'
import StatsBar from '@/components/marketing/StatsBar'
import { HomeCourseShowcase } from './sections/HomeCourseShowcase'
import { HomeFeaturesSection } from './sections/HomeFeaturesSection'
import { HomeInstructorsSection } from './sections/HomeInstructorsSection'
import { HomeTestimonialsSection } from './sections/HomeTestimonialsSection'
import { HomePricingPreview } from './sections/HomePricingPreview'
import { HomeSocialSection } from './sections/HomeSocialSection'
import { WaitlistForm } from '@/components/marketing/WaitlistForm'

export default async function MarketingHomePage() {
  const supabase = await createClient()
  const { t } = await getServerTranslator()

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
      <div className="flex min-h-screen flex-col">
        <VideoHero />
        <StatsBar />
      </div>
      {countries && countries.length > 0 && (
        <HomeCourseShowcase countries={countries} />
      )}
      <HomeFeaturesSection />
      {teachers && teachers.length > 0 && (
        <HomeInstructorsSection instructors={teachers} />
      )}
      <HomeTestimonialsSection />
      <HomePricingPreview />
      <HomeSocialSection />
      <section id="waitlist" className="relative overflow-hidden py-20 sm:py-28">
        <Image
          src="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1920&auto=format&fit=crop&q=80"
          alt="Latin music performance"
          fill
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-black/65" />
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <WaitlistForm
            title={t('marketing.home.waitlistTitle')}
            subtitle={t('marketing.home.waitlistSubtitle')}
            variant="immersive"
          />
        </div>
      </section>
    </div>
  )
}
