'use client'

import { useSyncExternalStore } from 'react'
import { Clock, Music2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/components/language-provider'
import { formatCents, noteLabel, verdictFor, type NoteNames } from '@/lib/tuner/note-math'

export interface LogEntry {
  id: number
  midi: number
  hz: number
  cents: number
  /** Epoch ms. */
  t: number
}

interface SessionCardProps {
  courses: number[][]
  done: Set<number>
  log: LogEntry[]
  names: NoteNames
  transpose: number
  tol: number
  onClear: () => void
}

const COLOR = { ok: 'text-success', warn: 'text-primary', bad: 'text-terracotta' } as const
const VISIBLE = 8
const CLOCK_MS = 15_000

// A ticking clock as an external store so "time ago" re-renders without
// calling Date.now() during render.
let clockNow = 0
const clockListeners = new Set<() => void>()
let clockTimer: ReturnType<typeof setInterval> | null = null
function subscribeClock(cb: () => void): () => void {
  clockListeners.add(cb)
  if (!clockTimer) {
    clockNow = Date.now()
    clockTimer = setInterval(() => {
      clockNow = Date.now()
      clockListeners.forEach((l) => l())
    }, CLOCK_MS)
  }
  return () => {
    clockListeners.delete(cb)
    if (clockListeners.size === 0 && clockTimer) {
      clearInterval(clockTimer)
      clockTimer = null
    }
  }
}

export function SessionCard({ courses, done, log, names, transpose, tol, onClear }: SessionCardProps) {
  const { t } = useTranslation()
  const now = useSyncExternalStore(subscribeClock, () => clockNow, () => 0)

  const ago = (at: number) => {
    const s = Math.round((now - at) / 1000)
    if (s < 5) return t('dashboard.pages.tuner.session.justNow')
    if (s < 60) return t('dashboard.pages.tuner.session.secondsAgo', { n: s })
    if (s < 3600) return t('dashboard.pages.tuner.session.minutesAgo', { n: Math.round(s / 60) })
    return t('dashboard.pages.tuner.session.hoursAgo', { n: Math.round(s / 3600) })
  }

  const total = courses.length
  const chromatic = total === 0
  const pct = chromatic ? 0 : (100 * done.size) / total

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-[18px]" aria-label={t('dashboard.pages.tuner.session.title')}>
      <h2 className="mb-3.5 flex items-center gap-2 font-heading text-[12px] font-bold uppercase tracking-[0.14em] text-gold">
        <Clock className="h-4 w-4" />
        {t('dashboard.pages.tuner.session.title')}
        {log.length > 0 && (
          <button type="button" onClick={onClear} className="ml-auto font-sans text-[11px] font-medium normal-case tracking-normal text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
            {t('dashboard.pages.tuner.session.clear')}
          </button>
        )}
      </h2>

      <div className="mb-2.5 flex items-center gap-2.5 text-xs text-muted-foreground">
        <span>
          {chromatic ? (
            t('dashboard.pages.tuner.session.notesLocked', { count: log.length })
          ) : (
            <>
              {t('dashboard.pages.tuner.session.progress', { done: done.size, total })}
              {done.size === total && ` · ${t('dashboard.pages.tuner.session.allSet')}`}
            </>
          )}
        </span>
        {!chromatic && (
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done.size}>
            <div className="h-full bg-success transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>

      {log.length === 0 ? (
        <div className="rounded-[9px] border border-dashed border-foreground/20 px-2.5 py-4 text-center text-xs text-muted-foreground">
          {t('dashboard.pages.tuner.session.empty')}
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {log.slice(0, VISIBLE).map((e) => (
            <li key={e.id} className="grid grid-cols-[28px_44px_1fr_auto_auto] items-center gap-2.5 rounded-[9px] border border-border bg-sunken px-2 py-1.5 text-xs tabular-nums">
              <span className="grid h-7 w-7 place-items-center rounded-[7px] bg-raised text-muted-foreground">
                <Music2 className="h-[13px] w-[13px]" />
              </span>
              <span className="font-heading text-[15px] font-bold">{noteLabel(e.midi + transpose, names)}</span>
              <span className="text-muted-foreground">{e.hz.toFixed(1)} Hz</span>
              <span className={cn('font-semibold', COLOR[verdictFor(e.cents, tol)])}>{formatCents(e.cents)}¢</span>
              <span className="min-w-[52px] text-right text-muted-foreground/70">{ago(e.t)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
