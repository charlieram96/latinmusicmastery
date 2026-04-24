'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Music } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'

interface MusicalStyle {
  id: string
  name: string
  slug: string
  description: string | null
}

interface Country {
  id: string
  name: string
  slug: string
  description: string | null
  musical_styles: MusicalStyle[]
}

interface Props {
  countries: Country[]
}

export function InteractiveCourseExplorer({ countries }: Props) {
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
          className="text-center max-w-3xl mx-auto mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            {t('homepage.courseExplorer.heading')}
          </h2>
          <p className="text-base md:text-lg text-muted-foreground">
            {t('homepage.courseExplorer.subheading')}
          </p>
        </motion.div>

        {/* Country Cards Grid */}
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8 max-w-6xl mx-auto">
          {countries.map((country, index) => (
            <motion.div
              key={country.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="h-full hover:shadow-md transition-all duration-300 hover:translate-y-[-2px]">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2">{country.name}</CardTitle>
                      {country.description && (
                        <CardDescription className="text-base">
                          {country.description}
                        </CardDescription>
                      )}
                    </div>
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Music className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      {t('homepage.courseExplorer.musicalStylesLabel')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {country.musical_styles.map((style) => (
                        <Link
                          key={style.id}
                          href={`/courses/${country.slug}/${style.slug}`}
                          className="group"
                        >
                          <Badge
                            variant="secondary"
                            className="hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer text-sm py-1.5 px-3"
                          >
                            {style.name}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <Link
            href="/"
            className="text-primary hover:text-primary/80 font-medium text-lg inline-flex items-center gap-2"
          >
            {t('homepage.courseExplorer.viewAllCourses')}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
