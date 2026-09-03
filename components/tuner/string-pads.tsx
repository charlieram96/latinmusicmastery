'use client'

import { Check, Music2, Play, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/components/language-provider'
import { useTunerFrame } from '@/hooks/use-tuner-engine'
import { AUTO_HIGHLIGHT_CENTS, courseTargetMidi, nearestCourse } from '@/lib/tuner/instruments'
import { centsBetween, midiToHz, noteLabel, noteParts, type NoteNames } from '@/lib/tuner/note-math'
import type { TunerStore } from '@/lib/tuner/tuner-store'

interface StringPadsProps {
  courses: number[][]
  tuningName: string
  auto: boolean
  manual: number | null
  onSelect: (course: number | null) => void
  done: Set<number>
  store: TunerStore
  a4: number
  tol: number
  names: NoteNames
  onPlay: (course: number) => void
  playingCourse: number | null
}

export function StringPads({ courses, tuningName, auto, manual, onSelect, done, store, a4, tol, names, onPlay, playingCourse }: StringPadsProps) {
  const { t } = useTranslation()
  const { frame } = useTunerFrame(store)

  if (courses.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-[11px] border border-dashed border-foreground/20 px-3.5 py-3 text-[13px] text-muted-foreground">
        <Music2 className="h-4 w-4 shrink-0 text-gold" />
        {t('dashboard.pages.tuner.strings.chromaticHint')}
      </div>
    )
  }

  let near = auto ? (frame ? nearestCourse(courses, frame.hz, a4) : -1) : manual ?? -1
  if (auto && frame && near >= 0) {
    const dev = centsBetween(frame.hz, midiToHz(courseTargetMidi(courses[near], frame.hz, a4), a4))
    if (Math.abs(dev) > AUTO_HIGHLIGHT_CENTS) near = -1
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
        <span>{t('dashboard.pages.tuner.strings.title')}</span>
        <b className="font-semibold text-foreground">{tuningName}</b>
        <div className="ml-auto inline-flex gap-0.5 rounded-[7px] border border-border p-0.5" role="group">
          <button
            type="button"
            aria-pressed={auto}
            onClick={() => onSelect(null)}
            className={cn('rounded-[5px] px-2.5 py-[3px] text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50', auto ? 'bg-raised text-foreground' : 'hover:text-foreground')}
          >
            {t('dashboard.pages.tuner.strings.auto')}
          </button>
          <button
            type="button"
            aria-pressed={!auto}
            onClick={() => onSelect(manual ?? 0)}
            className={cn('rounded-[5px] px-2.5 py-[3px] text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50', !auto ? 'bg-raised text-foreground' : 'hover:text-foreground')}
          >
            {t('dashboard.pages.tuner.strings.manual')}
          </button>
        </div>
      </div>

      <div className="grid auto-cols-fr grid-flow-col gap-2">
        {courses.map((course, i) => {
          const parts = noteParts(course[0], names)
          const labels = course.map((m) => noteLabel(m, names))
          const isNear = i === near && !!frame
          const isTarget = !auto && i === manual
          const isDone = done.has(i)
          const isPlaying = playingCourse === i
          let deviation = isDone ? t('dashboard.pages.tuner.strings.done') : ''
          if (isNear && frame) {
            const dev = centsBetween(frame.hz, midiToHz(courseTargetMidi(course, frame.hz, a4), a4))
            deviation = Math.abs(dev) <= tol ? t('dashboard.pages.tuner.strings.inTune') : `${dev < 0 ? '♭' : '♯'} ${Math.abs(Math.round(dev))}¢`
          }
          return (
            <div
              key={i}
              className={cn(
                'group relative flex min-h-[66px] flex-col items-center justify-center gap-[3px] rounded-[11px] border px-1 py-2 text-muted-foreground transition-all duration-150',
                isDone ? 'border-success/45 bg-success/15' : isNear ? '-translate-y-0.5 border-primary bg-primary/10' : 'border-border bg-raised',
                isTarget && 'border-gold shadow-[inset_0_0_0_1px_hsl(var(--gold-highlight))]'
              )}
            >
              <button
                type="button"
                aria-label={t('dashboard.pages.tuner.strings.select', { n: i + 1, notes: labels.join(' ') })}
                aria-pressed={isTarget}
                onClick={() => onSelect(isTarget ? null : i)}
                className="absolute inset-0 rounded-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              />
              {isDone && <Check className="pointer-events-none absolute left-1.5 top-1.5 h-3.5 w-3.5 text-success" strokeWidth={3} />}
              <button
                type="button"
                aria-label={t('dashboard.pages.tuner.strings.play', { note: labels[0] })}
                onClick={(e) => {
                  e.stopPropagation()
                  onPlay(i)
                }}
                className={cn(
                  'absolute right-1 top-1 z-10 grid h-6 w-6 place-items-center rounded-md text-muted-foreground/70 transition-opacity hover:bg-gold/15 hover:text-gold focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  isPlaying ? 'text-gold opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100'
                )}
              >
                {isPlaying ? <Square className="h-3 w-3" fill="currentColor" /> : <Play className="h-3 w-3" fill="currentColor" />}
              </button>
              <span className={cn('pointer-events-none font-heading text-[19px] font-bold leading-none tracking-[-0.02em]', isDone ? 'text-success' : 'text-foreground')}>
                {parts.base}
                {parts.acc}
                {course.length === 1 && <small className="ml-px text-[11px] font-semibold text-muted-foreground tabular-nums">{parts.oct}</small>}
              </span>
              {course.length > 1 && <span className="pointer-events-none text-[10px] tracking-[0.02em] text-muted-foreground tabular-nums">{labels.join(' · ')}</span>}
              <span className={cn('pointer-events-none h-[13px] text-[11px] tabular-nums', isDone ? 'text-success' : isNear ? 'text-primary' : '')}>{deviation}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
