import type { Metadata } from 'next'
import ContactContent from './contact-content'

export const metadata: Metadata = {
  title: 'Contact Us - Latin Music Mastery',
  description: 'Get in touch with our team for questions, feedback, or partnership inquiries.',
}

export default function ContactPage() {
  return <ContactContent />
}
