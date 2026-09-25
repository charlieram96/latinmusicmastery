'use client'

import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import { Burst } from './burst'
import styles from './quiz.module.css'

export type TileState = 'idle' | 'selected' | 'correct' | 'wrong' | 'reveal' | 'dim'

/** Derive a tile's state from whether it is the right answer, whether the student picked it, and whether the question is graded. */
export function tileState(isCorrect: boolean, picked: boolean, graded: boolean): TileState {
  if (!graded) return picked ? 'selected' : 'idle'
  if (isCorrect && picked) return 'correct'
  if (isCorrect) return 'reveal'
  if (picked) return 'wrong'
  return 'dim'
}

/**
 * Large tappable answer tile. `letter` is the A/B/C badge; `hint` is the
 * keyboard key shown on hover; `size="big"` centers a large label (true/false).
 * Correct tiles pulse once and release a small burst; wrong tiles shake.
 */
export function OptionTile({
  letter,
  hint,
  size = 'default',
  state,
  disabled,
  onClick,
  children,
}: {
  letter?: string
  hint?: string
  size?: 'default' | 'big'
  state: TileState
  disabled?: boolean
  onClick?: () => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  const isWrong = state === 'wrong'
  const badge =
    state === 'correct' || state === 'reveal' ? <Check className="h-4 w-4" /> : state === 'wrong' ? <X className="h-4 w-4" /> : letter
  const mark =
    state === 'correct'
      ? t('dashboard.classViewer.quiz.tile.correct')
      : state === 'reveal'
        ? t('dashboard.classViewer.quiz.tile.answer')
        : state === 'wrong'
          ? t('dashboard.classViewer.quiz.tile.yourPick')
          : null

  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={state === 'selected' || state === 'correct' || state === 'wrong'}
      data-state={state}
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      animate={isWrong ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
      transition={{ duration: isWrong ? 0.42 : 0.2 }}
      className={cn(
        'group relative grid w-full items-center gap-3.5 rounded-[14px] border-[1.5px] bg-raised p-3.5 text-left transition-all disabled:cursor-default',
        size === 'big' ? 'grid-cols-1 justify-items-center gap-2 py-5' : 'grid-cols-[36px_1fr_auto]',
        state === 'idle' && 'border-border hover:-translate-y-px hover:border-foreground/20',
        state === 'selected' && 'border-primary bg-primary/10 shadow-[0_0_0_3px_hsl(var(--primary)/0.18)]',
        state === 'correct' && cn('border-success bg-success/10', styles.okPulse),
        state === 'wrong' && 'border-terracotta bg-terracotta/10',
        state === 'reveal' && 'border-dashed border-success',
        state === 'dim' && 'border-border opacity-55',
      )}
    >
      {state === 'correct' && <Burst />}
      {(letter || badge) && (
        <span
          className={cn(
            'grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border-[1.5px] font-heading text-sm font-extrabold transition-colors',
            state === 'idle' && 'border-foreground/25 text-muted-foreground',
            state === 'selected' && 'border-primary bg-primary text-primary-foreground',
            state === 'correct' && 'border-success bg-success text-white',
            state === 'wrong' && 'border-terracotta bg-terracotta text-white',
            state === 'reveal' && 'border-success text-success',
            state === 'dim' && 'border-foreground/15 text-muted-foreground',
          )}
        >
          {badge}
        </span>
      )}
      <span className={cn('min-w-0 font-medium leading-snug', size === 'big' ? 'font-heading text-[22px] font-extrabold tracking-[-0.01em]' : 'text-[15px]')}>
        {children}
      </span>
      {mark ? (
        <span
          className={cn(
            'text-[11.5px] font-bold uppercase tracking-[0.04em]',
            state === 'wrong' ? 'text-terracotta' : 'text-success',
          )}
        >
          {mark}
        </span>
      ) : hint && !disabled ? (
        <kbd
          className={cn(
            'grid h-5 min-w-5 place-items-center rounded-[5px] border border-b-2 border-foreground/20 bg-raised px-1.5 text-[10.5px] font-semibold text-muted-foreground transition-opacity',
            size === 'big' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
        >
          {hint}
        </kbd>
      ) : (
        <span />
      )}
    </motion.button>
  )
}
