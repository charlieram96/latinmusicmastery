'use client'

import { motion } from 'framer-motion'
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import type { OrderItem } from '@/lib/quiz/grading'
import type { QuestionInputProps } from './input-props'

/** ordering_sequence: reorder items with up/down buttons; graded rows show right/wrong by final position. */
export function OrderingInput({ question: q, answer, isGraded, onChange }: QuestionInputProps) {
  const { t } = useTranslation()
  const opts = (q.options ?? {}) as Record<string, unknown>
  const items = (opts.items as OrderItem[]) ?? []
  const current = (answer as string[]) ?? items.map((it) => it.id)
  const byId = new Map(items.map((it) => [it.id, it]))
  const move = (from: number, dir: -1 | 1) => {
    const to = from + dir
    if (to < 0 || to >= current.length) return
    const next = [...current]
    ;[next[from], next[to]] = [next[to], next[from]]
    onChange(next)
  }
  return (
    <div className="space-y-2">
      {current.map((id, i) => {
        const it = byId.get(id)
        const ok = isGraded && it?.correctPosition === i
        return (
          <motion.div
            key={id}
            layout
            transition={{ type: 'spring', stiffness: 500, damping: 40 }}
            className={cn(
              'flex items-center gap-3 rounded-2xl border-2 p-3',
              isGraded ? (ok ? 'border-green-500/50 bg-green-500/5' : 'border-red-500/50 bg-red-500/5') : 'border-border bg-card',
            )}
          >
            <GripVertical className="h-5 w-5 text-muted-foreground" />
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
              {i + 1}
            </span>
            <span className="flex-1 font-medium">{it?.text}</span>
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                disabled={isGraded || i === 0}
                onClick={() => move(i, -1)}
                aria-label={t('dashboard.classViewer.quiz.moveUp')}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={isGraded || i === current.length - 1}
                onClick={() => move(i, 1)}
                aria-label={t('dashboard.classViewer.quiz.moveDown')}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
