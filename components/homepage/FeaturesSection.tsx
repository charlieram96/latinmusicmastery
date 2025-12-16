'use client'

import { motion } from 'framer-motion'
import { PlayCircle, BarChart3, Users, Download, Clock, Sparkles } from 'lucide-react'
import { LucideIcon } from 'lucide-react'

interface Feature {
  icon: LucideIcon
  title: string
  description: string
}

const features: Feature[] = [
  {
    icon: PlayCircle,
    title: 'Interactive Lessons',
    description:
      'HD video with Soundslice integration for synchronized notation. Slow down, loop, and master every note.',
  },
  {
    icon: BarChart3,
    title: 'Progress Tracking',
    description:
      'Monitor your practice time, completed lessons, and skill improvements in one dashboard.',
  },
  {
    icon: Users,
    title: 'Expert Instructors',
    description:
      'Learn from professional musicians with decades of performance and teaching experience.',
  },
  {
    icon: Download,
    title: 'Downloadable Resources',
    description:
      'Sheet music, tablature, and backing tracks available for offline practice.',
  },
  {
    icon: Clock,
    title: 'Learn at Your Pace',
    description:
      'Access lessons anytime, anywhere. No deadlines, no pressure.',
  },
  {
    icon: Sparkles,
    title: 'New Content Monthly',
    description:
      'Fresh lessons and courses added regularly to expand your repertoire.',
  },
]

export function FeaturesSection() {
  return (
    <section className="py-24 lg:py-32 bg-[#0f0f0f]">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header - Centered */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-4 font-heading">
            Everything you need to excel
          </h2>
          <p className="text-lg text-white/60">
            A complete learning platform built for serious musicians
          </p>
        </motion.div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="p-6 rounded-2xl bg-card border border-white/5"
            >
              {/* Icon */}
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>

              <h3 className="text-lg font-semibold text-white mb-2">
                {feature.title}
              </h3>

              <p className="text-sm text-white/50 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
