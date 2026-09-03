'use client'

import { Flame } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useTranslation } from '@/components/language-provider'

interface HeaderStreakClientProps {
  streak: number
}

export function HeaderStreakClient({ streak }: HeaderStreakClientProps) {
  const { t } = useTranslation()
  const hasStreak = streak > 0

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-sm font-medium transition-colors ${
              hasStreak
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground bg-muted/50'
            }`}
          >
            <Flame className={`h-4 w-4 ${hasStreak ? 'fill-primary' : ''}`} />
            <span>{streak}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {hasStreak
              ? t(
                  streak === 1 ? 'dashboard.header.streak.tooltipOne' : 'dashboard.header.streak.tooltipOther',
                  { count: streak },
                )
              : t('dashboard.header.streak.empty')}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
