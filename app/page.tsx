import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/header'
import { AnimatedGradientHero } from '@/components/homepage/AnimatedGradientHero'
import { InteractiveCourseExplorer } from '@/components/homepage/InteractiveCourseExplorer'
import { FeatureShowcase } from '@/components/homepage/FeatureShowcase'
import { InstructorGrid } from '@/components/homepage/InstructorGrid'
import { TestimonialCarousel } from '@/components/homepage/TestimonialCarousel'
import { PricingSection } from '@/components/homepage/PricingSection'
import { EnhancedFooter } from '@/components/homepage/EnhancedFooter'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

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
    <>
      <Header />
      <main className="min-h-screen">
        {/* Hero Section */}
        <AnimatedGradientHero />

      {/* Demo Video Section */}
      <section className="relative -mt-32 pb-24 md:pb-32">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            {/* Video Placeholder */}
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white/20 bg-gradient-to-br from-[#0a2540] via-[#1e3a8a] to-[#0a2540]">
              <div className="aspect-video flex items-center justify-center">
                <div className="text-center text-white/60">
                  <svg
                    className="w-24 h-24 mx-auto mb-4 opacity-30"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                  </svg>
                  <p className="text-lg font-medium">Demo Video</p>
                  <p className="text-sm mt-2 opacity-75">Experience Latin Music Mastery</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Course Explorer */}
      {countries && countries.length > 0 && (
        <InteractiveCourseExplorer countries={countries} />
      )}

      {/* Feature Showcase */}
      <FeatureShowcase />

      {/* Instructors */}
      {teachers && teachers.length > 0 && (
        <InstructorGrid instructors={teachers} />
      )}

      {/* Testimonials */}
      <TestimonialCarousel />

      {/* Pricing */}
      <PricingSection />

      {/* Final CTA Section */}
      <section className="py-20 md:py-24 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 max-w-3xl mx-auto">
            Ready to Start Your Latin Music Journey?
          </h2>
          <p className="text-base md:text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of students learning authentic Latin American music from expert instructors.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button className="bg-primary text-white hover:bg-primary/90 hover:text-white px-10 py-3 h-auto rounded-full font-semibold" asChild>
              <Link href="/signup">
                Start Learning Free
              </Link>
            </Button>
            <Button
              className="bg-white text-primary border-2 border-primary hover:bg-primary/10 hover:text-primary px-10 py-3 h-auto rounded-full font-semibold"
              asChild
            >
              <Link href="/pricing">
                View Pricing
              </Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            No credit card required • Cancel anytime • 14-day money-back guarantee
          </p>
        </div>
      </section>

      {/* Enhanced Footer */}
      <EnhancedFooter />
      </main>
    </>
  )
}
