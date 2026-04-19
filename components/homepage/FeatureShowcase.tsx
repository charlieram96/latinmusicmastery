'use client'

import { motion } from 'framer-motion'
import { Music, TrendingUp, Users, Video } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'

interface Feature {
  icon: React.ElementType
  titleKey: string
  descriptionKey: string
  imageSide: 'left' | 'right'
}

const features: Feature[] = [
  {
    icon: Video,
    titleKey: 'homepage.featureShowcase.interactive.title',
    descriptionKey: 'homepage.featureShowcase.interactive.description',
    imageSide: 'right',
  },
  {
    icon: TrendingUp,
    titleKey: 'homepage.featureShowcase.progress.title',
    descriptionKey: 'homepage.featureShowcase.progress.description',
    imageSide: 'left',
  },
  {
    icon: Users,
    titleKey: 'homepage.featureShowcase.experts.title',
    descriptionKey: 'homepage.featureShowcase.experts.description',
    imageSide: 'right',
  },
  {
    icon: Music,
    titleKey: 'homepage.featureShowcase.curriculum.title',
    descriptionKey: 'homepage.featureShowcase.curriculum.description',
    imageSide: 'left',
  },
]

export function FeatureShowcase() {
  const { t } = useTranslation()
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
            {t('homepage.featureShowcase.heading')}
          </h2>
          <p className="text-base md:text-lg text-muted-foreground">
            {t('homepage.featureShowcase.subheading')}
          </p>
        </motion.div>

        {/* Features */}
        <div className="space-y-32 max-w-6xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={feature.titleKey}
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

                  <h3 className="text-2xl md:text-3xl font-bold">{t(feature.titleKey)}</h3>

                  <p className="text-base text-muted-foreground leading-relaxed">
                    {t(feature.descriptionKey)}
                  </p>
                </div>

                {/* Image Placeholder */}
                <div className="flex-1 w-full">
                  <div className="aspect-video rounded-xl bg-gradient-to-br from-primary/10 via-accent/10 to-primary/5 border border-border flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <Icon className="w-16 h-16 mx-auto mb-4 opacity-20" />
                      <p className="text-sm">{t('homepage.featureShowcase.screenshotPlaceholder')}</p>
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
