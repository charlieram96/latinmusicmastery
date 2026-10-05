'use client'

// Playback controls and the main take action share the same exercise session.

import { Pendulum } from '@/components/playsense-studio/player/transport/chronometer-control'
import type { ReactNode } from 'react'
import { Check, ChevronDown, Eye, Gauge, Pause, Play, RotateCcw, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import './lesson-mode/lesson-mode.css'

export interface LessonTransportProps {
  state: 'selecting' | 'countdown' | 'playing' | 'paused'
  bpm: number
  countdownBeat: number
  click: boolean
  mix?: ReactNode
  metronomeSettings?: ReactNode
  calibrationControl?: ReactNode
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onRestart: () => void
  onStop: () => void
  loading?: boolean
  onFinish: () => void
  onClickToggle: () => void
  onWatchDemo?: () => void
}

const BASE = 'dashboard.classViewer.lessonMode.transport'

export function LessonTransport({ state, bpm, countdownBeat, click, mix, metronomeSettings, calibrationControl, onStart, onPause, onResume, onRestart, onStop, loading = false, onFinish, onClickToggle, onWatchDemo }: LessonTransportProps) {
  const { t, locale } = useTranslation()
  const running = state === 'playing' || state === 'countdown'
  const inTake = state !== 'selecting'
  const iconBtn = 'grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground transition-colors duration-tap ease-smooth hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
  const pill = 'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-[13px] font-semibold tabular-nums'
  return <>
    <div role="group" aria-label={t(`${BASE}.label`)} className="lx-transport">
      <Button size="icon" type="button" disabled={loading || running}
        title={t(`${BASE}.play`)} aria-label={t(`${BASE}.play`)} onClick={state === 'paused' ? onResume : onStart}>
        <Play aria-hidden className="h-4 w-4" fill="currentColor" />
      </Button>
      <Button size="icon" type="button" variant="outline" disabled={state !== 'playing'}
        title={t(`${BASE}.pause`)} aria-label={t(`${BASE}.pause`)} onClick={onPause}>
        <Pause aria-hidden className="h-4 w-4" fill="currentColor" />
      </Button>
      <Button size="icon" type="button" variant="outline" disabled={!inTake}
        title={t(`${BASE}.stop`)} aria-label={t(`${BASE}.stop`)} onClick={onStop}>
        <Square aria-hidden className="h-3 w-3" fill="currentColor" />
      </Button>
      <Button size="icon" type="button" variant="outline" disabled={loading || !inTake}
        title={t(`${BASE}.restart`)} aria-label={t(`${BASE}.restart`)} onClick={onRestart}>
        <RotateCcw aria-hidden className="h-4 w-4" />
      </Button>
      {!metronomeSettings && <span className={pill}><Gauge aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
        {state === 'countdown' && countdownBeat > 0 ? t(`${BASE}.countIn`, { beat: countdownBeat }) : t(`${BASE}.bpm`, { bpm: Math.round(bpm) })}
      </span>}
      <span data-transport-extra className="lx-transport-extra">
        {metronomeSettings ? <>
          <button type="button" title={locale === 'es' ? 'Metrónomo' : 'Metronome'} aria-label={locale === 'es' ? 'Metrónomo' : 'Metronome'} aria-pressed={click} onClick={onClickToggle} className={cn(pill, 'hover:bg-muted', click ? 'border-primary/50 bg-primary/[0.12] text-primary' : 'text-muted-foreground')}><Pendulum size="sm" swingStyle={{}} active={click} /></button>
          <Popover>
          <PopoverTrigger asChild>
            <button type="button" aria-label={locale === 'es' ? 'Ajustes del metrónomo' : 'Metronome settings'} title={locale === 'es' ? 'Ajustes del metrónomo' : 'Metronome settings'} className={cn(pill, 'hover:bg-muted')}><ChevronDown aria-hidden className="h-3.5 w-3.5" /></button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="z-[220] w-56 rounded-xl p-3">{metronomeSettings}</PopoverContent>
        </Popover></> : <button type="button" title={t(`${BASE}.click`)} aria-pressed={click} aria-label={t(click ? `${BASE}.clickOn` : `${BASE}.clickOff`)} onClick={onClickToggle}
          className={cn(pill, 'transition-colors duration-tap ease-smooth hover:bg-muted', click ? 'border-primary/50 bg-primary/[0.12] text-primary' : 'text-muted-foreground')}>
          <Pendulum size="sm" swingStyle={{}} active={click} />
        </button>}
        {calibrationControl}
        {mix}
        {onWatchDemo && !running && <button type="button" className={iconBtn} aria-label={t(`${BASE}.watchDemo`)} title={t(`${BASE}.watchDemo`)} onClick={onWatchDemo}>
          <Eye className="h-4 w-4" />
        </button>}
      </span>
    </div>
    {inTake
      ? <Button type="button" variant="chunky-ghost" data-finish-take="" onClick={onFinish} disabled={state === 'countdown'} aria-label={t(`${BASE}.finish`)} title={t(`${BASE}.finish`)}><Check aria-hidden className="h-5 w-5" /></Button>
      : <Button type="button" variant="chunky-success" data-primary="" data-transport-start="" disabled={loading} onClick={onStart} aria-label={t(`${BASE}.start`)} title={t(`${BASE}.start`)}><Play aria-hidden className="h-5 w-5" /></Button>}
  </>
}
