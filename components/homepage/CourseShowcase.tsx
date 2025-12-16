'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'

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

// Country emoji map
const countryEmojis: Record<string, string> = {
  brazil: '🇧🇷',
  cuba: '🇨🇺',
  argentina: '🇦🇷',
  colombia: '🇨🇴',
  mexico: '🇲🇽',
  peru: '🇵🇪',
  venezuela: '🇻🇪',
  'dominican-republic': '🇩🇴',
  'puerto-rico': '🇵🇷',
}

function getCountryEmoji(slug: string): string {
  return countryEmojis[slug] || '🎵'
}

export function CourseShowcase({ countries }: Props) {
  return (
    <section id="courses" className="py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header - Left aligned */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground mb-4 font-heading">
            Explore musical traditions
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            From the Caribbean to South America, master the authentic rhythms and
            techniques that define Latin American music.
          </p>
        </motion.div>

        {/* Course Cards - Bento-style grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {countries.map((country, i) => (
            <motion.div
              key={country.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <Link href={`/courses/${country.slug}`}>
                <div className="group relative h-full bg-card rounded-2xl border border-border p-6 hover:border-primary/30 hover:bg-muted/50 transition-all duration-300">
                  {/* Country Flag/Emoji */}
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <span className="text-2xl">{getCountryEmoji(country.slug)}</span>
                  </div>

                  <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                    {country.name}
                  </h3>

                  {country.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {country.description}
                    </p>
                  )}

                  {/* Style Tags */}
                  <div className="flex flex-wrap gap-2">
                    {country.musical_styles.slice(0, 3).map((style) => (
                      <span
                        key={style.id}
                        className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground"
                      >
                        {style.name}
                      </span>
                    ))}
                    {country.musical_styles.length > 3 && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground/60">
                        +{country.musical_styles.length - 3}
                      </span>
                    )}
                  </div>

                  {/* Hover arrow */}
                  <ArrowUpRight className="absolute top-6 right-6 w-5 h-5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
