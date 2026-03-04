import type { Metadata } from 'next'
import { Heart, Award, Globe, Users } from "lucide-react";

export const metadata: Metadata = {
  title: 'About Us - Latin Music Mastery',
  description: 'Learn about our mission to make authentic Latin American music education accessible to everyone.',
}
import PageHero from "@/components/marketing/PageHero";
import SectionWrapper from "@/components/marketing/SectionWrapper";
import GradientText from "@/components/marketing/GradientText";
import CTABanner from "@/components/marketing/CTABanner";

const milestones = [
  {
    year: "2023",
    title: "Founded",
    description:
      "Founded with a vision to democratize Latin music education and make it accessible to musicians everywhere.",
  },
  {
    year: "2024",
    title: "Platform Launch",
    description:
      "Launched with 50+ courses covering 8 countries and their rich musical traditions.",
  },
  {
    year: "2024",
    title: "PlaySense AI",
    description:
      "Introduced PlaySense AI for real-time feedback, helping students practice more effectively than ever.",
  },
  {
    year: "2025",
    title: "10,000+ Students",
    description:
      "Reached 10,000+ active students worldwide, building a thriving global community of Latin music enthusiasts.",
  },
  {
    year: "2026",
    title: "Expanding Horizons",
    description:
      "Expanding to 15+ musical styles with an exclusive master class series featuring legendary artists.",
  },
];

const values = [
  {
    icon: Heart,
    title: "Authenticity",
    description:
      "We teach music in its authentic cultural context, preserving the traditions and stories behind every rhythm and melody.",
  },
  {
    icon: Award,
    title: "Excellence",
    description:
      "World-class instruction from professional musicians who have dedicated their lives to mastering their craft.",
  },
  {
    icon: Globe,
    title: "Accessibility",
    description:
      "Quality music education available to everyone, regardless of location, background, or experience level.",
  },
  {
    icon: Users,
    title: "Community",
    description:
      "A supportive global community of musicians who learn, grow, and create together across borders.",
  },
];

export default function AboutPage() {
  return (
    <div>
      <PageHero
        title="About Latin Music Mastery"
        subtitle="Our mission is to make authentic Latin American music education accessible to everyone."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "About" },
        ]}
      />

      {/* Mission Section */}
      <SectionWrapper className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Our <GradientText>Mission</GradientText>
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              Latin Music Mastery was born from a simple belief: the rich
              musical traditions of Latin America deserve to be shared with
              the world. From the syncopated rhythms of Cuban son to the
              soulful melodies of Brazilian bossa nova, these genres have
              shaped global music for generations.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              We bring together master musicians, cutting-edge technology,
              and a passion for cultural authenticity to create the most
              comprehensive Latin music learning platform available. Every
              lesson is designed not just to teach technique, but to immerse
              you in the history, culture, and soul of the music.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              Whether you are picking up an instrument for the first time or
              looking to deepen your expertise, our platform meets you where
              you are and guides you on a transformative musical journey.
            </p>
          </div>

          {/* Gradient Placeholder */}
          <div className="flex items-center justify-center">
            <div className="aspect-video w-full overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-orange-400/20 to-amber-500/20 ring-1 ring-primary/10">
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Globe className="h-8 w-8 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Video / Image Coming Soon
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SectionWrapper>

      {/* Timeline Section */}
      <SectionWrapper className="bg-muted/30 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Our <GradientText>Journey</GradientText>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-muted-foreground">
            Key milestones in our mission to democratize Latin music education.
          </p>

          <div className="relative mt-12">
            {/* Vertical line */}
            <div
              className="absolute left-4 top-0 h-full w-0.5 bg-gradient-to-b from-primary via-orange-400 to-amber-500 md:left-1/2 md:-translate-x-px"
              aria-hidden="true"
            />

            <div className="space-y-12">
              {milestones.map((milestone, index) => (
                <div
                  key={index}
                  className={`relative flex items-start gap-8 ${
                    index % 2 === 0
                      ? "md:flex-row"
                      : "md:flex-row-reverse"
                  }`}
                >
                  {/* Timeline dot */}
                  <div className="absolute left-4 z-10 flex h-3 w-3 -translate-x-1/2 items-center justify-center md:left-1/2">
                    <div className="h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                  </div>

                  {/* Content */}
                  <div
                    className={`ml-12 w-full rounded-2xl border bg-card p-6 shadow-sm md:ml-0 md:w-[calc(50%-2rem)] ${
                      index % 2 === 0 ? "md:mr-auto" : "md:ml-auto"
                    }`}
                  >
                    <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                      {milestone.year}
                    </span>
                    <h3 className="mt-2 text-lg font-bold">{milestone.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {milestone.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionWrapper>

      {/* Values Section */}
      <SectionWrapper className="mx-auto max-w-7xl px-6 py-16">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Our <GradientText>Values</GradientText>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            The principles that guide everything we do.
          </p>
        </div>

        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((value) => {
            const Icon = value.icon;
            return (
              <div
                key={value.title}
                className="group rounded-2xl border bg-card p-6 text-center shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <Icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-lg font-bold">{value.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {value.description}
                </p>
              </div>
            );
          })}
        </div>
      </SectionWrapper>

      {/* CTA Banner */}
      <CTABanner
        title="Ready to Start Your Musical Journey?"
        subtitle="Join thousands of musicians mastering authentic Latin American music. Start your free trial today."
        primaryAction={{ label: "Get Started Free", href: "/signup" }}
        secondaryAction={{ label: "Explore Courses", href: "/explore" }}
      />
    </div>
  );
}
