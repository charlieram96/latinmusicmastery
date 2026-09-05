'use client'

import { cn } from '@/lib/utils'
import { useTranslation } from '@/components/language-provider'
import { Input } from '@/components/ui/input'
import { norm, type Blank } from '@/lib/quiz/grading'
import type { QuestionInputProps } from './input-props'

/** fill_in_blank: inline inputs inside the prompt text when it has `{{id}}` placeholders, else labeled inputs. */
export function FillBlankInput({ question: q, answer, isGraded, onChange }: QuestionInputProps) {
  const { t } = useTranslation()
  const opts = (q.options ?? {}) as Record<string, unknown>
  const blanks = (opts.blanks as Blank[]) ?? []
  const text = (opts.text as string) ?? ''
  const given = (answer as Record<string, string>) ?? {}
  const blankById = new Map(blanks.map((b) => [b.id, b]))

  if (text && /\{\{(\w+)\}\}/.test(text)) {
    const parts = text.split(/(\{\{\w+\}\})/g)
    return (
      <p className="text-lg leading-loose">
        {parts.map((part, i) => {
          const m = part.match(/^\{\{(\w+)\}\}$/)
          if (!m) return <span key={i}>{part}</span>
          const id = m[1]
          const b = blankById.get(id)
          const val = given[id] ?? ''
          const ok = isGraded && b && norm(val) === norm(b.answer)
          return (
            <input
              key={i}
              value={val}
              disabled={isGraded}
              onChange={(e) => onChange({ ...given, [id]: e.target.value })}
              placeholder="…"
              className={cn(
                'mx-1 inline-block w-32 rounded-lg border-b-2 bg-primary/5 px-2 py-0.5 text-center font-semibold outline-none focus:border-primary',
                isGraded
                  ? ok
                    ? 'border-green-500 text-green-700 dark:text-green-400'
                    : 'border-red-500 text-red-700 dark:text-red-400'
                  : 'border-primary/40',
              )}
            />
          )
        })}
      </p>
    )
  }

  // Fallback: labeled inputs when there is no placeholder text.
  return (
    <div className="space-y-3">
      {blanks.map((b) => {
        const val = given[b.id] ?? ''
        const ok = isGraded && norm(val) === norm(b.answer)
        return (
          <div key={b.id} className="flex items-center gap-3">
            <span className="min-w-[90px] rounded-lg bg-muted px-2 py-1 font-mono text-xs">{b.id}</span>
            <Input
              value={val}
              disabled={isGraded}
              onChange={(e) => onChange({ ...given, [b.id]: e.target.value })}
              placeholder={t('dashboard.classViewer.quiz.yourAnswer')}
              className={cn('rounded-xl', isGraded && (ok ? 'border-green-500' : 'border-red-500'))}
            />
          </div>
        )
      })}
    </div>
  )
}
