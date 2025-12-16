'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ModernHero() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-20">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-background">
        {/* Single subtle radial gradient */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] opacity-30"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(244,140,46,0.15) 0%, transparent 70%)',
          }}
        />
        {/* Subtle grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.02] dark:opacity-[0.02]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M0 0h1v60H0zM60 0v1H0V0z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        {/* Small badge/announcement */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-border text-sm text-muted-foreground mb-8"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Learn authentic Latin rhythms from world-class instructors
        </motion.div>

        {/* Main Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight text-foreground leading-[1.1] mb-6 font-heading"
        >
          Master the rhythms of
          <br />
          <span className="text-primary">Latin America</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Learn salsa, bossa nova, tango, and more from world-class instructors.
          Interactive lessons designed for musicians of all levels.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <Button
            className="bg-primary hover:bg-primary/90 text-white !px-8 py-4 h-auto text-base font-semibold rounded-full shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
            asChild
          >
            <Link href="/signup" className="flex items-center justify-center">
              Start Learning Free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>

          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-foreground hover:bg-muted !px-8 py-4 h-auto text-base font-medium rounded-full border border-border"
            asChild
          >
            <Link href="#demo" className="flex items-center justify-center">
              <Play className="w-4 h-4 mr-2" />
              Watch Demo
            </Link>
          </Button>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="w-6 h-10 rounded-full border-2 border-border flex items-start justify-center p-2"
        >
          <div className="w-1 h-2 bg-muted-foreground/40 rounded-full" />
        </motion.div>
      </motion.div>
    </section>
  )
}
