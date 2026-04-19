import type { Metadata } from 'next'
import AboutContent from './about-content'

export const metadata: Metadata = {
  title: 'About Us - Latin Music Mastery',
  description: 'Learn about our mission to make authentic Latin American music education accessible to everyone.',
}

export default function AboutPage() {
  return <AboutContent />
}
