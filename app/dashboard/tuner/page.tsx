'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AudioLines } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { useTunerPrefs } from '@/hooks/use-tuner-prefs'
import { useTunerEngine } from '@/hooks/use-tuner-engine'
import { useReferenceTone } from '@/hooks/use-reference-tone'
import { courseMidis, getInstrument, getTuning, nearestCourse, type InstrumentId } from '@/lib/tuner/instruments'
import { midiToHz } from '@/lib/tuner/note-math'
import type { TunerFrame } from '@/lib/tuner/pitch-tracker'
import { InstrumentChips } from '@/components/tuner/instrument-chips'
import { TuningSelect } from '@/components/tuner/tuning-select'
import { NoteDisplay } from '@/components/tuner/note-display'
import { TuningMeter } from '@/components/tuner/tuning-meter'
import { Readouts } from '@/components/tuner/readouts'
import { ListenButton } from '@/components/tuner/listen-button'
import { InputPanel } from '@/components/tuner/input-panel'
import { StringPads } from '@/components/tuner/string-pads'
import { ReferenceToneCard } from '@/components/tuner/reference-tone-card'
import { SessionCard, type LogEntry } from '@/components/tuner/session-card'
import { TunerSettingsPopover } from '@/components/tuner/tuner-settings-popover'
import { TunerTips } from '@/components/tuner/tuner-tips'

const MAX_LOG = 12
const PAD_TONE_MS = 3000
const A4_MIN = 415
const A4_MAX = 466

export default function TunerPage() {
  const { t } = useTranslation()
  const [prefs, setPrefs] = useTunerPrefs()
  const instrument = getInstrument(prefs.instrument)
  const tuning = getTuning(instrument, prefs.tuning)
  const courses = useMemo(() => courseMidis(tuning), [tuning])

  /** Manually targeted course index, or null for auto. */
  const [manual, setManual] = useState<number | null>(null)
  const [done, setDone] = useState<Set<number>>(() => new Set())
  const [log, setLog] = useState<LogEntry[]>([])
  const [refNote, setRefNote] = useState({ pc: 9, oct: 4 })
  const [playingCourse, setPlayingCourse] = useState<number | null>(null)
  const padTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logIdRef = useRef(0)

  const manualCourse = manual != null ? (courses[manual] ?? null) : null

  const onFrame = useCallback(
    (frame: TunerFrame) => {
      if (!frame.justLocked) return
      const idx = manual != null ? manual : nearestCourse(courses, frame.hz, prefs.a4)
      if (idx >= 0 && courses[idx]?.includes(frame.midi)) {
        setDone((prev) => {
          if (prev.has(idx)) return prev
          const next = new Set(prev)
          next.add(idx)
          return next
        })
      }
      logIdRef.current += 1
      const entry: LogEntry = { id: logIdRef.current, midi: frame.midi, hz: frame.hz, cents: frame.cents, t: Date.now() }
      setLog((prev) => [entry, ...prev].slice(0, MAX_LOG))
    },
    [courses, manual, prefs.a4]
  )

  const engine = useTunerEngine({
    a4: prefs.a4,
    holdMs: prefs.holdSec * 1000,
    tolCents: prefs.tolerance,
    sensitivity: prefs.sensitivity,
    targetCourse: manualCourse,
    onFrame,
  })
  const tone = useReferenceTone(engine.getAudioContext)
  const refPlaying = tone.playing && playingCourse == null
  const refMidi = (refNote.oct + 1) * 12 + refNote.pc

  const stopPadTone = useCallback(() => {
    if (padTimerRef.current) {
      clearTimeout(padTimerRef.current)
      padTimerRef.current = null
    }
    if (playingCourse != null) {
      setPlayingCourse(null)
      tone.stop()
    }
  }, [playingCourse, tone])

  const toggleListening = useCallback(() => {
    if (engine.status === 'listening') {
      stopPadTone()
      if (tone.playing) tone.stop()
      engine.stop()
    } else if (engine.status !== 'starting') {
      void engine.start(engine.deviceId ?? undefined)
    }
  }, [engine, stopPadTone, tone])

  const resetTargets = useCallback(() => {
    setManual(null)
    setDone(new Set())
    engine.resetTracker()
  }, [engine])

  const selectInstrument = (id: InstrumentId) => {
    setPrefs({ instrument: id, tuning: getInstrument(id).tunings[0].id })
    resetTargets()
  }
  const selectTuning = (id: string) => {
    setPrefs({ tuning: id })
    resetTargets()
  }
  const selectCourse = useCallback(
    (i: number | null) => {
      setManual(i)
      engine.resetTracker()
    },
    [engine]
  )

  const setA4 = useCallback(
    (value: number) => {
      const a4 = Math.max(A4_MIN, Math.min(A4_MAX, value))
      setPrefs({ a4 })
      if (refPlaying) tone.play(midiToHz(refMidi, a4))
    },
    [refMidi, refPlaying, setPrefs, tone]
  )

  const toggleRefTone = () => {
    stopPadTone()
    if (refPlaying) tone.stop()
    else tone.play(midiToHz(refMidi, prefs.a4))
  }
  const changeRefNote = (pc: number, oct: number) => {
    setRefNote({ pc, oct })
    if (refPlaying) tone.play(midiToHz((oct + 1) * 12 + pc, prefs.a4))
  }
  const playCourse = (i: number) => {
    if (playingCourse === i) {
      stopPadTone()
      return
    }
    if (padTimerRef.current) clearTimeout(padTimerRef.current)
    setPlayingCourse(i)
    tone.play(midiToHz(courses[i][0], prefs.a4))
    padTimerRef.current = setTimeout(() => {
      padTimerRef.current = null
      setPlayingCourse(null)
      tone.stop()
    }, PAD_TONE_MS)
  }

  // Keyboard: Space start/stop, ↑↓ A4, ←→ manual string.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(el.tagName) || el.isContentEditable)) return
      if (e.code === 'Space') {
        e.preventDefault()
        toggleListening()
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setA4(prefs.a4 + 1)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setA4(prefs.a4 - 1)
      } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && courses.length > 0) {
        e.preventDefault()
        const n = courses.length
        const cur = manual ?? (e.key === 'ArrowRight' ? -1 : 0)
        selectCourse((cur + (e.key === 'ArrowRight' ? 1 : n - 1)) % n)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [courses.length, manual, prefs.a4, selectCourse, setA4, toggleListening])

  // Clear a pending pad-tone timer on unmount.
  useEffect(() => {
    return () => {
      if (padTimerRef.current) clearTimeout(padTimerRef.current)
    }
  }, [])

  return (
    <div className="flex flex-col gap-4 pb-6 lg:gap-[18px]">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">{t('dashboard.pages.tuner.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('dashboard.pages.tuner.subtitle')}</p>
        </div>
        <div className="ml-auto hidden text-xs text-muted-foreground lg:block">
          {t('dashboard.pages.tuner.keys.space')} · {t('dashboard.pages.tuner.keys.arrows')}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-[18px]">
        <section className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-5" aria-label={t('dashboard.pages.tuner.brand')}>
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-40 -right-32 h-[420px] w-[420px] rounded-full bg-[radial-gradient(closest-side,hsl(var(--gold-highlight)/0.10),transparent_70%)]"
          />

          <div className="relative flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 font-heading text-[12px] font-bold uppercase tracking-[0.14em] text-gold">
              <AudioLines className="h-[18px] w-[18px]" />
              {t('dashboard.pages.tuner.brand')}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <TuningSelect instrument={instrument} value={tuning.id} onChange={selectTuning} />
              <TunerSettingsPopover prefs={prefs} onChange={setPrefs} />
            </div>
            <InstrumentChips value={instrument.id} onChange={selectInstrument} />
          </div>

          <div className="relative flex flex-col items-center gap-1.5 pt-1.5">
            <NoteDisplay
              store={engine.store}
              active={engine.status === 'listening'}
              names={prefs.names}
              transpose={prefs.transpose}
              tol={prefs.tolerance}
              manualCourse={manualCourse}
            />
            <TuningMeter store={engine.store} mode={prefs.meter} tol={prefs.tolerance} onModeChange={(meter) => setPrefs({ meter })} />
            <Readouts store={engine.store} a4={prefs.a4} tol={prefs.tolerance} />
            <ListenButton status={engine.status} onToggle={toggleListening} />
          </div>

          <div className="relative mt-auto">
            <InputPanel
              status={engine.status}
              errorKind={engine.errorKind}
              devices={engine.devices}
              deviceId={engine.deviceId}
              deviceLabel={engine.deviceLabel}
              onDeviceChange={engine.setDevice}
              onRetry={() => void engine.start(engine.deviceId ?? undefined)}
              store={engine.store}
            />
          </div>

          <div className="relative">
            <StringPads
              courses={courses}
              tuningName={t(`dashboard.pages.tuner.tunings.${tuning.nameKey}`)}
              auto={manual == null}
              manual={manual}
              onSelect={selectCourse}
              done={done}
              store={engine.store}
              a4={prefs.a4}
              tol={prefs.tolerance}
              names={prefs.names}
              onPlay={playCourse}
              playingCourse={playingCourse}
            />
          </div>
        </section>

        <div className="flex flex-col gap-4 lg:gap-[18px]">
          <ReferenceToneCard
            a4={prefs.a4}
            onA4Change={setA4}
            names={prefs.names}
            refPc={refNote.pc}
            refOct={refNote.oct}
            onRefChange={changeRefNote}
            playing={refPlaying}
            onToggle={toggleRefTone}
          />
          <SessionCard
            courses={courses}
            done={done}
            log={log}
            names={prefs.names}
            transpose={prefs.transpose}
            tol={prefs.tolerance}
            onClear={() => {
              setLog([])
              setDone(new Set())
            }}
          />
        </div>
      </div>

      <TunerTips />
    </div>
  )
}
