'use client'

import { motion } from 'framer-motion'
import { useTranslation } from '@/components/language-provider'

const stats = [
  { value: '10,000+', labelKey: 'homepage.socialProof.activeStudents' },
  { value: '150+', labelKey: 'homepage.socialProof.videoLessons' },
  { value: '8', labelKey: 'homepage.socialProof.musicStyles' },
  { value: '4.9', labelKey: 'homepage.socialProof.averageRating' },
]

export function SocialProofBar() {
  const { t } = useTranslation()
  return (
    <section className="py-16 border-y border-border">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <p className="text-sm text-muted-foreground uppercase tracking-wider mb-8">
            {t('homepage.socialProof.trustedBy')}
          </p>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.labelKey}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="text-center"
              >
                <div className="text-3xl md:text-4xl font-bold text-foreground mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">{t(stat.labelKey)}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
