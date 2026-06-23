'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Check, ArrowDown, ArrowUp, AudioLines, Music2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/components/language-provider'
import { noteNameToFrequency, verdictForCents, type TuneVerdict } from '@/lib/tuner/tuner-utils'

interface NoteReadoutProps {
  note: string | null
  octave: number | null
  frequency: number | null
  cents: number | null
  isListening: boolean
  referencePitch: number
}

const VERDICT_STYLE: Record<TuneVerdict, { text: string; chip: string; icon: typeof Check }> = {
  'in-tune': { text: 'text-green-400', chip: 'bg-green-500/15 text-green-400 border-green-500/30', icon: Check },
  'slightly-flat': { text: 'text-amber-400', chip: 'bg-amber-500/10 text-amber-400 border-amber-500/30', icon: ArrowDown },
  'slightly-sharp': { text: 'text-amber-400', chip: 'bg-amber-500/10 text-amber-400 border-amber-500/30', icon: ArrowUp },
  flat: { text: 'text-terracotta', chip: 'bg-terracotta/10 text-terracotta border-terracotta/35', icon: ArrowDown },
  sharp: { text: 'text-terracotta', chip: 'bg-terracotta/10 text-terracotta border-terracotta/35', icon: ArrowUp },
}

const VERDICT_KEY: Record<TuneVerdict, string> = {
  'in-tune': 'inTune',
  'slightly-flat': 'slightlyFlat',
  'slightly-sharp': 'slightlySharp',
  flat: 'flat',
  sharp: 'sharp',
}

export function NoteReadout({ note, octave, frequency, cents, isListening, referencePitch }: NoteReadoutProps) {
  const { t } = useTranslation()
  const verdict = isListening ? verdictForCents(cents) : null
  const hasNote = isListening && note !== null && octave !== null

  const target = hasNote ? noteNameToFrequency(`${note}${octave}`, referencePitch) : null
  const style = verdict ? VERDICT_STYLE[verdict] : null
  const StatusIcon = style?.icon ?? AudioLines

  return (
    <div className="flex flex-col items-center text-center">
      {/* Note glyph */}
      <div className="flex items-start justify-center leading-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={hasNote ? `${note}${octave}` : 'empty'}
            initial={{ scale: 0.85, opacity: 0, y: 6 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: -6 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className={cn(
              'font-heading font-black tracking-tight tabular-nums transition-colors',
              hasNote && style ? style.text : 'text-muted-foreground/40'
            )}
          >
            {hasNote ? (
              <span className="flex items-start">
                <span className="text-[5.5rem] leading-[0.85] sm:text-[7rem]">{note}</span>
                <span className="mt-2 text-3xl text-muted-foreground sm:text-4xl">{octave}</span>
              </span>
            ) : (
              <span className="flex h-[5.5rem] items-center justify-center sm:h-[7rem]">
                <Music2 className="h-16 w-16 opacity-30 sm:h-20 sm:w-20" strokeWidth={1.5} />
              </span>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Frequency + target */}
      <div className="mt-3 flex items-center gap-4 font-mono text-sm tabular-nums">
        <span className={cn('text-base', hasNote ? 'text-foreground' : 'text-muted-foreground')}>
          {frequency !== null ? `${frequency.toFixed(1)}` : '—'}
          <span className="ml-1 text-xs text-muted-foreground">Hz</span>
        </span>
        {target !== null && (
          <span className="text-muted-foreground">
            {t('dashboard.pages.tuner.target')} {target.toFixed(2)} Hz
          </span>
        )}
      </div>

      {/* Status pill */}
      <div
        className={cn(
          'mt-4 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
          style ? style.chip : 'border-border bg-muted/40 text-muted-foreground'
        )}
      >
        <StatusIcon className="h-4 w-4" />
        {verdict
          ? t(`dashboard.pages.tuner.status.${VERDICT_KEY[verdict]}`)
          : isListening
            ? t('dashboard.pages.tuner.status.waiting')
            : t('dashboard.pages.tuner.status.idle')}
        {verdict && cents !== null && verdict !== 'in-tune' && (
          <span className="font-mono tabular-nums">
            {cents > 0 ? '+' : ''}
            {Math.round(cents)}
          </span>
        )}
      </div>
    </div>
  )
}
