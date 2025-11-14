'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Check } from 'lucide-react'

const features = [
  'Access to all Latin music courses',
  'Interactive Soundslice lessons',
  'HD video tutorials',
  'Downloadable sheet music & tabs',
  'Practice exercises & backing tracks',
  'Progress tracking',
  'Learn at your own pace',
  'New content added monthly',
  'Cancel anytime',
]

export function PricingSection() {
  return (
    <section id="pricing" className="py-24 md:py-32 bg-secondary/50">
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
            Simple, Transparent Pricing
          </h2>
          <p className="text-base md:text-lg text-muted-foreground">
            One plan, unlimited access to everything
          </p>
        </motion.div>

        {/* Pricing Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          viewport={{ once: true }}
          className="max-w-lg mx-auto"
        >
          <Card className="border-2 border-primary/20 shadow-lg">
            <CardHeader className="text-center pb-8 pt-8">
              <CardTitle className="text-2xl mb-2">Monthly Membership</CardTitle>
              <CardDescription className="text-base">
                Unlimited access to all courses
              </CardDescription>
              <div className="mt-4">
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-5xl font-bold text-primary">$39.99</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Features List */}
              <ul className="space-y-3">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <Button
                className="w-full bg-primary text-white hover:bg-primary/90 hover:text-white px-8 py-3 h-auto rounded-full font-semibold text-base"
                asChild
              >
                <Link href="/signup">
                  Start Learning Now
                </Link>
              </Button>

              {/* Trust Message */}
              <p className="text-xs text-center text-muted-foreground">
                No credit card required to start • Cancel anytime • 14-day money-back guarantee
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}
