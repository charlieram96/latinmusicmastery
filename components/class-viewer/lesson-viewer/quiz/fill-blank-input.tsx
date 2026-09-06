'use client'

import { Fragment } from 'react'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import { norm, type Blank } from '@/lib/quiz/grading'
import type { QuestionInputProps } from './input-props'

const inputClass =
  'h-[34px] rounded-[9px] border-[1.5px] border-b-2 bg-raised px-2.5 text-center text-[15px] font-semibold outline-none transition-[border-color,box-shadow] focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.18)] disabled:opacity-100'

/** Blanks sit inside the sentence, sized to the answer. A wrong word is struck through with the right one underneath. */
export function FillBlankInput({ question: q, answer, isGraded, onChange }: QuestionInputProps) {
  const { t } = useTranslation()
  const opts = (q.options ?? {}) as Record<string, unknown>
  const blanks = (opts.blanks as Blank[]) ?? []
  const text = (opts.text as string) ?? ''
  const given = (answer as Record<string, string>) ?? {}
  const blankById = new Map(blanks.map((b) => [b.id, b]))
  const positionById = new Map(blanks.map((b, i) => [b.id, i + 1]))

  const renderBlank = (b: Blank, key: React.Key) => {
    const val = given[b.id] ?? ''
    const ok = isGraded ? norm(val) === norm(b.answer) : null
    return (
      <span key={key} className="relative mx-1 inline-flex align-baseline">
        <input
          value={val}
          disabled={isGraded}
          aria-label={`${t('dashboard.classViewer.quiz.yourAnswer')} ${positionById.get(b.id)}`}
          onChange={(e) => onChange({ ...given, [b.id]: e.target.value })}
          style={{ width: `${Math.max(b.answer.length + 3, 7)}ch` }}
          className={cn(
            inputClass,
            ok === null && 'border-foreground/20 border-b-primary focus:border-primary',
            ok === true && 'border-success text-success',
            ok === false && 'border-terracotta text-terracotta line-through',
          )}
        />
        {ok === false && (
          <span className="absolute left-1/2 top-full -translate-x-1/2 whitespace-nowrap text-[11.5px] font-bold leading-none text-success" style={{ marginTop: -4 }}>
            {b.answer}
          </span>
        )}
      </span>
    )
  }

  if (text && /\{\{(\w+)\}\}/.test(text)) {
    const parts = text.split(/(\{\{\w+\}\})/g)
    return (
      <p className="text-[17px] font-medium leading-[2.1]">
        {parts.map((part, i) => {
          const m = part.match(/^\{\{(\w+)\}\}$/)
          if (!m) return <Fragment key={i}>{part}</Fragment>
          const b = blankById.get(m[1])
          return b ? renderBlank(b, i) : <Fragment key={i}>{part}</Fragment>
        })}
      </p>
    )
  }

  // Fallback: labeled inputs when the text has no placeholders.
  return (
    <div className="grid gap-3">
      {blanks.map((b) => (
        <div key={b.id} className="flex items-center gap-3">
          <span className="min-w-[90px] rounded-lg bg-sunken px-2 py-1 font-mono text-xs">{b.id}</span>
          {renderBlank(b, b.id)}
        </div>
      ))}
    </div>
  )
}
