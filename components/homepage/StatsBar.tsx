'use client'

import { useEffect, useRef, useState } from 'react'
import { useInView } from 'react-intersection-observer'
import { motion } from 'framer-motion'

interface Stat {
  label: string
  value: number
  suffix?: string
}

const stats: Stat[] = [
  { label: 'Active Students', value: 10000, suffix: '+' },
  { label: 'Video Lessons', value: 500, suffix: '+' },
  { label: 'Hours of Content', value: 200, suffix: '+' },
  { label: 'Expert Instructors', value: 15, suffix: '' },
]

function CountUp({ end, suffix = '', duration = 2 }: { end: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0)
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.5 })
  const hasAnimated = useRef(false)

  useEffect(() => {
    if (inView && !hasAnimated.current) {
      hasAnimated.current = true
      const increment = end / (duration * 60) // 60 fps
      let current = 0

      const timer = setInterval(() => {
        current += increment
        if (current >= end) {
          setCount(end)
          clearInterval(timer)
        } else {
          setCount(Math.floor(current))
        }
      }, 1000 / 60)

      return () => clearInterval(timer)
    }
  }, [inView, end, duration])

  return (
    <span ref={ref} className="text-4xl md:text-5xl font-bold text-foreground">
      {count.toLocaleString()}
      {suffix}
    </span>
  )
}

export function StatsBar() {
  return (
    <section className="bg-secondary border-y border-border">
      <div className="container mx-auto px-4 py-16 md:py-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <CountUp end={stat.value} suffix={stat.suffix} />
              <p className="mt-2 text-sm md:text-base text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
