'use client'

import { Flame } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import styles from './quiz.module.css'

/** Shows from two correct in a row; gold from four. `pop` replays the scale animation. */
export function StreakChip({ count, pop }: { count: number; pop: boolean }) {
  const { t } = useTranslation()
  if (count < 2) return null
  const hot = count >= 4
  return (
    <span
      key={pop ? `pop-${count}` : `still-${count}`}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full pl-2 pr-2.5 text-xs font-bold',
        hot ? 'bg-gradient-to-r from-primary/25 to-gold/25 text-gold' : 'bg-primary/15 text-primary',
        pop && styles.pop,
      )}
    >
      <Flame className="h-3.5 w-3.5" />
      {t(hot ? 'dashboard.classViewer.quiz.streak.onFire' : 'dashboard.classViewer.quiz.streak.inRow', { count })}
    </span>
  )
}
