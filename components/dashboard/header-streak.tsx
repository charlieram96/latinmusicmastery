'use client'

import { Flame } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface HeaderStreakClientProps {
  streak: number
}

export function HeaderStreakClient({ streak }: HeaderStreakClientProps) {
  const hasStreak = streak > 0

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-sm font-medium transition-colors ${
              hasStreak
                ? 'text-[#F48C2E] bg-[#F48C2E]/10'
                : 'text-muted-foreground bg-muted/50'
            }`}
          >
            <Flame className={`h-4 w-4 ${hasStreak ? 'fill-[#F48C2E]' : ''}`} />
            <span>{streak}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {hasStreak
              ? `${streak} day${streak > 1 ? 's' : ''} learning streak!`
              : 'Start learning to build your streak!'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
