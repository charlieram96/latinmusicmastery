'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

interface Instructor {
  id: string
  name: string
  instrument: string
  bio: string | null
  image_url: string | null
  specialties: string[] | null
}

interface Props {
  instructors: Instructor[]
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function InstructorsSection({ instructors }: Props) {
  return (
    <section id="instructors" className="py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12"
        >
          <div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground mb-2 font-heading">
              Learn from the best
            </h2>
            <p className="text-lg text-muted-foreground max-w-xl">
              World-class musicians with decades of performance and teaching
              experience
            </p>
          </div>

          <Link
            href="/dashboard/teachers"
            className="text-primary hover:text-primary/80 text-sm font-medium inline-flex items-center gap-1 transition-colors"
          >
            View all instructors
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>

        {/* Instructor Cards - Horizontal scroll mobile, grid desktop */}
        <div className="flex gap-6 overflow-x-auto pb-4 md:grid md:grid-cols-3 md:overflow-visible scrollbar-hide">
          {instructors.slice(0, 3).map((instructor, i) => (
            <motion.div
              key={instructor.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="flex-shrink-0 w-[280px] md:w-auto"
            >
              <div className="relative group">
                {/* Image */}
                <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-card mb-4">
                  {instructor.image_url ? (
                    <img
                      src={instructor.image_url}
                      alt={instructor.name}
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                      <span className="text-4xl font-bold text-muted-foreground/30">
                        {getInitials(instructor.name)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <h3 className="text-lg font-semibold text-foreground">
                  {instructor.name}
                </h3>
                <p className="text-sm text-primary">{instructor.instrument}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
