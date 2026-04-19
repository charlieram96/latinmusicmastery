'use client'

import { motion } from 'framer-motion'
import { Star } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'

interface Testimonial {
  nameKey: string
  roleKey: string
  initials: string
  contentKey: string
}

const testimonials: Testimonial[] = [
  {
    nameKey: 'homepage.homeSections.testimonials.items.carlosRodriguez.name',
    roleKey: 'homepage.homeSections.testimonials.items.carlosRodriguez.role',
    initials: 'CR',
    contentKey: 'homepage.homeSections.testimonials.items.carlosRodriguez.content',
  },
  {
    nameKey: 'homepage.homeSections.testimonials.items.sarahChen.name',
    roleKey: 'homepage.homeSections.testimonials.items.sarahChen.role',
    initials: 'SC',
    contentKey: 'homepage.homeSections.testimonials.items.sarahChen.content',
  },
  {
    nameKey: 'homepage.homeSections.testimonials.items.marcusJohnson.name',
    roleKey: 'homepage.homeSections.testimonials.items.marcusJohnson.role',
    initials: 'MJ',
    contentKey: 'homepage.homeSections.testimonials.items.marcusJohnson.content',
  },
  {
    nameKey: 'homepage.homeSections.testimonials.items.anaMartinez.name',
    roleKey: 'homepage.homeSections.testimonials.items.anaMartinez.role',
    initials: 'AM',
    contentKey: 'homepage.homeSections.testimonials.items.anaMartinez.content',
  },
  {
    nameKey: 'homepage.homeSections.testimonials.items.davidKim.name',
    roleKey: 'homepage.homeSections.testimonials.items.davidKim.role',
    initials: 'DK',
    contentKey: 'homepage.homeSections.testimonials.items.davidKim.content',
  },
  {
    nameKey: 'homepage.homeSections.testimonials.items.elenaVolkov.name',
    roleKey: 'homepage.homeSections.testimonials.items.elenaVolkov.role',
    initials: 'EV',
    contentKey: 'homepage.homeSections.testimonials.items.elenaVolkov.content',
  },
]

export function TestimonialsSection() {
  const { t } = useTranslation()
  return (
    <section id="testimonials" className="py-24 lg:py-32 bg-muted/50">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground mb-4 font-heading">
            {t('homepage.homeSections.testimonials.heading')}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t('homepage.homeSections.testimonials.subheading')}
          </p>
        </motion.div>

        {/* Testimonial Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={testimonial.nameKey}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="p-6 rounded-2xl bg-card border border-border"
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star
                    key={j}
                    className="w-4 h-4 fill-primary text-primary"
                  />
                ))}
              </div>

              {/* Quote */}
              <p className="text-foreground/80 leading-relaxed mb-6">
                &ldquo;{t(testimonial.contentKey)}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-sm font-semibold text-primary">
                    {testimonial.initials}
                  </span>
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {t(testimonial.nameKey)}
                  </div>
                  <div className="text-xs text-muted-foreground">{t(testimonial.roleKey)}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
