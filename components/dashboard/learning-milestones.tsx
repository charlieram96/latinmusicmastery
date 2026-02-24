'use client'

import {
  BookOpen,
  Target,
  Star,
  Trophy,
  Crown,
  Flame,
  Zap,
  Award,
  Sparkles,
  GraduationCap,
  Compass,
  Music,
  Users,
  Video,
  Heart,
  type LucideIcon,
} from 'lucide-react'
import {
  AnimatedSection,
  StaggerContainer,
  StaggerItem,
} from '@/components/dashboard/animated-section'
import type { LearningMilestonesProps } from '@/types/dashboard'

/* ------------------------------------------------------------------ */
/*  Icon lookup                                                        */
/* ------------------------------------------------------------------ */

const ICON_MAP: Record<string, LucideIcon> = {
  BookOpen,
  Target,
  Star,
  Trophy,
  Crown,
  Flame,
  Zap,
  Award,
  Sparkles,
  GraduationCap,
  Compass,
  Music,
  Users,
  Video,
  Heart,
}

/* ------------------------------------------------------------------ */
/*  Circular progress ring                                             */
/* ------------------------------------------------------------------ */

const RADIUS = 28
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function CircularProgress({
  progress,
  size = 64,
}: {
  progress: number
  size?: number
}) {
  const offset = CIRCUMFERENCE * (1 - progress / 100)

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className="rotate-[-90deg]"
    >
      {/* Background track */}
      <circle
        cx="32"
        cy="32"
        r={RADIUS}
        fill="none"
        stroke="hsl(var(--muted) / 0.25)"
        strokeWidth={5}
      />
      {/* Progress arc */}
      <circle
        cx="32"
        cy="32"
        r={RADIUS}
        fill="none"
        stroke="hsl(var(--gold-highlight))"
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        className="transition-[stroke-dashoffset] duration-700 ease-out"
      />
      {/* Center percentage text — counter-rotate so it reads normally */}
      <text
        x="32"
        y="32"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground text-[11px] font-semibold rotate-90 origin-center"
      >
        {Math.round(progress)}%
      </text>
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function LearningMilestones({ milestones }: LearningMilestonesProps) {
  if (milestones.length === 0) return null

  return (
    <AnimatedSection delay={0.2}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-gold" />
          <h3 className="text-lg font-heading font-semibold text-foreground">
            Next Milestones
          </h3>
        </div>

        {/* Scrollable card row */}
        <StaggerContainer className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:overflow-x-visible sm:pb-0">
          {milestones.map((milestone) => {
            const Icon = ICON_MAP[milestone.iconName] ?? Star

            return (
              <StaggerItem key={milestone.key}>
                <div className="warm-surface rounded-2xl p-4 flex flex-col items-center text-center min-w-[160px] gap-2 transition-all duration-200 hover:brightness-110 hover:warm-glow">
                  {/* Circular progress ring */}
                  <div className="relative">
                    <CircularProgress progress={milestone.progress} />
                    {/* Icon overlaid in the center (visible beside percentage) */}
                  </div>

                  {/* Achievement icon */}
                  <Icon className="h-4 w-4 text-gold/70" />

                  {/* Title */}
                  <p className="text-sm font-medium text-foreground leading-tight line-clamp-2">
                    {milestone.title}
                  </p>

                  {/* Description */}
                  <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                    {milestone.description}
                  </p>

                  {/* X/Y progress text */}
                  <p className="text-xs font-medium tabular-nums text-amber-400/80">
                    {milestone.current}/{milestone.requirement}
                  </p>
                </div>
              </StaggerItem>
            )
          })}
        </StaggerContainer>
      </div>
    </AnimatedSection>
  )
}
