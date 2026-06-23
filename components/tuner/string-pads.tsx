'use client'

import { Check, Piano } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/components/language-provider'
import {
  INSTRUMENT_STRINGS,
  centsBetween,
  nearestStringIndex,
  noteNameToFrequency,
  type TunerInstrument,
} from '@/lib/tuner/tuner-utils'

interface StringPadsProps {
  instrument: TunerInstrument
  frequency: number | null
  isListening: boolean
  referencePitch: number
}

const LOCK_CENTS = 5

export function StringPads({ instrument, frequency, isListening, referencePitch }: StringPadsProps) {
  const { t } = useTranslation()
  const strings = INSTRUMENT_STRINGS[instrument]

  // Chromatic instruments (piano) have no fixed strings.
  if (!strings) {
    return (
      <div className="flex items-center justify-center gap-2.5 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        <Piano className="h-4 w-4 shrink-0" />
        {t('dashboard.pages.tuner.chromaticHint')}
      </div>
    )
  }

  const active = isListening ? nearestStringIndex(frequency, strings, referencePitch) : -1

  return (
    <div>
      <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
        {t('dashboard.pages.tuner.openStrings')}
      </div>
      <div className="flex flex-wrap gap-2">
        {strings.map((name, i) => {
          const isActive = i === active && frequency !== null
          const dev = isActive ? centsBetween(frequency!, noteNameToFrequency(name, referencePitch)) : null
          const locked = dev !== null && Math.abs(dev) < LOCK_CENTS
          const noteName = name.slice(0, -1)
          const oct = name.slice(-1)

          return (
            <div
              key={`${name}-${i}`}
              className={cn(
                'relative flex h-16 flex-1 min-w-[3.25rem] flex-col items-center justify-center rounded-xl border font-mono transition-all duration-150',
                locked
                  ? 'border-green-500/50 bg-green-500/15 text-green-400 shadow-[0_0_18px_-4px_rgba(74,222,128,0.5)]'
                  : isActive
                    ? 'border-primary bg-primary/10 text-primary scale-[1.04]'
                    : 'border-border bg-card/60 text-muted-foreground'
              )}
            >
              <span className="text-lg font-semibold leading-none">
                {noteName}
                <span className="text-xs text-muted-foreground">{oct}</span>
              </span>
              {isActive && !locked && dev !== null ? (
                <span className="mt-1 text-[10px] tabular-nums">
                  {dev > 0 ? '♯' : '♭'} {Math.abs(Math.round(dev))}
                </span>
              ) : locked ? (
                <Check className="mt-1 h-3.5 w-3.5" />
              ) : (
                <span className="mt-1 h-3.5" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
