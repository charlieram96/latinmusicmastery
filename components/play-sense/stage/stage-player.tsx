'use client'

import './stage.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  Bluetooth,
  ChevronRight,
  Headphones,
  Loader2,
  Mic,
  Music2,
  Square,
  Piano,
  Pin,
  Play,
  Settings2,
  SkipBack,
  SkipForward,
  Sliders,
  Speaker,
  Target,
  Volume2,
} from 'lucide-react'
import type { ExerciseDefinition, HitGrade } from '@/lib/play-sense/types'
import { GRADE_COLORS } from '@/lib/play-sense/types'
import { useStageTheme } from '../stage-highway/use-stage-theme'
import { useExerciseSession } from '@/hooks/use-exercise-session'
import { useStageDemoSession } from '@/hooks/use-stage-demo-session'
import { getExerciseDuration, getInstrumentLabel } from '@/lib/play-sense/exercise-utils'
import { GRADE_LABELS } from '@/lib/play-sense/animations'
import { nextInputMode } from '@/lib/play-sense/input-modes'
import { saveAttempt } from '@/app/actions/play-sense'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { StageHighway as GlassHighway } from '../stage-highway/StageHighway'
import { AudioModePrompt } from '../audio-mode-prompt'
import { PlaysenseTestPanel } from '../playsense-test-panel'
import { CalibrationWizard } from '../calibration-wizard'
import { PerformanceResultsDialog } from '../performance-results'
import { PerformanceHud } from '../performance-hud'
import { formatTime } from './stage-ui'

interface StagePlayerProps {
  exercises: ExerciseDefinition[]
  preview?: boolean
}

type SidebarMode = 'Icon rail' | 'Hidden' | 'Stays open'

interface StageSettings {
  sidebar: SidebarMode
  dimChrome: boolean
  callouts: boolean
  comboFlare: boolean
  laneGuide: boolean
}

const DEFAULT_SETTINGS: StageSettings = {
  sidebar: 'Icon rail',
  dimChrome: true,
  callouts: true,
  comboFlare: true,
  laneGuide: false,
}

export function StagePlayer({ exercises, preview = false }: StagePlayerProps) {
  const router = useRouter()
  const [stageTheme] = useStageTheme()
  const allExercises = useMemo(() => exercises, [exercises])
  const liveSession = useExerciseSession()
  const demoSession = useStageDemoSession(exercises, preview)
  const session = preview ? { ...liveSession, ...demoSession.overrides } : liveSession
  const [settings, setSettings] = useState<StageSettings>(DEFAULT_SETTINGS)
  const setSetting = <K extends keyof StageSettings>(k: K, v: StageSettings[K]) =>
    setSettings((s) => ({ ...s, [k]: v }))

  // ── collapsible panel state ──
  const [pinned, setPinned] = useState(false)
  const [railHover, setRailHover] = useState(false)
  const mode = settings.sidebar === 'Hidden' ? 'hidden' : settings.sidebar === 'Stays open' ? 'off' : 'rail'

  // ── floating call-outs ──
  const [callouts, setCallouts] = useState<Array<{ id: number; grade: string; x: number }>>([])
  const calloutId = useRef(0)
  const prevEventCount = useRef(0)

  const isPlaying = session.sessionState === 'playing'
  const isActive =
    session.sessionState === 'selecting' ||
    session.sessionState === 'countdown' ||
    session.sessionState === 'playing'

  const exercise = session.exercise
  const activeIndex = exercise ? allExercises.findIndex((e) => e.id === exercise.id) : -1

  // Persist the attempt when results are ready
  useEffect(() => {
    if (preview) return
    if (session.sessionState === 'results' && session.attemptStats && session.exercise) {
      saveAttempt({
        exerciseId: session.exercise.id,
        score: session.attemptStats.score,
        accuracy: session.attemptStats.accuracy,
        perfectCount: session.attemptStats.perfectCount,
        goodCount: session.attemptStats.goodCount,
        okCount: session.attemptStats.okCount,
        missCount: session.attemptStats.missCount,
        extraHits: session.attemptStats.extraHits,
        maxCombo: session.attemptStats.maxCombo,
        maxStreak: session.attemptStats.maxStreak,
        avgOffsetMs: session.attemptStats.avgOffsetMs,
        tempoDriftMs: session.attemptStats.tempoDriftMs,
        durationSeconds: session.attemptStats.durationSeconds,
        events: session.eventResults.map((e) => ({
          eventIndex: e.eventIndex,
          grade: e.grade,
          offsetMs: e.offsetMs,
          timing: e.timing,
          onsetEnergy: e.onsetEnergy,
        })),
      }).catch(console.error)
    }
  }, [preview, session.sessionState, session.attemptStats, session.exercise, session.eventResults])

  // Spawn a call-out on each newly graded event
  useEffect(() => {
    const count = session.eventResults.length
    if (settings.callouts && count > prevEventCount.current && session.lastHitGrade && isPlaying) {
      const id = ++calloutId.current
      const x = Math.round(Math.random() * 220 - 110)
      setCallouts((cs) => [...cs.slice(-5), { id, grade: session.lastHitGrade!, x }])
      setTimeout(() => setCallouts((cs) => cs.filter((c) => c.id !== id)), 720)
    }
    prevEventCount.current = count
  }, [session.eventResults.length, session.lastHitGrade, isPlaying, settings.callouts])

  // ── derived UI state ──
  const showCanvas = !!exercise && (isActive || session.sessionState === 'results')
  const showAudioModePrompt = session.sessionState === 'selecting' && session.audioMode === null
  const showPlaysenseTest =
    session.sessionState === 'selecting' && session.audioMode === 'playsense' && !!exercise

  // panel visual state
  let pstate: 'open' | 'rail' | 'hidden' = 'open'
  if (isPlaying && mode !== 'off' && !pinned) {
    if (mode === 'rail') pstate = railHover ? 'open' : 'rail'
    else pstate = 'hidden'
  }

  const goPrev = () => {
    if (allExercises.length === 0) return
    const i = (activeIndex - 1 + allExercises.length) % allExercises.length
    session.selectExercise(allExercises[i])
  }
  const goNext = () => {
    if (allExercises.length === 0) return
    const i = (activeIndex + 1) % allExercises.length
    session.selectExercise(allExercises[i])
  }

  const onPlay = () => {
    if (session.sessionState === 'playing') {
      session.stopExercise()
    } else if (session.sessionState === 'selecting' && !showAudioModePrompt) {
      setPinned(false)
      session.startExercise()
    }
  }

  const rootCls = cn(
    'sv-root stage-page',
    isPlaying && settings.dimChrome && 'dimmed',
    settings.comboFlare && session.currentCombo >= 8 && 'flare-on',
  )

  const totalDuration = exercise ? getExerciseDuration(exercise) : 0
  const elapsed = session.playheadProgress * totalDuration

  return (
    <div className="stage-host">
      <div className={rootCls} data-stage-theme={stageTheme}>
        {/* highway fills the stage */}
        <div className="sv-stage">
          {showCanvas && exercise ? (
            <GlassHighway
              exercise={exercise}
              attemptId={preview ? demoSession.attempt : undefined}
              sessionState={session.sessionState}
              playheadProgress={session.playheadProgress}
              getElapsedSeconds={session.getElapsedSeconds}
              theme={stageTheme}
              currentScore={session.currentScore}
              currentCombo={session.currentCombo}
              currentAccuracy={session.currentAccuracy}
              metronomeBeat={session.metronomeBeat}
              countdownBeat={session.countdownBeat}
              eventResultsLength={session.eventResults.length}
              eventResults={session.eventResults}
              dimAlpha={showAudioModePrompt || showPlaysenseTest ? 0.55 : 0}
              showHud={false}
              hideCountdown
              fill
            />
          ) : (
            <IdlePrompt />
          )}
        </div>
        <div className="stage-scrim" />
        <div className="stage-flare" />

        {/* ── top bar ── */}
        <div className="stage-top">
          <div className="stage-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-solo-color.svg"
              alt=""
              onError={(e) => {
                e.currentTarget.style.visibility = 'hidden'
              }}
            />
            <div className="wm">
              <small>Latin Music Mastery</small>
              PlaySense
            </div>
          </div>
          <div className="stage-top-actions">
            {preview && <><span className="stage-demo-label">Demo · simulated performance</span>
              <Button size="sm" className="stage-review-demo" onClick={demoSession.review}>View results</Button></>}
            {exercise && !preview && (
              <span className="stage-device-dim">
                <DevicePill audioMode={session.audioMode} isListening={session.isListening} />
              </span>
            )}
            {!preview && session.sessionState === 'selecting' && session.audioMode !== 'playsense' && session.audioMode !== 'midi' && (
              <button className="sv-pill accent" onClick={session.startCalibration}>
                <Sliders size={15} /> {session.calibrationData ? 'Recalibrate' : 'Calibrate'}
              </button>
            )}
            <SettingsMenu settings={settings} setSetting={setSetting} />
            <button className="stage-exit" title="Exit performance mode" onClick={() => router.push('/dashboard')}>
              <ArrowLeft size={18} />
            </button>
          </div>
        </div>

        {/* ── exercises panel ── */}
        <div
          className={cn('stage-ex glass', `state-${pstate}`)}
          onMouseEnter={() => mode === 'rail' && setRailHover(true)}
          onMouseLeave={() => setRailHover(false)}
        >
          <div className="stage-ex-full">
            <div className="hd">
              <span className="l">Exercises</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="c">{allExercises.length}</span>
                {isPlaying && mode !== 'off' && (
                  <button
                    className={cn('stage-pin', pinned && 'on')}
                    onClick={() => setPinned((p) => !p)}
                    title={pinned ? 'Auto-collapse' : 'Keep open'}
                  >
                    <Pin size={15} />
                  </button>
                )}
              </div>
            </div>
            <div className="sc">
              <ExerciseList
                exercises={allExercises}
                activeIndex={activeIndex}
                isPlaying={isPlaying}
                onPick={(e) => session.selectExercise(e)}
              />
            </div>
          </div>
          <div className="stage-ex-mini">
            <button className="stage-mini-exp" onClick={() => setPinned(true)} title="Expand exercises">
              <ChevronRight size={16} />
            </button>
            <div className="stage-mini-sc">
              {allExercises.map((e, i) => (
                <button
                  key={e.id}
                  className={cn('stage-mini-num', i === activeIndex && 'active')}
                  onClick={() => session.selectExercise(e)}
                  title={e.title}
                >
                  {i === activeIndex && isPlaying ? (
                    <span className="sv-eq">
                      <i /><i /><i /><i />
                    </span>
                  ) : (
                    i + 1
                  )}
                  <span
                    className="d"
                    style={{ background: difficultyColor(e.difficulty) }}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* floating reopen (hidden mode) */}
        <button
          className={cn('stage-reopen glass', pstate === 'hidden' && 'show')}
          onClick={() => setPinned(true)}
        >
          <Target size={15} /> Exercises <span className="n">{allExercises.length}</span>
        </button>

        {/* Live performance is intentionally compact so the band stays visible. */}
        {session.sessionState !== 'results' && <div className="stage-hud">
          <PerformanceHud score={session.currentScore} combo={session.currentCombo} accuracy={session.currentAccuracy}
            hasResults={session.eventResults.length > 0} playing={isPlaying} />
        </div>}

        {/* lane guide */}
        {settings.laneGuide && exercise && (
          <LaneGuide exercise={exercise} />
        )}

        {/* hit call-outs */}
        <div className="stage-callouts">
          {callouts.map((c) => (
            <span
              key={c.id}
              className="stage-callout"
              style={{ color: GRADE_COLORS[c.grade as HitGrade] || '#fff', marginLeft: c.x }}
            >
              {GRADE_LABELS[c.grade] || c.grade}
            </span>
          ))}
        </div>

        {/* count-in */}
        {session.sessionState === 'countdown' && (
          <div className="stage-countin">
            <div className="lbl">Get ready</div>
            <div key={String(session.countdownBeat)} className="n">
              {session.countdownBeat || '…'}
            </div>
          </div>
        )}

        {/* ── transport ── */}
        {exercise && isActive && (
          <div className="stage-transport glass">
            <div className="controls">
              <button className="stage-nav" onClick={goPrev} title="Previous">
                <SkipBack size={15} />
              </button>
              <button
                className="sv-play"
                style={{ width: 46, height: 46 }}
                onClick={onPlay}
                disabled={session.sessionState === 'countdown' || showAudioModePrompt || session.backingTrackLoading}
                aria-label={isPlaying ? 'Stop' : 'Play'}
              >
                {session.sessionState === 'countdown' || session.backingTrackLoading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : isPlaying ? (
                  <Square size={18} fill="currentColor" />
                ) : (
                  <Play size={20} fill="currentColor" />
                )}
              </button>
              <button className="stage-nav" onClick={goNext} title="Next">
                <SkipForward size={15} />
              </button>
            </div>
            <div className="np">
              <div className="t">{exercise.title}</div>
              <div className="m">
                {getInstrumentLabel(exercise.instrument)} · {exercise.bpm} BPM
              </div>
            </div>
            <div className="stage-sep" />
            <div className="sv-scrub">
              <span className="time">{formatTime(elapsed)}</span>
              <div className="track">
                <div className="fill" style={{ width: `${(isPlaying ? session.playheadProgress : 0) * 100}%` }}>
                  {isPlaying && <span className="knob" />}
                </div>
              </div>
              <span className="time">{formatTime(totalDuration)}</span>
            </div>
            <div className="stage-sep" />
            {!preview && <><MicMeter inputLevel={session.inputLevel} isListening={session.isListening} />
            <AudioControls
              audioMode={session.audioMode}
              instrument={exercise.instrument}
              noisyRoomMode={session.noisyRoomMode}
              audioMetronome={session.audioMetronome}
              sessionState={session.sessionState}
              onAudioModeChange={session.setAudioMode}
              onNoisyRoomChange={session.setNoisyRoomMode}
              onAudioMetronomeChange={session.setAudioMetronome}
            /></>}
          </div>
        )}

        {/* ── re-homed flows (glass modals) ── */}
        <AnimatePresence>
          {showAudioModePrompt && exercise && (
            <ModalHost key="audio-mode">
              <div className="w-full max-w-md">
                <AudioModePrompt onSelect={session.setAudioMode} instrument={exercise.instrument} />
              </div>
            </ModalHost>
          )}
          {showPlaysenseTest && exercise && (
            <ModalHost key="playsense-test">
              <div className="w-full max-w-lg">
                <PlaysenseTestPanel
                  instrument={exercise.instrument}
                  onReady={session.startExercise}
                  onBack={session.clearAudioMode}
                />
              </div>
            </ModalHost>
          )}
          {session.sessionState === 'calibrating' && (
            <ModalHost key="calibrating">
              <div className="w-full max-w-lg">
                <CalibrationWizard
                  isCalibrating={session.isCalibrating}
                  calibrationData={session.calibrationData}
                  calibrationBeat={session.calibrationBeat}
                  totalCalibrationBeats={session.totalCalibrationBeats}
                  calibrationError={session.calibrationError}
                  onStartCalibration={session.startCalibration}
                  onSkip={() => session.startExercise()}
                  onClearCalibration={() => session.startCalibration()}
                  audioMode={session.audioMode}
                />
              </div>
            </ModalHost>
          )}
        </AnimatePresence>

        {session.attemptStats && exercise && <PerformanceResultsDialog
          open={session.sessionState === 'results'} onClose={session.goToSelect}
          stats={session.attemptStats} exerciseTitle={exercise.title} demo={preview}
          onRetry={session.retry} onNext={session.goToSelect} nextLabel="Choose exercise"
        />}

        {/* error toast */}
        {session.audioError && (
          <div className="absolute bottom-24 left-1/2 z-[13] -translate-x-1/2 rounded-xl border border-[rgba(213,78,63,0.4)] bg-[rgba(40,16,12,0.9)] px-4 py-2 text-xs text-[#f1ece6] backdrop-blur">
            {session.audioError}
          </div>
        )}
      </div>
    </div>
  )
}

// ───────────────────────── sub-components ─────────────────────────

function IdlePrompt() {
  return (
    <div className="absolute inset-0 z-[3] flex items-center justify-center">
      <div className="text-center text-[#9a8f83]">
        <Music2 className="mx-auto mb-4 h-16 w-16 opacity-50" />
        <p className="text-sm">Choose an exercise to start practicing</p>
      </div>
    </div>
  )
}

function DevicePill({
  audioMode,
  isListening,
}: {
  audioMode: 'headphones' | 'speaker-safe' | 'playsense' | 'midi' | null
  isListening: boolean
}) {
  const label =
    audioMode === 'midi' ? 'MIDI instrument' : audioMode === 'playsense' ? 'PlaySense device' : audioMode === 'speaker-safe' ? 'Speaker (safe)' : 'Built-in microphone'
  return (
    <span className="sv-pill">
      <span className="sv-live" style={{ background: isListening ? 'var(--green)' : 'var(--faint)' }} />
      {label}
    </span>
  )
}

function difficultyColor(difficulty: string): string {
  return difficulty === 'beginner'
    ? 'var(--green)'
    : difficulty === 'advanced'
      ? 'var(--terra)'
      : 'var(--yellow)'
}

function ExerciseList({
  exercises,
  activeIndex,
  isPlaying,
  onPick,
}: {
  exercises: ExerciseDefinition[]
  activeIndex: number
  isPlaying: boolean
  onPick: (e: ExerciseDefinition) => void
}) {
  // group by instrument, preserving order
  const groups: Array<{ inst: string; items: Array<{ ex: ExerciseDefinition; i: number }> }> = []
  exercises.forEach((ex, i) => {
    let g = groups[groups.length - 1]
    if (!g || g.inst !== ex.instrument) {
      g = { inst: ex.instrument, items: [] }
      groups.push(g)
    }
    g.items.push({ ex, i })
  })

  return (
    <>
      {groups.map((g) => (
        <div key={g.inst}>
          <div className="sv-grouplbl">{getInstrumentLabel(g.inst)}</div>
          {g.items.map(({ ex, i }) => {
            const on = i === activeIndex
            return (
              <button key={ex.id} className={cn('sv-exrow', on && 'active')} onClick={() => onPick(ex)}>
                <span className="sv-exnum">
                  {on && isPlaying ? (
                    <span className="sv-eq">
                      <i /><i /><i /><i />
                    </span>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="sv-exbody">
                  <span className="sv-exname">{ex.title}</span>
                  <span className="sv-exsub">
                    <span className="sv-dot" style={{ background: difficultyColor(ex.difficulty) }} />
                    <span style={{ textTransform: 'capitalize' }}>{ex.difficulty}</span>
                  </span>
                </span>
                <span className="sv-exmeta">
                  <span className="sv-exbpm">{ex.bpm} BPM</span>
                  <span className="sv-exdur">{formatTime(getExerciseDuration(ex))}</span>
                </span>
              </button>
            )
          })}
        </div>
      ))}
    </>
  )
}

function MicMeter({ inputLevel, isListening }: { inputLevel: number; isListening: boolean }) {
  // derive 5 equalizer-style bars from the scalar input level
  const level = isListening ? Math.min(1, inputLevel * 5) : 0.12
  const mults = [0.6, 1, 0.78, 0.92, 0.66]
  return (
    <div className="sv-mic">
      <span className="ic">
        <Mic size={16} />
      </span>
      <div className="bars">
        {mults.map((m, i) => (
          <i key={i} style={{ height: `${Math.max(8, Math.min(100, level * 100 * m))}%` }} />
        ))}
      </div>
    </div>
  )
}

function AudioControls({
  audioMode,
  instrument,
  noisyRoomMode,
  audioMetronome,
  sessionState,
  onAudioModeChange,
  onNoisyRoomChange,
  onAudioMetronomeChange,
}: {
  audioMode: 'headphones' | 'speaker-safe' | 'playsense' | 'midi' | null
  instrument: ExerciseDefinition['instrument']
  noisyRoomMode: boolean
  audioMetronome: boolean
  sessionState: string
  onAudioModeChange: (m: 'headphones' | 'speaker-safe' | 'playsense' | 'midi') => void
  onNoisyRoomChange: (v: boolean) => void
  onAudioMetronomeChange: (v: boolean) => void
}) {
  const cycleMode = () => {
    onAudioModeChange(nextInputMode(instrument, audioMode))
  }
  const ModeIcon = audioMode === 'midi' ? Piano : audioMode === 'playsense' ? Bluetooth : audioMode === 'speaker-safe' ? Speaker : Headphones
  return (
    <div className="sv-audio">
      <button className="sv-tog on" onClick={cycleMode} disabled={sessionState === 'playing' || sessionState === 'countdown'} title="Input source — tap to switch" type="button">
        <span className="ti">
          <ModeIcon size={17} />
        </span>
      </button>
      {audioMode !== 'playsense' && audioMode !== 'midi' && (
        <button
          className={cn('sv-tog', noisyRoomMode && 'on')}
          onClick={() => onNoisyRoomChange(!noisyRoomMode)}
          title="Noisy room — noise filter"
          type="button"
        >
          <span className="ti">
            <Volume2 size={17} />
          </span>
          <span className={cn('sv-sw', noisyRoomMode && 'on')} />
        </button>
      )}
      {sessionState === 'selecting' && (
        <button
          className={cn('sv-tog', audioMetronome && 'on')}
          onClick={() => onAudioMetronomeChange(!audioMetronome)}
          title="Audio click — metronome"
          type="button"
        >
          <span className="ti">
            <Music2 size={17} />
          </span>
          <span className={cn('sv-sw', audioMetronome && 'on')} />
        </button>
      )}
    </div>
  )
}

function LaneGuide({ exercise }: { exercise: ExerciseDefinition }) {
  const swatches = ['#F2A12C', '#E0A43B', '#E8771C', '#D54E3F', '#CB3145', '#B5683B']
  const surfaces = Array.from(
    new Set(exercise.events.map((e) => e.surface || e.technique).filter(Boolean)),
  ).slice(0, 6) as string[]
  if (surfaces.length === 0) return null
  return (
    <div className="stage-legend">
      {surfaces.map((s, i) => (
        <span key={s} className="lg">
          <span className="sw" style={{ background: swatches[i % swatches.length] }} />
          <span style={{ textTransform: 'capitalize' }}>{s}</span>
        </span>
      ))}
    </div>
  )
}

function SettingsMenu({
  settings,
  setSetting,
}: {
  settings: StageSettings
  setSetting: <K extends keyof StageSettings>(k: K, v: StageSettings[K]) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button className="stage-exit" title="Performance settings" onClick={() => setOpen((o) => !o)}>
        <Settings2 size={18} />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 19 }} onClick={() => setOpen(false)} />
          <div
            className="glass"
            style={{
              position: 'absolute',
              right: 0,
              top: 46,
              zIndex: 20,
              width: 248,
              borderRadius: 14,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <SettingRow label="Sidebar while playing">
              <select
                value={settings.sidebar}
                onChange={(e) => setSetting('sidebar', e.target.value as SidebarMode)}
                style={{
                  background: 'var(--panel-2)',
                  color: 'var(--text)',
                  border: '1px solid var(--sv-border)',
                  borderRadius: 8,
                  padding: '4px 8px',
                  fontSize: 12,
                }}
              >
                <option>Icon rail</option>
                <option>Hidden</option>
                <option>Stays open</option>
              </select>
            </SettingRow>
            <ToggleRow label="Dim chrome while playing" value={settings.dimChrome} onChange={(v) => setSetting('dimChrome', v)} />
            <ToggleRow label="Hit call-outs" value={settings.callouts} onChange={(v) => setSetting('callouts', v)} />
            <ToggleRow label="Combo flare" value={settings.comboFlare} onChange={(v) => setSetting('comboFlare', v)} />
            <ToggleRow label="Lane guide" value={settings.laneGuide} onChange={(v) => setSetting('laneGuide', v)} />
          </div>
        </>
      )}
    </div>
  )
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--dim)' }}>{label}</span>
      {children}
    </div>
  )
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        background: 'transparent',
        border: 'none',
        padding: 0,
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--dim)' }}>{label}</span>
      <span className={cn('sv-sw', value && 'on')} />
    </button>
  )
}

function ModalHost({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="stage-modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  )
}
