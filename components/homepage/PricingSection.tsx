'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'

const features = [
  'All 150+ video lessons',
  'Interactive Soundslice integration',
  'Downloadable sheet music & tabs',
  'Progress tracking dashboard',
  'New content added monthly',
  'Cancel anytime',
]

export function PricingSection() {
  return (
    <section id="pricing" className="py-24 lg:py-32">
      <div className="max-w-4xl mx-auto px-6">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-4 font-heading">
            Simple, transparent pricing
          </h2>
          <p className="text-lg text-white/60">
            One plan. Unlimited access. No hidden fees.
          </p>
        </motion.div>

        {/* Pricing Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="max-w-md mx-auto"
        >
          <div className="relative p-8 rounded-3xl bg-card border border-white/10 overflow-hidden">
            {/* Subtle gradient accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-orange-400 to-primary" />

            {/* Price */}
            <div className="text-center mb-8">
              <div className="text-sm text-white/50 uppercase tracking-wider mb-2">
                Monthly Membership
              </div>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl font-bold text-white">$39</span>
                <span className="text-lg text-white/50">/month</span>
              </div>
            </div>

            {/* Features */}
            <ul className="space-y-4 mb-8">
              {features.map((feature) => (
                <li key={feature} className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-white/80">{feature}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <Button
              className="w-full bg-primary hover:bg-primary/90 text-white py-4 h-auto text-base font-semibold rounded-full"
              asChild
            >
              <Link href="/signup">Start Your Free Trial</Link>
            </Button>

            <p className="text-center text-xs text-white/40 mt-4">
              14-day money-back guarantee. No credit card required.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
