'use client'

import { motion } from 'framer-motion'
import { Star } from 'lucide-react'

interface Testimonial {
  name: string
  role: string
  initials: string
  content: string
}

const testimonials: Testimonial[] = [
  {
    name: 'Carlos Rodriguez',
    role: 'Guitarist, 3 years learning',
    initials: 'CR',
    content:
      'The Soundslice integration is incredible. Being able to slow down passages and loop difficult sections has transformed my practice sessions.',
  },
  {
    name: 'Sarah Chen',
    role: 'Pianist, 1 year learning',
    initials: 'SC',
    content:
      'I never thought I could learn bossa nova rhythms online, but the instructors make it feel like private lessons. The progress tracking keeps me motivated.',
  },
  {
    name: 'Marcus Johnson',
    role: 'Drummer, 2 years learning',
    initials: 'MJ',
    content:
      'Finally, a platform that teaches authentic Latin rhythms with proper technique. The quality of instruction is on par with conservatory-level teaching.',
  },
  {
    name: 'Ana Martinez',
    role: 'Multi-instrumentalist',
    initials: 'AM',
    content:
      'The variety of styles covered is amazing. From Cuban son to Argentine tango, I have been able to expand my musical vocabulary tremendously.',
  },
  {
    name: 'David Kim',
    role: 'Bass player, 6 months learning',
    initials: 'DK',
    content:
      'The downloadable resources are fantastic. Having sheet music and backing tracks for offline practice has made a huge difference in my learning.',
  },
  {
    name: 'Elena Volkov',
    role: 'Jazz musician',
    initials: 'EV',
    content:
      'As a jazz musician wanting to incorporate Latin elements, this platform has been invaluable. The instructors explain the cultural context beautifully.',
  },
]

export function TestimonialsSection() {
  return (
    <section id="testimonials" className="py-24 lg:py-32 bg-[#0f0f0f]">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-4 font-heading">
            Loved by musicians
          </h2>
          <p className="text-lg text-white/60">
            See what our students are saying about their learning experience
          </p>
        </motion.div>

        {/* Testimonial Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="p-6 rounded-2xl bg-card border border-white/5"
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
              <p className="text-white/80 leading-relaxed mb-6">
                &ldquo;{testimonial.content}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-sm font-semibold text-primary">
                    {testimonial.initials}
                  </span>
                </div>
                <div>
                  <div className="text-sm font-medium text-white">
                    {testimonial.name}
                  </div>
                  <div className="text-xs text-white/50">{testimonial.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
