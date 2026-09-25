'use client'

// The play transport in the lesson action bar: pause / resume, the tempo, and
// (wider screens) start over, the click, the backing-track mix and the demo;
// Finish take ends the attempt and grades it. Before a take, Start playing is
// the bar's main action.

import type { ReactNode } from 'react'
import { Eye, Gauge, Pause, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import './lesson-mode/lesson-mode.css'

export interface LessonTransportProps {
  state: 'selecting' | 'countdown' | 'playing' | 'paused'
  bpm: number
  countdownBeat: number
  click: boolean
  mix?: ReactNode
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onRestart: () => void
  onFinish: () => void
  onClickToggle: () => void
  onWatchDemo?: () => void
}

const BASE = 'dashboard.classViewer.lessonMode.transport'

export function LessonTransport({ state, bpm, countdownBeat, click, mix, onStart, onPause, onResume, onRestart, onFinish, onClickToggle, onWatchDemo }: LessonTransportProps) {
  const { t } = useTranslation()
  const running = state === 'playing' || state === 'countdown'
  const inTake = state !== 'selecting'
  const iconBtn = 'grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground transition-colors duration-tap ease-smooth hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
  const pill = 'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-[13px] font-semibold tabular-nums'
  return <>
    <div role="group" aria-label={t(`${BASE}.label`)} className="lx-transport">
      {inTake && <button type="button" className={iconBtn} disabled={state === 'countdown'}
        aria-label={t(running ? `${BASE}.pause` : `${BASE}.resume`)} onClick={running ? onPause : onResume}>
        {running ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="ml-0.5 h-4 w-4" fill="currentColor" />}
      </button>}
      <span className={pill}><Gauge aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
        {state === 'countdown' && countdownBeat > 0 ? t(`${BASE}.countIn`, { beat: countdownBeat }) : t(`${BASE}.bpm`, { bpm: Math.round(bpm) })}
      </span>
      <span data-transport-extra className="lx-transport-extra">
        {inTake && <button type="button" className={iconBtn} aria-label={t(`${BASE}.restart`)} title={t(`${BASE}.restart`)} onClick={onRestart}>
          <RotateCcw className="h-4 w-4" />
        </button>}
        <button type="button" aria-pressed={click} aria-label={t(click ? `${BASE}.clickOn` : `${BASE}.clickOff`)} onClick={onClickToggle}
          className={cn(pill, 'transition-colors duration-tap ease-smooth hover:bg-muted', click && 'border-primary/50 bg-primary/[0.12] text-primary')}>
          <span aria-hidden className={cn('h-2 w-2 rounded-full', click ? 'bg-primary' : 'bg-muted-foreground/40')} />{t(`${BASE}.click`)}
        </button>
        {mix}
        {onWatchDemo && !running && <button type="button" className={iconBtn} aria-label={t(`${BASE}.watchDemo`)} title={t(`${BASE}.watchDemo`)} onClick={onWatchDemo}>
          <Eye className="h-4 w-4" />
        </button>}
      </span>
    </div>
    {inTake
      ? <Button type="button" variant="chunky-ghost" data-finish-take="" onClick={onFinish} disabled={state === 'countdown'}>{t(`${BASE}.finish`)}</Button>
      : <Button type="button" variant="chunky-success" data-primary="" data-transport-start="" onClick={onStart}>{t(`${BASE}.start`)}</Button>}
  </>
}
