'use client'

import { Minus, Play, Plus, Square, Volume2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/components/language-provider'
import { LETTERS, SOLFEGE, noteLabel, type NoteNames } from '@/lib/tuner/note-math'

const A4_MIN = 415
const A4_MAX = 466
const PRESETS = [432, 440, 442, 444]
const OCTAVES = [2, 3, 4, 5]
const BLACK = new Set([1, 3, 6, 8, 10])

interface ReferenceToneCardProps {
  a4: number
  onA4Change: (a4: number) => void
  names: NoteNames
  refPc: number
  refOct: number
  onRefChange: (pc: number, oct: number) => void
  playing: boolean
  onToggle: () => void
}

export function ReferenceToneCard({ a4, onA4Change, names, refPc, refOct, onRefChange, playing, onToggle }: ReferenceToneCardProps) {
  const { t } = useTranslation()
  const refMidi = (refOct + 1) * 12 + refPc
  const refName = noteLabel(refMidi, names)
  const clampA4 = (v: number) => onA4Change(Math.max(A4_MIN, Math.min(A4_MAX, v)))
  const stepClass =
    'grid h-10 place-items-center rounded-[9px] border border-border bg-raised text-foreground transition-colors hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-[18px]" aria-label={t('dashboard.pages.tuner.reference.title')}>
      <h2 className="mb-3.5 flex items-center gap-2 font-heading text-[12px] font-bold uppercase tracking-[0.14em] text-gold">
        <Volume2 className="h-4 w-4" />
        {t('dashboard.pages.tuner.reference.title')}
      </h2>

      <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2">
        <button type="button" className={stepClass} onClick={() => clampA4(a4 - 1)} aria-label={t('dashboard.pages.tuner.reference.lower')}>
          <Minus className="h-4 w-4" />
        </button>
        <div className="text-center">
          <div className="text-[11px] text-muted-foreground">{t('dashboard.pages.tuner.reference.a4')}</div>
          <div className="font-heading text-[26px] font-bold leading-[1.1] tracking-[-0.02em] tabular-nums">
            {a4} <small className="text-[13px] font-semibold text-muted-foreground">Hz</small>
          </div>
        </div>
        <button type="button" className={stepClass} onClick={() => clampA4(a4 + 1)} aria-label={t('dashboard.pages.tuner.reference.raise')}>
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2.5 flex gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onA4Change(p)}
            aria-pressed={a4 === p}
            className={cn(
              'h-[26px] flex-1 rounded-[7px] border text-[11px] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              a4 === p ? 'border-gold text-gold' : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="my-3.5 h-px bg-border" />

      <button
        type="button"
        onClick={onToggle}
        aria-pressed={playing}
        className={cn(
          'flex h-[42px] w-full items-center justify-center gap-2 rounded-[10px] border border-gold font-heading text-[12px] font-bold uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          playing ? 'bg-gold text-[#1C1405]' : 'text-gold hover:bg-gold/10'
        )}
      >
        {playing ? <Square className="h-3.5 w-3.5" fill="currentColor" /> : <Play className="h-3.5 w-3.5" fill="currentColor" />}
        {t(playing ? 'dashboard.pages.tuner.reference.stop' : 'dashboard.pages.tuner.reference.play', { note: refName })}
      </button>

      <div className="mt-3 grid grid-cols-12 gap-[3px]" role="group" aria-label={t('dashboard.pages.tuner.reference.note')}>
        {LETTERS.map((_, pc) => (
          <button
            key={pc}
            type="button"
            aria-pressed={pc === refPc}
            aria-label={noteLabel((refOct + 1) * 12 + pc, names)}
            onClick={() => onRefChange(pc, refOct)}
            className={cn(
              'h-[34px] rounded-md border text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              pc === refPc
                ? 'border-gold bg-gold text-[#1C1405]'
                : BLACK.has(pc)
                  ? 'border-border bg-sunken text-muted-foreground hover:text-foreground'
                  : 'border-border bg-raised text-foreground'
            )}
          >
            {(names === 'solfege' ? SOLFEGE : LETTERS)[pc]}
          </button>
        ))}
      </div>

      <div className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>{t('dashboard.pages.tuner.reference.octave')}</span>
        <div className="ml-auto flex gap-1" role="group" aria-label={t('dashboard.pages.tuner.reference.octave')}>
          {OCTAVES.map((o) => (
            <button
              key={o}
              type="button"
              aria-pressed={o === refOct}
              onClick={() => onRefChange(refPc, o)}
              className={cn(
                'h-7 w-[34px] rounded-[7px] border text-xs tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                o === refOct ? 'border-gold text-gold' : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              {o}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t('dashboard.pages.tuner.reference.help')}</p>
    </section>
  )
}
