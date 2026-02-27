'use client'

import {
  BookOpen,
  CheckCircle,
  Trophy,
  Award,
  Star,
  Clock,
  Music,
  Flame,
  Zap,
  GraduationCap,
  type LucideIcon,
} from 'lucide-react'
import {
  AnimatedSection,
  StaggerContainer,
  StaggerItem,
} from '@/components/dashboard/animated-section'
import type { RecentActivityProps, RecentActivityItem } from '@/types/dashboard'

/* ------------------------------------------------------------------ */
/*  Icon lookup                                                        */
/* ------------------------------------------------------------------ */

const ICON_MAP: Record<string, LucideIcon> = {
  BookOpen,
  CheckCircle,
  Trophy,
  Award,
  Star,
  Clock,
  Music,
  Flame,
  Zap,
  GraduationCap,
}

/* ------------------------------------------------------------------ */
/*  Relative timestamp formatter                                       */
/* ------------------------------------------------------------------ */

function relativeTime(isoString: string): string {
  const now = Date.now()
  const then = new Date(isoString).getTime()
  const diffMs = now - then

  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'Just now'
  if (minutes < 60) return `${minutes} min${minutes !== 1 ? 's' : ''} ago`
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) {
    const weeks = Math.floor(days / 7)
    return `${weeks} week${weeks !== 1 ? 's' : ''} ago`
  }
  const months = Math.floor(days / 30)
  return `${months} month${months !== 1 ? 's' : ''} ago`
}

/* ------------------------------------------------------------------ */
/*  Activity icon circle                                               */
/* ------------------------------------------------------------------ */

function ActivityIcon({ item }: { item: RecentActivityItem }) {
  const Icon = ICON_MAP[item.iconName] ?? Star

  const bgClass =
    item.type === 'achievement_earned'
      ? 'bg-terracotta/20 text-terracotta'
      : 'bg-amber-500/20 text-amber-400'

  return (
    <div
      className={`relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${bgClass}`}
    >
      <Icon className="h-4 w-4" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

interface ExtendedRecentActivityProps extends RecentActivityProps {
  maxItems?: number
}

export function RecentActivity({ activities, maxItems = 8 }: ExtendedRecentActivityProps) {
  if (activities.length === 0) return null

  const displayed = activities.slice(0, maxItems)

  return (
    <AnimatedSection delay={0.3}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-gold" />
          <h3 className="text-lg font-heading font-semibold text-foreground">
            Recent Activity
          </h3>
        </div>

        {/* Timeline card */}
        <div className="relative overflow-hidden warm-surface rounded-2xl p-3 sm:p-4">
          {/* Subtle gold glow along left edge */}
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-gold/5 to-transparent pointer-events-none" />
          <StaggerContainer className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-warm-surface brightness-150 rounded-full" />

            {displayed.map((activity, index) => (
              <StaggerItem key={activity.id}>
                <div
                  className={`relative flex gap-3 ${
                    index < displayed.length - 1 ? 'pb-5' : ''
                  }`}
                >
                  {/* Icon circle on the timeline */}
                  <ActivityIcon item={activity} />

                  {/* Content */}
                  <div className="min-w-0 pt-0.5">
                    <p className="text-sm font-medium text-foreground leading-tight">
                      {activity.title}
                    </p>
                    {activity.subtitle && (
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        {activity.subtitle}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      {relativeTime(activity.timestamp)}
                    </p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </div>
    </AnimatedSection>
  )
}
