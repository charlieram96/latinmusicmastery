'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export function FeedbackBanner({ correct, explanation }: { correct: boolean; explanation?: string | null }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        'flex items-start gap-3 rounded-2xl border-2 p-4',
        correct ? 'border-green-500/40 bg-green-500/10' : 'border-red-500/40 bg-red-500/10',
      )}
    >
      {correct ? (
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-600" />
      ) : (
        <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-600" />
      )}
      <div>
        <p className={cn('font-bold', correct ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400')}>
          {correct ? 'Correct!' : 'Not quite right'}
        </p>
        {explanation && <p className="mt-1 text-sm text-muted-foreground">{explanation}</p>}
      </div>
    </motion.div>
  )
}
