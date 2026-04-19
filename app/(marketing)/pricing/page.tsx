import type { Metadata } from 'next'
import PricingContent from './pricing-content'

export const metadata: Metadata = {
  title: 'Pricing - Latin Music Mastery',
  description: 'Simple, flexible pricing. Subscribe per instrument at $14.99/mo or get unlimited All-Access for $69.99/mo.',
}

export default function PricingPage() {
  return <PricingContent />
}
