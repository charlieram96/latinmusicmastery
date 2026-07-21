'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, MinusCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Graded feedback for a question score in [0, 1]; fractional scores show a partial-credit state. */
export function FeedbackBanner({ score, explanation }: { score: number; explanation?: string | null }) {
  const state = score >= 1 ? 'correct' : score > 0 ? 'partial' : 'incorrect'
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        'flex items-start gap-3 rounded-2xl border-2 p-4',
        state === 'correct' && 'border-green-500/40 bg-green-500/10',
        state === 'partial' && 'border-amber-500/40 bg-amber-500/10',
        state === 'incorrect' && 'border-red-500/40 bg-red-500/10',
      )}
    >
      {state === 'correct' ? (
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-600" />
      ) : state === 'partial' ? (
        <MinusCircle className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
      ) : (
        <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-600" />
      )}
      <div>
        <p
          className={cn(
            'font-bold',
            state === 'correct' && 'text-green-700 dark:text-green-400',
            state === 'partial' && 'text-amber-700 dark:text-amber-400',
            state === 'incorrect' && 'text-red-700 dark:text-red-400',
          )}
        >
          {state === 'correct' ? 'Correct!' : state === 'partial' ? 'Almost there!' : 'Not quite right'}
        </p>
        {explanation && <p className="mt-1 text-sm text-muted-foreground">{explanation}</p>}
      </div>
    </motion.div>
  )
}
