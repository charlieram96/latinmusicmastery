'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function FinalCTA() {
  return (
    <section className="py-24 lg:py-32">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground mb-6 font-heading">
            Ready to start your
            <br />
            musical journey?
          </h2>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Join thousands of musicians mastering authentic Latin American music.
            Start your free trial today.
          </p>

          <Button
            className="bg-primary hover:bg-primary/90 text-white !px-8 py-4 h-auto text-base font-semibold rounded-full shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
            asChild
          >
            <Link href="/signup" className="flex items-center justify-center">
              Get Started Free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  )
}
