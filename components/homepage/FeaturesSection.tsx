'use client'

import { motion } from 'framer-motion'
import { PlayCircle, BarChart3, Users, Download, Clock, Sparkles } from 'lucide-react'
import { LucideIcon } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'

interface Feature {
  icon: LucideIcon
  titleKey: string
  descriptionKey: string
}

const features: Feature[] = [
  {
    icon: PlayCircle,
    titleKey: 'homepage.homeSections.features.interactive.title',
    descriptionKey: 'homepage.homeSections.features.interactive.description',
  },
  {
    icon: BarChart3,
    titleKey: 'homepage.homeSections.features.progress.title',
    descriptionKey: 'homepage.homeSections.features.progress.description',
  },
  {
    icon: Users,
    titleKey: 'homepage.homeSections.features.experts.title',
    descriptionKey: 'homepage.homeSections.features.experts.description',
  },
  {
    icon: Download,
    titleKey: 'homepage.homeSections.features.downloads.title',
    descriptionKey: 'homepage.homeSections.features.downloads.description',
  },
  {
    icon: Clock,
    titleKey: 'homepage.homeSections.features.pace.title',
    descriptionKey: 'homepage.homeSections.features.pace.description',
  },
  {
    icon: Sparkles,
    titleKey: 'homepage.homeSections.features.monthly.title',
    descriptionKey: 'homepage.homeSections.features.monthly.description',
  },
]

export function FeaturesSection() {
  const { t } = useTranslation()
  return (
    <section className="py-24 lg:py-32 bg-muted/50">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header - Centered */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground mb-4 font-heading">
            {t('homepage.homeSections.features.heading')}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t('homepage.homeSections.features.subheading')}
          </p>
        </motion.div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, i) => (
            <motion.div
              key={feature.titleKey}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="p-6 rounded-2xl bg-card border border-border"
            >
              {/* Icon */}
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>

              <h3 className="text-lg font-semibold text-foreground mb-2">
                {t(feature.titleKey)}
              </h3>

              <p className="text-sm text-muted-foreground leading-relaxed">
                {t(feature.descriptionKey)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
