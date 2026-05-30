import type { Metadata } from 'next'
import PricingContent from './pricing-content'
import { getPricing } from '@/lib/payments/pricing-source'

export const metadata: Metadata = {
  title: 'Pricing - Latin Music Mastery',
  description: 'Simple, flexible pricing. Start an instrument with the fundamentals course + a genre of your choice, add more genre courses, or save with annual billing.',
}

export default async function PricingPage() {
  const prices = await getPricing()
  return <PricingContent prices={prices} />
}
