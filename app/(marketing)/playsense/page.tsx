import type { Metadata } from 'next'
import PlaysenseContent from './playsense-content'

export const metadata: Metadata = {
  title: 'PlaySense - Latin Music Mastery',
  description:
    'PlaySense is our AI-powered practice tool that listens to your playing in real time and gives instant feedback on pitch, rhythm, timing, and dynamics — paired with synchronized notation that follows along as you play.',
}

export default function PlaysensePage() {
  return <PlaysenseContent />
}
