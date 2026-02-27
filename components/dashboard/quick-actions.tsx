'use client'

import Link from 'next/link'
import { Play, BookOpen, Music, MessageSquare } from 'lucide-react'
import {
  AnimatedSection,
  StaggerContainer,
  StaggerItem,
} from '@/components/dashboard/animated-section'

const ACTIONS = [
  {
    label: 'Resume Last Lesson',
    href: '/dashboard/my-courses',
    icon: Play,
    iconBg: 'bg-terracotta/15',
    iconColor: 'text-terracotta',
    gradient: 'from-terracotta/6 to-transparent',
  },
  {
    label: 'Browse Courses',
    href: '/dashboard/courses',
    icon: BookOpen,
    iconBg: 'bg-gold/15',
    iconColor: 'text-gold',
    gradient: 'from-gold/6 to-transparent',
  },
  {
    label: 'Open Tuner',
    href: '/dashboard/tuner',
    icon: Music,
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
    gradient: 'from-amber-500/6 to-transparent',
  },
  {
    label: 'Submit Feedback',
    href: '/dashboard/feedback',
    icon: MessageSquare,
    iconBg: 'bg-terracotta/10',
    iconColor: 'text-terracotta/80',
    gradient: 'from-terracotta/5 to-transparent',
  },
] as const

interface QuickActionsProps {
  variant?: 'grid' | 'list'
}

export function QuickActions({ variant = 'grid' }: QuickActionsProps) {
  if (variant === 'list') {
    return (
      <AnimatedSection delay={0.1}>
        <div className="warm-surface rounded-2xl p-4">
          <h3 className="text-sm font-heading font-semibold text-foreground mb-3">
            Quick Actions
          </h3>
          <div className="space-y-1">
            {ACTIONS.map((action) => {
              const Icon = action.icon
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-200 hover:bg-white/[0.04] group"
                >
                  <div
                    className={`rounded-lg p-1.5 ${action.iconBg} transition-colors duration-200`}
                  >
                    <Icon className={`h-4 w-4 ${action.iconColor}`} />
                  </div>
                  <span className="text-sm font-medium text-foreground/90 group-hover:text-foreground transition-colors">
                    {action.label}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </AnimatedSection>
    )
  }

  return (
    <AnimatedSection delay={0.1}>
      <StaggerContainer className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ACTIONS.map((action) => {
          const Icon = action.icon
          return (
            <StaggerItem key={action.href}>
              <Link
                href={action.href}
                className="relative overflow-hidden warm-surface rounded-xl p-4 flex flex-col items-center gap-2 text-center transition-all duration-200 hover:scale-[1.02] hover:warm-glow hover:shadow-[0_4px_24px_-4px_hsl(var(--warm-surface)/0.5),0_0_0_1px_hsl(0_0%_100%/0.04)] group"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} pointer-events-none`} />
                <div
                  className={`relative rounded-lg p-2.5 ${action.iconBg} transition-colors duration-200`}
                >
                  <Icon className={`h-5 w-5 ${action.iconColor}`} />
                </div>
                <span className="relative text-sm font-medium text-foreground/90 group-hover:text-foreground transition-colors">
                  {action.label}
                </span>
              </Link>
            </StaggerItem>
          )
        })}
      </StaggerContainer>
    </AnimatedSection>
  )
}
