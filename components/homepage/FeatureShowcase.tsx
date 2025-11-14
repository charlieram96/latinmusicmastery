'use client'

import { motion } from 'framer-motion'
import { Music, TrendingUp, Users, Video } from 'lucide-react'

interface Feature {
  icon: React.ElementType
  title: string
  description: string
  imageSide: 'left' | 'right'
}

const features: Feature[] = [
  {
    icon: Video,
    title: 'Interactive Video Lessons',
    description: 'Learn with high-quality video tutorials featuring Soundslice integration for synchronized sheet music and tablature. Slow down, loop, and master every note at your own pace.',
    imageSide: 'right',
  },
  {
    icon: TrendingUp,
    title: 'Track Your Progress',
    description: 'Stay motivated with detailed progress tracking. See your completed lessons, practice time, and skill improvements all in one place. Set goals and achieve them.',
    imageSide: 'left',
  },
  {
    icon: Users,
    title: 'Learn From Experts',
    description: 'Our instructors are professional musicians with decades of experience performing and teaching Latin music. Get authentic insights into technique, style, and cultural context.',
    imageSide: 'right',
  },
  {
    icon: Music,
    title: 'Comprehensive Curriculum',
    description: 'From beginner fundamentals to advanced techniques, explore courses covering multiple Latin American musical styles including salsa, bossa nova, tango, cumbia, and more.',
    imageSide: 'left',
  },
]

export function FeatureShowcase() {
  return (
    <section className="py-24 md:py-32">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            Everything You Need to Excel
          </h2>
          <p className="text-base md:text-lg text-muted-foreground">
            A complete learning platform designed for musicians of all levels
          </p>
        </motion.div>

        {/* Features */}
        <div className="space-y-32 max-w-6xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                viewport={{ once: true, margin: "-100px" }}
                className={`flex flex-col ${
                  feature.imageSide === 'right' ? 'lg:flex-row' : 'lg:flex-row-reverse'
                } gap-12 lg:gap-16 items-center`}
              >
                {/* Content */}
                <div className="flex-1 space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>

                  <h3 className="text-2xl md:text-3xl font-bold">{feature.title}</h3>

                  <p className="text-base text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>

                {/* Image Placeholder */}
                <div className="flex-1 w-full">
                  <div className="aspect-video rounded-xl bg-gradient-to-br from-primary/10 via-accent/10 to-primary/5 border border-border flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <Icon className="w-16 h-16 mx-auto mb-4 opacity-20" />
                      <p className="text-sm">Feature Screenshot</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
