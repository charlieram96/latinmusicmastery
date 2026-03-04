import type { Metadata } from 'next'
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: 'Our Instructors - Latin Music Mastery',
  description: 'Learn from world-class musicians with decades of performance and teaching experience in Latin American music.',
}
import PageHero from "@/components/marketing/PageHero";
import SectionWrapper from "@/components/marketing/SectionWrapper";
import CTABanner from "@/components/marketing/CTABanner";
import GradientText from "@/components/marketing/GradientText";
import InstructorCard from "@/components/marketing/InstructorCard";

export default async function InstructorsPage() {
  const supabase = await createClient();

  const { data: teachers } = await supabase
    .from("teachers")
    .select("id, name, instrument, bio, image_url, specialties")
    .order("name");

  return (
    <div data-marketing>
      <PageHero
        title="Our Instructors"
        subtitle="Learn from world-class musicians with decades of performance and teaching experience."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Instructors" },
        ]}
      />

      {/* Instructor Grid */}
      <SectionWrapper className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        {teachers && teachers.length > 0 ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {teachers.map((teacher) => (
              <InstructorCard
                key={teacher.id}
                name={teacher.name}
                instrument={teacher.instrument}
                bio={teacher.bio}
                imageUrl={teacher.image_url}
                specialties={teacher.specialties}
              />
            ))}
          </div>
        ) : (
          <div className="py-20 text-center">
            <p className="text-lg text-muted-foreground">
              Our instructor roster is being updated. Check back soon!
            </p>
          </div>
        )}
      </SectionWrapper>

      {/* Teaching Philosophy */}
      <SectionWrapper className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8 text-center">
        <h2 className="mb-6 text-3xl font-bold">
          Our Teaching <GradientText>Philosophy</GradientText>
        </h2>
        <p className="text-lg leading-relaxed text-muted-foreground">
          At Latin Music Mastery, we believe that authentic instruction goes
          beyond technique. Our instructors bring decades of real-world
          performance experience and deep cultural context to every lesson.
          Through a progressive curriculum that honors the traditions of Latin
          American music while embracing modern pedagogy, students don&apos;t
          just learn notes &mdash; they understand the rhythms, history, and
          soul behind the music they play.
        </p>
      </SectionWrapper>

      {/* CTA */}
      <CTABanner
        title="Ready to Learn from the Best?"
        subtitle="Start your musical journey with world-class Latin music instructors. Free trial included."
        primaryAction={{ label: "Get Started Free", href: "/signup" }}
        secondaryAction={{ label: "View Pricing", href: "/pricing" }}
      />
    </div>
  );
}
