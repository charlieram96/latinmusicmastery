'use client'

// Part done (L2): after a take, a big accuracy ring, a heading and how the
// take compares with the student's best, three stat tiles, and a full-width
// bar-by-bar strip built from the scorer's per-note judgements. Again and
// Continue live in the action bar.

import type { CSSProperties } from 'react'
import { Check, Clock, Eye, Flame, RotateCcw, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'
import type { AttemptStats } from '@/lib/play-sense/types'
import { summarizeTake, type BarResult } from '@/lib/play-sense/bar-results'
import { ActionMessage, LessonAction } from './lesson-mode/lesson-frame'
import './lesson-mode/lesson-mode.css'

const BASE = 'dashboard.classViewer.lessonMode.part'

export function PartDone({ stats, bars, previousBest, onAgain, onContinue, onWatchDemo, demo }: {
  stats: AttemptStats
  bars: BarResult[]
  /** Best accuracy from earlier saved takes, or null for a first take. */
  previousBest: number | null
  onAgain: () => void
  onContinue?: () => void
  onWatchDemo?: () => void
  demo: boolean
}) {
  const { t } = useTranslation()
  const graded = stats.perfectCount + stats.goodCount + stats.okCount + stats.missCount
  const accuracy = graded ? Math.max(0, Math.min(100, Math.round(stats.accuracy))) : 0
  const band = accuracy >= 90 ? 'great' : accuracy >= 75 ? 'good' : accuracy >= 50 ? 'ok' : 'low'
  const prev = previousBest == null ? null : Math.round(previousBest)
  const comparison = prev == null ? t(`${BASE}.first`)
    : accuracy > prev ? t(`${BASE}.better`, { prev }) : accuracy === prev ? t(`${BASE}.same`, { prev }) : t(`${BASE}.below`, { prev })
  const take = summarizeTake(bars)
  const seconds = Math.max(0, Math.round(stats.durationSeconds))
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

  return <div data-part-done className="lx-part-done">
    <div className="lx-pd-hero">
      <div data-accuracy-ring className="lx-bigring" role="img" aria-label={t(`${BASE}.accuracyLabel`, { value: accuracy })}>
        <svg viewBox="0 0 120 120" aria-hidden>
          <circle cx="60" cy="60" r="52" fill="none" strokeWidth="10" className="stroke-muted" />
          <circle cx="60" cy="60" r="52" fill="none" strokeWidth="10" strokeLinecap="round" pathLength={100}
            className="lx-bigring-fill stroke-primary" style={{ strokeDasharray: 100, strokeDashoffset: 100 - accuracy }} transform="rotate(-90 60 60)" />
        </svg>
        <div aria-hidden><b className="tabular-nums">{accuracy}%</b><span>{t(`${BASE}.accuracy`)}</span></div>
      </div>
      <div className="grid min-w-0 gap-1.5">
        <span className="lx-eyebrow">{t(`${BASE}.eyebrow`)}</span>
        <h2 className="lx-screen-h2 lx-pd-title">{t(`${BASE}.heading.${band}`)}</h2>
        <p className="text-muted-foreground">{comparison}</p>
        {demo && <p className="text-xs font-semibold text-muted-foreground">{t(`${BASE}.demo`)}</p>}
        <div className="lx-stat3">
          <div data-stat style={{ '--c': 'var(--success)' } as CSSProperties}><span>{t(`${BASE}.cleanBars`)}</span><b className="tabular-nums"><Check aria-hidden className="h-5 w-5" strokeWidth={3} />{take.clean}/{take.played}</b></div>
          <div data-stat style={{ '--c': 'var(--primary)' } as CSSProperties}><span>{t(`${BASE}.bestCombo`)}</span><b className="tabular-nums"><Flame aria-hidden className="h-5 w-5" />{stats.maxCombo}</b></div>
          <div data-stat style={{ '--c': 'var(--info)' } as CSSProperties}><span>{t(`${BASE}.time`)}</span><b className="tabular-nums"><Clock aria-hidden className="h-5 w-5" />{time}</b></div>
        </div>
      </div>
    </div>

    <section className="lx-bars" aria-labelledby="lx-bars-title">
      <div className="lx-pv-h"><span id="lx-bars-title" className="lx-eyebrow">{t(`${BASE}.barByBar`)}</span><span className="text-xs text-muted-foreground">{t(`${BASE}.barHint`)}</span></div>
      <ol className="lx-barrow" style={{ '--bars': Math.min(16, Math.max(1, bars.length)) } as CSSProperties}>
        {bars.map((bar, i) => <li key={bar.bar} data-bar-tile data-status={bar.status} className="lx-bar" style={{ animationDelay: `${i * 40}ms` }}
          aria-label={t(`${BASE}.barLabel`, { n: bar.bar, status: t(`${BASE}.legend.${bar.status}`) })}
          title={t(`${BASE}.barLabel`, { n: bar.bar, status: t(`${BASE}.legend.${bar.status}`) })}>
          <span className="tabular-nums" aria-hidden>{bar.bar}</span><i aria-hidden />
        </li>)}
      </ol>
      <div className="lx-legend">
        {(['clean', 'close', 'miss'] as const).map(status => <span key={status}><i data-status={status} />{t(`${BASE}.legend.${status}`)}</span>)}
        {take.missedBars.length > 0 && <span className="lx-legend-hint">
          {t(take.missedBars.length === 1 ? `${BASE}.practiceBar` : `${BASE}.practiceBars`, { bars: take.missedBars.join(', ') })}
        </span>}
      </div>
    </section>

    <LessonAction>
      <ActionMessage icon={<Trophy className="h-5 w-5" />} title={demo ? t(`${BASE}.demo`) : t(`${BASE}.saved`)} detail={t(`${BASE}.savedDetail`)} />
      {onWatchDemo && <Button type="button" variant="ghost" onClick={onWatchDemo} className="lx-hide-phone"><Eye className="h-4 w-4" />{t(`${BASE}.watch`)}</Button>}
      <Button type="button" variant="chunky-ghost" data-part-again="" onClick={onAgain}><RotateCcw className="h-4 w-4" />{t(`${BASE}.again`)}</Button>
      {onContinue && <Button type="button" variant="chunky" data-primary="" data-part-continue="" onClick={onContinue}>{t(`${BASE}.continue`)}</Button>}
    </LessonAction>
  </div>
}
