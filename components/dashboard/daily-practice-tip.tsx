'use client'

import { useMemo } from 'react'
import { Lightbulb } from 'lucide-react'
import { AnimatedSection } from '@/components/dashboard/animated-section'

const PRACTICE_TIPS = [
  {
    title: 'Slow It Down',
    tip: 'Practice tricky passages at half tempo. Speed follows accuracy — nail the notes first, then gradually increase.',
  },
  {
    title: 'Listen Actively',
    tip: 'Spend 10 minutes today just listening to your favorite Latin track. Focus on one instrument and how it fits the clave.',
  },
  {
    title: 'Clap the Clave',
    tip: 'Before you play, clap the clave pattern for 2 minutes. Internalizing the rhythm makes everything else easier.',
  },
  {
    title: 'Record Yourself',
    tip: 'Record a short clip of your practice. Listening back reveals things you miss in the moment.',
  },
  {
    title: 'Isolate the Hard Part',
    tip: 'Pick the two hardest measures and loop them 20 times. Targeted repetition beats playing through the whole piece.',
  },
  {
    title: 'Play With Feeling',
    tip: 'Even during exercises, add dynamics. Playing musically from the start builds better habits than adding expression later.',
  },
  {
    title: 'Warm Up Your Ears',
    tip: 'Sing or hum the melody before you play it. If you can hear it internally, your hands will follow more naturally.',
  },
]

export function DailyPracticeTip() {
  const tip = useMemo(() => {
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
        86400000
    )
    return PRACTICE_TIPS[dayOfYear % PRACTICE_TIPS.length]
  }, [])

  return (
    <AnimatedSection delay={0.15}>
      <div className="warm-surface rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="rounded-lg p-1.5 bg-amber-500/15">
            <Lightbulb className="h-4 w-4 text-amber-400" />
          </div>
          <h3 className="text-sm font-heading font-semibold text-foreground">
            Daily Practice Tip
          </h3>
        </div>
        <p className="text-sm font-medium text-foreground leading-tight">
          {tip.title}
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
          {tip.tip}
        </p>
      </div>
    </AnimatedSection>
  )
}
