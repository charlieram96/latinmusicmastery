import type { Metadata } from 'next'
import FaqContent from './faq-content'

export const metadata: Metadata = {
  title: 'FAQ - Latin Music Mastery',
  description: 'Find answers to common questions about Latin Music Mastery courses, subscriptions, and features.',
}

export default function FAQPage() {
  return <FaqContent />
}
