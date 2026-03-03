'use client'

import { useMemo } from 'react'
import { Flame, CheckCircle2, BarChart3 } from 'lucide-react'
import { AnimatedSection } from '@/components/dashboard/animated-section'
import type { WelcomeSummaryProps } from '@/types/dashboard'

const DAILY_QUOTES = [
  '"La musica es el lenguaje universal." — Keep playing!',
  '"Practice is the best of all instructors." — Cada dia cuenta.',
  '"El ritmo lo llevas dentro." — Let it out today!',
  '"Music gives a soul to the universe." — Sigue adelante.',
  '"De nota en nota se hace la cancion." — One step at a time.',
  '"Feel the clave, own the groove." — Ritmo y sabor!',
  '"La perseverancia todo lo alcanza." — You are closer than yesterday.',
]

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buenos dias'
  if (hour < 18) return 'Buenas tardes'
  return 'Buenas noches'
}

export function WelcomeSummary({
  name,
  streak,
  itemsCompletedThisWeek,
  closestCourse,
}: WelcomeSummaryProps) {
  const firstName = name?.trim().split(/\s+/)[0] || 'musician'
  const greeting = getGreeting()
  const quote = useMemo(() => {
    const dayIndex = new Date().getDay()
    return DAILY_QUOTES[dayIndex]
  }, [])

  return (
    <AnimatedSection delay={0}>
      <div className="relative overflow-hidden warm-surface warm-glow rounded-2xl p-5 sm:p-6">
        {/* Decorative gradient wash */}
        <div className="absolute inset-0 bg-gradient-to-br from-terracotta/8 to-gold/6 pointer-events-none" />
        {/* Soft gold glow — top right */}
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gold/8 blur-3xl pointer-events-none" />
        {/* Greeting */}
        <h2 className="relative text-xl sm:text-2xl font-heading font-semibold text-foreground">
          {greeting},{' '}
          <span className="text-terracotta">{firstName}</span>
        </h2>

        {/* Stat pills */}
        <div className="relative flex flex-wrap items-center gap-2 mt-4">
          {/* Streak */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 px-3 py-1.5">
            <Flame className="h-3.5 w-3.5 text-orange-400" />
            <span className="text-xs font-medium text-orange-300">
              {streak} day{streak !== 1 ? 's' : ''} streak
            </span>
          </div>

          {/* Items completed this week */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-medium text-emerald-300">
              {itemsCompletedThisWeek} completed this week
            </span>
          </div>

          {/* Closest course progress */}
          {closestCourse && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-xs font-medium text-amber-300">
                {closestCourse.progress}% {closestCourse.title}
              </span>
            </div>
          )}
        </div>

        {/* Motivational quote */}
        <p className="relative mt-4 text-sm italic text-muted-foreground leading-relaxed">
          {quote}
        </p>
      </div>
    </AnimatedSection>
  )
}
