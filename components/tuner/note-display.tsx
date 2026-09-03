'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowDown, ArrowUp, AudioLines, CircleCheck, Music2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/components/language-provider'
import { noteLabel, noteParts, verdictFor, type NoteNames, type Verdict } from '@/lib/tuner/note-math'
import type { TunerFrame } from '@/lib/tuner/pitch-tracker'

interface NoteDisplayProps {
  frame: TunerFrame | null
  /** True while the microphone is listening. */
  active: boolean
  names: NoteNames
  transpose: number
  tol: number
  /** Notes of the manually selected course, or null in auto mode. */
  manualCourse: number[] | null
}

const PILL: Record<Verdict | 'idle', string> = {
  ok: 'border-success/35 bg-success/15 text-success',
  warn: 'border-primary/35 bg-primary/15 text-primary',
  bad: 'border-terracotta/40 bg-terracotta/15 text-terracotta',
  idle: 'border-border bg-raised text-muted-foreground',
}

export function NoteDisplay({ frame, active, names, transpose, tol, manualCourse }: NoteDisplayProps) {
  const { t } = useTranslation()
  const reduce = useReducedMotion()
  const shownMidi = frame ? frame.midi + transpose : null
  const parts = shownMidi != null ? noteParts(shownMidi, names) : null
  const verdict: Verdict | 'idle' = frame ? verdictFor(frame.cents, tol) : 'idle'

  const pillText = !frame
    ? active
      ? t('dashboard.pages.tuner.status.listening')
      : t('dashboard.pages.tuner.status.ready')
    : verdict === 'ok'
      ? t('dashboard.pages.tuner.status.inTune')
      : verdict === 'warn'
        ? t(frame.cents < 0 ? 'dashboard.pages.tuner.status.slightlyFlat' : 'dashboard.pages.tuner.status.slightlySharp')
        : t(frame.cents < 0 ? 'dashboard.pages.tuner.status.flat' : 'dashboard.pages.tuner.status.sharp')
  const PillIcon = !frame ? AudioLines : verdict === 'ok' ? CircleCheck : frame.cents < 0 ? ArrowDown : ArrowUp

  const written: string[] = []
  if (frame && transpose) written.push(t('dashboard.pages.tuner.written.sounds', { note: noteLabel(frame.midi, names) }))
  if (manualCourse) written.push(t('dashboard.pages.tuner.written.tuningTo', { notes: manualCourse.map((m) => noteLabel(m, names)).join(' · ') }))
  if (frame?.held) written.push(t('dashboard.pages.tuner.written.holding'))

  const glyphKey = parts ? `${shownMidi}-${names}` : 'idle'

  return (
    <div className="flex flex-col items-center text-center">
      <div
        className={cn(
          'flex h-[120px] items-start justify-center font-heading font-black leading-none tracking-[-0.04em] transition-colors duration-200 sm:h-[150px]',
          verdict === 'ok' ? 'text-success' : frame ? 'text-foreground' : 'text-muted-foreground/40'
        )}
        style={{ opacity: frame?.held ? 0.55 : 1 }}
        aria-hidden
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={glyphKey}
            initial={reduce ? false : { scale: 0.9, opacity: 0, y: 6 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={reduce ? undefined : { scale: 0.9, opacity: 0, y: -6 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className="flex items-start"
          >
            {parts ? (
              <>
                <span className="text-[108px] leading-[120px] sm:text-[140px] sm:leading-[150px]">{parts.base}</span>
                {parts.acc && <span className="mt-3 ml-0.5 text-[44px] font-bold leading-none sm:mt-[18px] sm:text-[56px]">{parts.acc}</span>}
                <span className="mt-[64px] ml-1.5 text-[34px] font-bold leading-none text-muted-foreground tabular-nums sm:mt-[82px] sm:text-[44px]">
                  {parts.oct}
                </span>
              </>
            ) : (
              <Music2 className="mt-4 h-[96px] w-[96px] opacity-60 sm:h-[110px] sm:w-[110px]" strokeWidth={1.5} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-1 h-4 text-xs text-muted-foreground tabular-nums">{written.join('  ·  ')}</div>

      <div
        className={cn(
          'mt-2 inline-flex h-[30px] items-center gap-1.5 rounded-full border px-3.5 text-[12px] font-semibold uppercase tracking-[0.08em] transition-colors',
          PILL[verdict]
        )}
      >
        <PillIcon className="h-3.5 w-3.5" />
        <span>{pillText}</span>
      </div>

      {/* Screen readers get one sentence per note change, not per frame. */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {parts ? `${noteLabel(shownMidi as number, names)}, ${pillText}` : pillText}
      </span>
    </div>
  )
}
