'use client'

import { cn } from '@/lib/utils'
import { useTranslation } from '@/components/language-provider'
import { formatCents, midiToHz, verdictFor } from '@/lib/tuner/note-math'
import type { TunerFrame } from '@/lib/tuner/pitch-tracker'

interface ReadoutsProps {
  frame: TunerFrame | null
  a4: number
  tol: number
}

const COLOR = { ok: 'text-success', warn: 'text-primary', bad: 'text-terracotta' } as const

export function Readouts({ frame, a4, tol }: ReadoutsProps) {
  const { t } = useTranslation()
  const verdict = frame ? verdictFor(frame.cents, tol) : null
  const guidance = !frame
    ? ' '
    : verdict === 'ok'
      ? t(frame.locked ? 'dashboard.pages.tuner.readout.locked' : 'dashboard.pages.tuner.readout.hold')
      : t(frame.cents < 0 ? 'dashboard.pages.tuner.readout.tighten' : 'dashboard.pages.tuner.readout.loosen')

  return (
    <div className="mx-auto mt-3 grid w-full max-w-[560px] grid-cols-[1fr_auto_1fr] items-center gap-x-3 sm:gap-x-6 tabular-nums">
      <div className="text-center">
        <div className={cn('font-heading text-2xl font-semibold leading-none tracking-[-0.02em] sm:text-[30px]', verdict ? COLOR[verdict] : 'text-foreground')}>
          {frame ? formatCents(frame.cents) : '—'}
        </div>
        <div className="mt-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{t('dashboard.pages.tuner.readout.cents')}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{guidance}</div>
      </div>
      <div className="h-11 w-px bg-border" aria-hidden />
      <div className="text-center">
        <div className="font-heading text-2xl font-semibold leading-none tracking-[-0.02em] sm:text-[30px]">
          {frame ? frame.hz.toFixed(1) : '—'}
          <span className="ml-1 text-sm font-medium tracking-normal text-muted-foreground">Hz</span>
        </div>
        <div className="mt-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{t('dashboard.pages.tuner.readout.detected')}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {frame ? t('dashboard.pages.tuner.readout.target', { hz: midiToHz(frame.midi, a4).toFixed(2) }) : ' '}
        </div>
      </div>
    </div>
  )
}
