'use client'

import { useCallback, useLayoutEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/components/language-provider'
import { useContainerWidth } from '@/hooks/use-container-width'
import { cn } from '@/lib/utils'
import { norm, shuffleStable, type Pair } from '@/lib/quiz/grading'
import type { QuestionInputProps } from './input-props'

const NARROW = 560
type Line = { id: string; x1: number; y1: number; x2: number; y2: number; ok: boolean }

const item =
  'relative flex min-h-[52px] w-full items-center gap-2.5 rounded-xl border-[1.5px] bg-raised px-3.5 py-2.5 text-left text-sm font-medium transition-all disabled:cursor-default'
const port = 'absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 bg-card'

/**
 * Tap a left item, then its partner on the right; a curve connects them.
 * Below 560px the same answer is collected with tap-to-pick chips.
 * Answer shape: { [pairId]: rightText } — exactly what gradeQuestion compares.
 */
export function MatchingInput({ question: q, answer, isGraded, onChange }: QuestionInputProps) {
  const { t } = useTranslation()
  const pairs = useMemo(() => (((q.options ?? {}) as Record<string, unknown>).pairs as Pair[]) ?? [], [q.options])
  const rights = useMemo(() => shuffleStable(pairs.map((p) => p.right), q.id), [pairs, q.id])
  const given = (answer as Record<string, string>) ?? {}
  const [active, setActive] = useState<string | null>(null)
  const [ref, width] = useContainerWidth<HTMLDivElement>()
  const [lines, setLines] = useState<Line[]>([])

  const ownerOf = (right: string) => pairs.find((p) => norm(given[p.id] ?? '') === norm(right))?.id
  const okFor = (p: Pair) => norm(given[p.id] ?? '') === norm(p.right)

  const assign = (leftId: string, right: string) => {
    const next: Record<string, string> = { ...given }
    for (const k of Object.keys(next)) if (norm(next[k]) === norm(right)) delete next[k]
    next[leftId] = right
    onChange(next)
    setActive(null)
  }
  const unassign = (leftId: string) => {
    const next = { ...given }
    delete next[leftId]
    onChange(next)
  }

  const measure = useCallback(() => {
    const root = ref.current
    if (!root) return
    const r = root.getBoundingClientRect()
    const out: Line[] = []
    for (const p of pairs) {
      const right = given[p.id]
      if (!right) continue
      const a = root.querySelector<HTMLElement>(`[data-port="L-${p.id}"]`)
      const idx = rights.findIndex((x) => norm(x) === norm(right))
      const b = idx >= 0 ? root.querySelector<HTMLElement>(`[data-port="R-${idx}"]`) : null
      if (!a || !b) continue
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect()
      out.push({ id: p.id, x1: ra.left + ra.width / 2 - r.left, y1: ra.top + ra.height / 2 - r.top, x2: rb.left + rb.width / 2 - r.left, y2: rb.top + rb.height / 2 - r.top, ok: okFor(p) })
    }
    setLines((prev) => (JSON.stringify(prev) === JSON.stringify(out) ? prev : out))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs, rights, answer, ref])
  useLayoutEffect(() => {
    measure()
  }, [measure, width, isGraded])

  const narrow = width > 0 && width < NARROW
  if (narrow) {
    return (
      <div ref={ref} className="grid gap-3">
        {pairs.map((p) => (
          <div key={p.id} className="grid gap-2 rounded-xl border border-border bg-raised p-3">
            <b className="text-sm">{p.left}</b>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('dashboard.classViewer.quiz.matching.pickFor', { left: p.left })}>
              {rights.map((r, i) => {
                const on = norm(given[p.id] ?? '') === norm(r)
                const st = !isGraded ? (on ? 'on' : 'off') : norm(r) === norm(p.right) ? 'ok' : on ? 'bad' : 'off'
                return (
                  <button
                    key={`${r}-${i}`}
                    type="button"
                    disabled={isGraded}
                    aria-pressed={on}
                    onClick={() => (on ? unassign(p.id) : assign(p.id, r))}
                    className={cn(
                      'rounded-full border px-2.5 py-1.5 text-[12.5px] transition-colors',
                      st === 'off' && 'border-foreground/20 text-muted-foreground',
                      st === 'on' && 'border-primary bg-primary/10 text-foreground',
                      st === 'ok' && 'border-success text-success',
                      st === 'bad' && 'border-terracotta text-terracotta',
                    )}
                  >
                    {r}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div ref={ref} className="relative grid grid-cols-[1fr_56px_1fr] items-stretch gap-y-2.5">
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        {lines.map((l) => (
          <path
            key={l.id}
            d={`M${l.x1} ${l.y1} C ${l.x1 + 40} ${l.y1}, ${l.x2 - 40} ${l.y2}, ${l.x2} ${l.y2}`}
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            stroke={isGraded ? (l.ok ? 'hsl(var(--success))' : 'hsl(var(--terracotta))') : 'hsl(var(--primary))'}
          />
        ))}
      </svg>
      <div className="grid content-start gap-2.5">
        {pairs.map((p, i) => {
          const linked = !!given[p.id]
          const st = isGraded ? (okFor(p) ? 'ok' : 'bad') : active === p.id ? 'active' : linked ? 'linked' : 'idle'
          return (
            <button
              key={p.id}
              type="button"
              disabled={isGraded}
              aria-pressed={active === p.id}
              onClick={() => setActive(active === p.id ? null : p.id)}
              className={cn(
                item,
                st === 'idle' && 'border-border hover:border-foreground/20',
                st === 'active' && 'border-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.18)]',
                st === 'linked' && 'border-primary/60',
                st === 'ok' && 'border-success bg-success/8',
                st === 'bad' && 'border-terracotta bg-terracotta/8',
              )}
            >
              <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md bg-foreground/7 font-heading text-[11px] font-extrabold text-muted-foreground">{i + 1}</span>
              {p.left}
              <span data-port={`L-${p.id}`} className={cn(port, '-right-1.5', st === 'idle' ? 'border-foreground/25' : st === 'ok' ? 'border-success bg-success' : st === 'bad' ? 'border-terracotta bg-terracotta' : 'border-primary bg-primary')} />
            </button>
          )
        })}
      </div>
      <div />
      <div className="grid content-start gap-2.5">
        {rights.map((r, i) => {
          const owner = ownerOf(r)
          const ownerOk = owner ? okFor(pairs.find((p) => p.id === owner)!) : false
          const st = isGraded ? (owner ? (ownerOk ? 'ok' : 'bad') : 'idle') : owner ? 'linked' : 'idle'
          return (
            <button
              key={`${r}-${i}`}
              type="button"
              disabled={isGraded || (!active && !owner)}
              aria-label={active ? t('dashboard.classViewer.quiz.matching.pickFor', { left: pairs.find((p) => p.id === active)?.left ?? '' }) + `: ${r}` : r}
              onClick={() => {
                if (active) assign(active, r)
                else if (owner) unassign(owner)
              }}
              className={cn(
                item,
                st === 'idle' && 'border-border enabled:hover:border-foreground/20',
                st === 'linked' && 'border-primary/60',
                st === 'ok' && 'border-success bg-success/8',
                st === 'bad' && 'border-terracotta bg-terracotta/8',
              )}
            >
              <span data-port={`R-${i}`} className={cn(port, '-left-1.5', st === 'idle' ? 'border-foreground/25' : st === 'ok' ? 'border-success bg-success' : st === 'bad' ? 'border-terracotta bg-terracotta' : 'border-primary bg-primary')} />
              {r}
            </button>
          )
        })}
      </div>
    </div>
  )
}
