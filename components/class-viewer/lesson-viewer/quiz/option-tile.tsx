'use client'

import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type TileState = 'idle' | 'selected' | 'correct' | 'incorrect'

/** Large tappable answer tile with an optional letter badge and graded states. */
export function OptionTile({
  label,
  children,
  state,
  disabled,
  onClick,
}: {
  label?: string
  children: ReactNode
  state: TileState
  disabled?: boolean
  onClick?: () => void
}) {
  const isWrong = state === 'incorrect'
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      animate={isWrong ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
      transition={{ duration: isWrong ? 0.4 : 0.2 }}
      aria-pressed={state === 'selected'}
      className={cn(
        'group flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all disabled:cursor-default',
        state === 'idle' && 'border-border bg-card hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5',
        state === 'selected' && 'border-primary bg-primary/10 ring-2 ring-primary/30',
        state === 'correct' && 'border-green-500 bg-green-500/10',
        state === 'incorrect' && 'border-red-500 bg-red-500/10',
      )}
    >
      {label && (
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 text-sm font-bold transition-colors',
            state === 'idle' && 'border-border text-muted-foreground group-hover:border-primary/50',
            state === 'selected' && 'border-primary bg-primary text-primary-foreground',
            state === 'correct' && 'border-green-500 bg-green-500 text-white',
            state === 'incorrect' && 'border-red-500 bg-red-500 text-white',
          )}
        >
          {state === 'correct' ? <Check className="h-5 w-5" /> : state === 'incorrect' ? <X className="h-5 w-5" /> : label}
        </span>
      )}
      <span className="flex-1 text-base font-medium">{children}</span>
    </motion.button>
  )
}
