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
  },
  {
    label: 'Browse Courses',
    href: '/dashboard/courses',
    icon: BookOpen,
    iconBg: 'bg-gold/15',
    iconColor: 'text-gold',
  },
  {
    label: 'Open Tuner',
    href: '/dashboard/tuner',
    icon: Music,
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
  },
  {
    label: 'Submit Feedback',
    href: '/dashboard/feedback',
    icon: MessageSquare,
    iconBg: 'bg-terracotta/10',
    iconColor: 'text-terracotta/80',
  },
] as const

export function QuickActions() {
  return (
    <AnimatedSection delay={0.1}>
      <StaggerContainer className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ACTIONS.map((action) => {
          const Icon = action.icon
          return (
            <StaggerItem key={action.href}>
              <Link
                href={action.href}
                className="warm-surface rounded-xl p-4 flex flex-col items-center gap-2 text-center transition-all duration-200 hover:scale-[1.02] hover:warm-glow hover:shadow-[0_4px_24px_-4px_hsl(var(--warm-surface)/0.5),0_0_0_1px_hsl(0_0%_100%/0.04)] group"
              >
                <div
                  className={`rounded-lg p-2.5 ${action.iconBg} transition-colors duration-200`}
                >
                  <Icon className={`h-5 w-5 ${action.iconColor}`} />
                </div>
                <span className="text-sm font-medium text-foreground/90 group-hover:text-foreground transition-colors">
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
