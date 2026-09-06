'use client'

import Link from 'next/link'
import { Flame } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'

interface HeaderStreakClientProps {
  streak: number
}

export function HeaderStreakClient({ streak }: HeaderStreakClientProps) {
  const { t } = useTranslation()
  const hasStreak = streak > 0
  const label = hasStreak
    ? t(streak === 1 ? 'dashboard.header.streak.tooltipOne' : 'dashboard.header.streak.tooltipOther', { count: streak })
    : t('dashboard.header.streak.empty')

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="/dashboard/progress"
          aria-label={label}
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold tabular-nums transition-colors',
            hasStreak
              ? 'bg-primary/[0.14] text-primary hover:bg-primary/20'
              : 'bg-secondary text-muted-foreground hover:text-foreground'
          )}
        >
          <Flame className={cn('h-4 w-4', hasStreak && 'fill-current')} />
          <span>{streak}</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
