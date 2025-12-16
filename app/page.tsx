import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/header'
import { ModernHero } from '@/components/homepage/ModernHero'
import { SocialProofBar } from '@/components/homepage/SocialProofBar'
import { CourseShowcase } from '@/components/homepage/CourseShowcase'
import { FeaturesSection } from '@/components/homepage/FeaturesSection'
import { InstructorsSection } from '@/components/homepage/InstructorsSection'
import { TestimonialsSection } from '@/components/homepage/TestimonialsSection'
import { PricingSection } from '@/components/homepage/PricingSection'
import { FinalCTA } from '@/components/homepage/FinalCTA'
import { Footer } from '@/components/homepage/Footer'
import { PasswordGate } from '@/components/PasswordGate'

export default async function HomePage() {
  const supabase = await createClient()

  // Fetch countries with their musical styles
  const { data: countries } = await supabase
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
    .order('name')

  // Fetch teachers
  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, name, instrument, bio, image_url, specialties')
    .order('name')

  return (
    <PasswordGate>
      <>
        <Header />
        <main className="min-h-screen">
          {/* Hero Section */}
          <ModernHero />

          {/* Social Proof / Stats Bar */}
          <SocialProofBar />

          {/* Course Showcase */}
          {countries && countries.length > 0 && (
            <CourseShowcase countries={countries} />
          )}

          {/* Features Section */}
          <FeaturesSection />

          {/* Instructors Section */}
          {teachers && teachers.length > 0 && (
            <InstructorsSection instructors={teachers} />
          )}

          {/* Testimonials Section */}
          <TestimonialsSection />

          {/* Pricing Section */}
          <PricingSection />

          {/* Final CTA Section */}
          <FinalCTA />

          {/* Footer */}
          <Footer />
        </main>
      </>
    </PasswordGate>
  )
}
