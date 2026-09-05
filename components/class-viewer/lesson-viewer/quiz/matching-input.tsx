'use client'

import { cn } from '@/lib/utils'
import { useTranslation } from '@/components/language-provider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { norm, shuffleStable, type Pair } from '@/lib/quiz/grading'
import type { QuestionInputProps } from './input-props'

/** matching_pairs: each left item gets a select of right-side choices, shuffled per question. */
export function MatchingInput({ question: q, answer, isGraded, onChange }: QuestionInputProps) {
  const { t } = useTranslation()
  const opts = (q.options ?? {}) as Record<string, unknown>
  const pairs = (opts.pairs as Pair[]) ?? []
  const given = (answer as Record<string, string>) ?? {}
  const rightChoices = shuffleStable(pairs.map((p) => p.right), q.id)
  return (
    <div className="space-y-3">
      {pairs.map((p) => {
        const val = given[p.id] ?? ''
        const ok = isGraded && norm(val) === norm(p.right)
        return (
          <div
            key={p.id}
            className={cn(
              'flex items-center gap-3 rounded-2xl border-2 p-3 transition-colors',
              isGraded ? (ok ? 'border-green-500/50 bg-green-500/5' : 'border-red-500/50 bg-red-500/5') : 'border-border',
            )}
          >
            <span className="flex-1 font-medium">{p.left}</span>
            <span className="text-muted-foreground">→</span>
            <Select value={val} disabled={isGraded} onValueChange={(v) => onChange({ ...given, [p.id]: v })}>
              <SelectTrigger className="flex-1 rounded-xl">
                <SelectValue placeholder={t('dashboard.classViewer.quiz.chooseMatch')} />
              </SelectTrigger>
              <SelectContent>
                {rightChoices.map((r, i) => (
                  <SelectItem key={`${r}-${i}`} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )
      })}
    </div>
  )
}
