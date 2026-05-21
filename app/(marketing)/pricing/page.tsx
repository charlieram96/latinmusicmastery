import type { Metadata } from 'next'
import PricingContent from './pricing-content'

export const metadata: Metadata = {
  title: 'Pricing - Latin Music Mastery',
  description: 'Simple, flexible pricing. Start an instrument for $19.99/mo (fundamentals course + a genre of your choice), add more genre courses for $9.99/mo each, or save 17% with annual billing ($199.99/yr).',
}

export default function PricingPage() {
  return <PricingContent />
}
