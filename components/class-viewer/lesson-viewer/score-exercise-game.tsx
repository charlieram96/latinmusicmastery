'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ExerciseDefinition } from '@/lib/play-sense/types'
import type { BackingTrack } from '@/app/actions/playsense-studio'
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types'
import { getExerciseDuration } from '@/lib/play-sense/exercise-utils'
import { timelineToEngineSeconds } from '@/lib/play-sense/backing-track-timing'
import {
  WaypointTimeMap,
  type SyncMethod,
} from '@/components/playsense-studio/shared/time-map/time-map'
import type { PlaysenseStudioPlayerTimeMap } from '@/components/playsense-studio/player/playsense-studio-player'
import { useExerciseSession } from '@/hooks/use-exercise-session'
import { useStageDemoSession } from '@/hooks/use-stage-demo-session'
import { StageHighway as GlassHighway } from '@/components/play-sense/stage-highway/StageHighway'
import { ExerciseScore } from './exercise-score'
import { exerciseScoreTime } from '@/lib/playsense-studio/notation-playback'
import { NowPlayingBar } from '@/components/play-sense/now-playing-bar'
import { CalibrationWizard } from '@/components/play-sense/calibration-wizard'
import { ResultsSummary } from '@/components/play-sense/results-summary'
import { AudioModePrompt } from '@/components/play-sense/audio-mode-prompt'
import { PlaysenseTestPanel } from '@/components/play-sense/playsense-test-panel'
import { saveAttempt } from '@/app/actions/play-sense'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, ChevronDown, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react'
import { DEFAULT_MIX_ENTRY, readStoredBackingMix, writeStoredBackingMix, type BackingMix } from '@/lib/play-sense/backing-mix'
import { useTranslation } from '@/components/language-provider'
import { ExerciseModeFrame } from './exercise-mode-frame'
import { ExerciseScoreWorkspaceBridge } from './exercise-workspace'
import { SplitWorkspace, WorkspaceLayoutSwitcher } from '@/components/playsense-studio/player/split-workspace'
import { useWorkspaceLayout } from '@/components/playsense-studio/player/use-workspace-layout'
import { WorkspaceToolsPortal } from '@/components/playsense-studio/player/workspace-tools-slot'
import { useStaffLayoutPreference } from '@/components/playsense-studio/player/notation/staff-layout-switch'
import { PLAY_WORKSPACE } from '@/lib/playsense-studio/workspace-layout'
import { useLessonActivity } from './lesson-progress-context'
import { ReadyCheck } from './ready-check'
import { LessonTransport } from './lesson-transport'
import { LessonAction, useLessonFrame } from './lesson-mode/lesson-frame'
import { StaffRenderer } from '@/components/playsense-studio/player/notation/renderers/staff-renderer'
import { usePlaysense } from '@/contexts/playsense-context'
import { finishedExercise } from '@/lib/courses/lesson-completion'

interface ScoreExerciseGameProps {
  /** The exercise derived from the authored score (see lib/play-sense/score-to-exercise). */
  exercise: ExerciseDefinition
  /** The lesson's score — rendered as staff notation alongside the highway while playing. */
  score?: ScoreDocument
  /** Local visual showcase: simulated hits, no input connection or saved attempt. */
  preview?: boolean
  /** When set (video lessons), the results screen offers "Watch demo again" which
   *  flips the parent back to the instructional video. */
  onWatchDemo?: () => void
  /** Instrument backing tracks the student can choose to hear. When provided
   *  (even empty), the selection — not the legacy exercise.audioUrl — drives the
   *  engine's backing audio. Each track carries its own position and trim,
   *  set in the studio and converted to engine time here. */
  backingTracks?: BackingTrack[]
  /** Optional exercise-part video: plays MUTED in sync with the engine clock.
   *  Positioned by `timeMap` (beat-accurate) when published, else by its crop
   *  offset (window length = the score's length). */
  exerciseVideo?: {
    url: string
    /** Trim in-point: where the usable region of the video starts. */
    startSeconds: number
    /** End of the usable region; null = play to the end. */
    trimOutSeconds?: number | null
    timeMap: PlaysenseStudioPlayerTimeMap | null
  } | null
}

/**
 * Single-exercise "rockband" test view: the rhythm highway + live input grading
 * engine, fed by an ExerciseDefinition derived from the lesson's PlaySense score.
 *
 * This is a focused, playlist-free embedding of the same engine that powers
 * the standalone /play-sense stage (components/play-sense/stage/stage-player.tsx).
 */
export function ScoreExerciseGame(props: ScoreExerciseGameProps) {
  return <ExerciseModeFrame title={props.exercise.title} hasScore={!!props.score} preview={props.preview ?? false} onWatchDemo={props.onWatchDemo}>
    <ScoreExerciseSession {...props} />
  </ExerciseModeFrame>
}

function ScoreExerciseSession({
  exercise,
  score,
  onWatchDemo,
  backingTracks,
  exerciseVideo,
  preview = false,
}: ScoreExerciseGameProps) {
  const { t } = useTranslation()
  const completePerformance = useLessonActivity('performance')
  const playsense = usePlaysense()
  const inLesson = !!useLessonFrame()
  // Play opens with the staff and highway filling the stage and the teacher
  // video floating bottom right (24 % wide); the student can re-lay it out.
  // Remembered per staff layout, like watch (lmm-workspace:play:stacked / :horizontal).
  const [staffLayout, setStaffLayout] = useStaffLayoutPreference()
  const workspace = useWorkspaceLayout(`play:${staffLayout}`, PLAY_WORKSPACE)
  // The student's mix over the backing tracks: every track plays, each at the
  // level the student set (on top of the authored level) or muted. Remembered
  // per viewer; hydrated after mount so the server and first client render agree.
  const [mix, setMix] = useState<BackingMix>({})
  useEffect(() => { setMix(readStoredBackingMix()) }, [])
  const updateMix = (id: string, patch: Partial<typeof DEFAULT_MIX_ENTRY>) => {
    setMix((prev) => {
      const next = { ...prev, [id]: { ...DEFAULT_MIX_ENTRY, ...prev[id], ...patch } }
      writeStoredBackingMix(next)
      return next
    })
  }
  const entryFor = (id: string) => mix[id] ?? DEFAULT_MIX_ENTRY
  const tracksOn = (backingTracks ?? []).filter((track) => !entryFor(track.id).muted).length

  // --- Optional exercise video, synced to the engine clock ---
  // Muted visual reference: seek to the start on countdown, play during
  // 'playing', and re-seek only when drifted (>0.35s) so it stays smooth.
  // When a time map is published the video is positioned by musical position
  // (beat-accurate); otherwise it falls back to the linear crop offset.
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const exerciseDurationSec = useMemo(() => getExerciseDuration(exercise), [exercise])
  const videoMap = useMemo(() => {
    const tm = exerciseVideo?.timeMap
    if (!tm || tm.waypoints.length < 2) return null
    try {
      return new WaypointTimeMap(tm.id, tm.method as SyncMethod, tm.waypoints)
    } catch {
      return null
    }
  }, [exerciseVideo])

  // Studio placement is stored on the VIDEO timeline; the engine runs on a
  // fixed-BPM grid whose t0 is measure 1 beat 1. Convert here, where the time
  // map already exists, and hand the session clips already in engine seconds —
  // that keeps time-map knowledge in exactly one place.
  const placedTracks = useMemo(
    () =>
      (backingTracks ?? []).map((track) => ({
        id: track.id,
        audioUrl: track.audioUrl,
        startSeconds: timelineToEngineSeconds(
          track.timelineStartSeconds,
          videoMap,
          { bpm: exercise.bpm, timeSignature: exercise.timeSignature, grid: exercise.grid },
          exerciseVideo?.startSeconds ?? 0
        ),
        trimInSeconds: track.trimInSeconds,
        trimOutSeconds: track.trimOutSeconds,
        gain: track.gain,
      })),
    [backingTracks, videoMap, exercise.bpm, exercise.timeSignature, exercise.grid, exerciseVideo]
  )

  // An explicit (possibly empty) selection only when backing tracks are
  // authored; otherwise the legacy path (exercise.audioUrl) stays in charge.
  const liveSession = useExerciseSession(backingTracks ? { backingTracks: placedTracks, backingMix: mix } : {})
  const demoExercises = useMemo(() => [exercise], [exercise])
  const demoSession = useStageDemoSession(demoExercises, preview)
  const session = preview ? { ...liveSession, ...demoSession.overrides } : liveSession
  const stableExercise = useMemo(() => exercise, [exercise])

  useEffect(() => {
    const v = videoRef.current
    if (!v || !exerciseVideo) return
    // The map covers one pass; progress spans all loops — fold it back per pass.
    const loops = Math.max(1, exercise.loopCount || 1)
    // exerciseVideo.startSeconds IS the trim in-point (040 folded the old crop
    // into it), so the usable region starts no earlier than there.
    const trimIn = exerciseVideo.startSeconds
    const trimOut = exerciseVideo.trimOutSeconds ?? Infinity
    const videoStart = Math.max(videoMap ? videoMap.videoStart : trimIn, trimIn)
    if (session.sessionState === 'playing') {
      let expected: number
      if (videoMap) {
        const withinPass = (session.playheadProgress * loops) % 1
        expected = videoMap.toVideoTime(withinPass * videoMap.totalQN)
      } else {
        expected = videoStart + session.playheadProgress * exerciseDurationSec
      }
      expected = Math.min(Math.max(expected, trimIn), trimOut)
      if (Math.abs(v.currentTime - expected) > 0.35) v.currentTime = expected
      if (v.currentTime >= trimOut) {
        if (!v.paused) v.pause()
      } else if (v.paused) void v.play().catch(() => {})
    } else if (session.sessionState === 'countdown') {
      if (!v.paused) v.pause()
      if (Math.abs(v.currentTime - videoStart) > 0.05) v.currentTime = videoStart
    } else if (!v.paused) {
      v.pause()
    }
  }, [
    session.sessionState,
    session.playheadProgress,
    exerciseVideo,
    exerciseDurationSec,
    videoMap,
    exercise.loopCount,
  ])

  // ExerciseScore reports the active track's single-pass duration. Its side
  // layout combines this local clock with the pass index to read continuously
  // through repetitions; the top layout retains compact repeat notation.
  const [staffDurationMs, setStaffDurationMs] = useState<number | null>(null)
  const loopCount = Math.max(1, exercise.loopCount || 1)
  const staffMs = exerciseScoreTime(session.playheadProgress * exerciseDurationSec, exerciseDurationSec, loopCount, staffDurationMs ?? 0)
  const getStaffMs = () => exerciseScoreTime(session.getElapsedSeconds(), exerciseDurationSec, loopCount, staffDurationMs ?? 0)


  // Auto-select this exercise so the session is ready to configure + play.
  useEffect(() => {
    session.selectExercise(stableExercise)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableExercise])

  // Persist the attempt when results are ready.
  useEffect(() => {
    if (finishedExercise(session.sessionState, session.playheadProgress, preview)) completePerformance()
  }, [session.sessionState, session.playheadProgress, preview, completePerformance])

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

  const isActive =
    session.sessionState === 'selecting' ||
    session.sessionState === 'countdown' ||
    session.sessionState === 'playing' ||
    session.sessionState === 'paused'

  const showCanvas = !!session.exercise && isActive

  const showAudioModePrompt =
    session.sessionState === 'selecting' && session.audioMode === null

  // ── Ready check: input, mic and timing on one screen before the first take ──
  const [readyConfirmed, setReadyConfirmed] = useState(false)
  const showReady = !preview && !readyConfirmed && !!session.exercise &&
    (session.sessionState === 'selecting' || session.sessionState === 'calibrating')
  const micMode = session.audioMode === 'headphones' || session.audioMode === 'speaker-safe'
  const [micHeard, setMicHeard] = useState(false)
  const [deviceLabel, setDeviceLabel] = useState<string | null>(null)
  const [ble, setBle] = useState<{ connecting: boolean; error: boolean }>({ connecting: false, error: false })
  const testedMode = useRef<string | null>(null)
  // The mic test opens by itself once a mic mode is chosen (and again after a switch).
  useEffect(() => {
    if (!showReady || !micMode || session.sessionState !== 'selecting') return
    if (session.isListening || testedMode.current === session.audioMode) return
    testedMode.current = session.audioMode
    session.testMic()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showReady, micMode, session.audioMode, session.isListening, session.sessionState])
  useEffect(() => {
    if (showReady && session.isListening && session.inputLevel > 0.08) setMicHeard(true)
  }, [showReady, session.isListening, session.inputLevel])
  // A new input must prove itself again.
  const [heardMode, setHeardMode] = useState(session.audioMode)
  if (heardMode !== session.audioMode) { setHeardMode(session.audioMode); setMicHeard(false) }
  useEffect(() => {
    if (!showReady || !session.isListening || !navigator.mediaDevices?.enumerateDevices) return
    let live = true
    void navigator.mediaDevices.enumerateDevices().then(devices => {
      const inputs = devices.filter(d => d.kind === 'audioinput')
      const device = inputs.find(d => d.deviceId === 'default') ?? inputs[0]
      if (live) setDeviceLabel(device?.label?.replace(/^Default - /, '') || null)
    }).catch(() => {})
    return () => { live = false }
  }, [showReady, session.isListening])
  const connectBle = async () => {
    setBle({ connecting: true, error: false })
    try {
      await playsense.connect()
      setBle({ connecting: false, error: !playsense.isConnected() })
    } catch {
      setBle({ connecting: false, error: true })
    }
  }
  const startFromReady = () => {
    setReadyConfirmed(true)
    void session.startExercise()
  }

  const showPlaysenseTest =
    session.sessionState === 'selecting' &&
    session.audioMode === 'playsense' &&
    !!session.exercise

  if (showReady && session.exercise) {
    const ex = session.exercise
    return (
      <div className="ps-lesson-ready">
        <ReadyCheck
          instrument={ex.instrument}
          audioMode={session.audioMode}
          onMode={session.setAudioMode}
          inputLevel={session.inputLevel}
          micOpen={session.isListening}
          micHeard={micHeard}
          deviceLabel={deviceLabel}
          onTestMic={() => { testedMode.current = session.audioMode; session.testMic() }}
          calibrating={session.isCalibrating}
          calibrationBeat={session.calibrationBeat}
          totalCalibrationBeats={session.totalCalibrationBeats}
          calibrationError={session.calibrationError}
          latencyMs={session.audioMode === 'midi' ? null : session.calibrationData?.latencyMs ?? null}
          onCalibrate={session.startCalibration}
          bleConnected={playsense.connectionStatus === 'connected'}
          bleConnecting={ble.connecting}
          bleError={ble.error}
          onConnectBle={() => void connectBle()}
          preview={score ? <StaffRenderer score={score} trackIndex={0} currentMs={0} showCursor={false} autoFollow={false} compact layoutMode="paged" className="h-full" /> : null}
          meta={t('dashboard.classViewer.lessonMode.ready.meta', { bars: ex.measures, bpm: Math.round(ex.bpm) })}
          onStart={startFromReady}
        />
      </div>
    )
  }

  // Calibrating — full panel
  if (session.sessionState === 'calibrating') {
    return (
      <div className="ps-lesson-calibration rounded-xl border border-border bg-card p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={session.goToSelect}
          className="mb-3 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> {t('common.back')}
        </Button>
        <div className="max-w-lg mx-auto">
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
      </div>
    )
  }

  // Results — full panel
  if (session.sessionState === 'results' && session.attemptStats && session.exercise) {
    return (
      <div className="ps-lesson-results rounded-xl border border-border bg-card p-4">
        <ResultsSummary
          stats={session.attemptStats}
          exerciseTitle={session.exercise.title}
          onRetry={session.retry}
          onWatchDemo={onWatchDemo}
          demo={preview}
        />
      </div>
    )
  }

  // Backing-track mixer — a mute and a level per track, usable before and
  // during the attempt (changes ramp live). In a lesson it sits in the transport.
  const mixer = backingTracks && backingTracks.length > 0 ? (
    <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    {t('dashboard.classViewer.exercise.playAlongWith')}
                    <Badge variant={tracksOn === 0 ? 'outline' : 'secondary'} className="ml-0.5 tabular-nums">
                      {tracksOn}/{backingTracks.length}
                    </Badge>
                    <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-0">
                  <div className="flex items-baseline justify-between border-b border-border px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('dashboard.classViewer.exercise.playAlongWith')}
                    </p>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {t('dashboard.classViewer.exercise.tracksOn', { on: tracksOn, total: backingTracks.length })}
                    </span>
                  </div>
                  <ul className="flex max-h-[280px] flex-col overflow-y-auto py-1">
                    {backingTracks.map((track) => {
                      const entry = entryFor(track.id)
                      return (
                        <li key={track.id} className={`flex items-center gap-2.5 px-3 py-2 ${entry.muted ? 'opacity-60' : ''}`}>
                          <button
                            type="button"
                            onClick={() => updateMix(track.id, { muted: !entry.muted })}
                            aria-pressed={!entry.muted}
                            aria-label={`${entry.muted ? 'Unmute' : 'Mute'} ${track.label}`}
                            title={entry.muted ? 'Unmute' : 'Mute'}
                            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition ${
                              entry.muted ? 'text-muted-foreground hover:bg-muted hover:text-foreground' : 'bg-primary/15 text-primary hover:bg-primary/25'
                            }`}
                          >
                            {entry.muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-sm font-medium text-foreground">{track.label}</span>
                              <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                                {Math.round(entry.level * 100)}
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.05}
                              value={entry.level}
                              disabled={entry.muted}
                              onChange={(e) => updateMix(track.id, { level: Number(e.target.value) })}
                              className="mt-1 h-1.5 w-full cursor-pointer accent-primary disabled:cursor-default"
                              aria-label={`${track.label} level`}
                            />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                  <p className="border-t border-border px-3 py-2 text-[11px] leading-snug text-muted-foreground">
                    {t('dashboard.classViewer.exercise.tracksHint')}
                  </p>
                </PopoverContent>
              </Popover>
  ) : null

  const hasStaff = showCanvas && !!score
  const scoreEl = hasStaff && score ? (
    <ExerciseScore score={score} currentMs={staffMs} getCurrentMs={getStaffMs}
      playing={session.sessionState === 'playing' || session.sessionState === 'paused'} pass={Math.floor(session.playheadProgress * loopCount) + 1}
      getPass={() => Math.floor(Math.max(0, session.getElapsedSeconds()) / exerciseDurationSec * loopCount) + 1}
      passCount={loopCount} onDurationKnown={setStaffDurationMs} staffLayout={staffLayout} onStaffLayoutChange={setStaffLayout}/>
  ) : null

  const stageEl = (
    <div className="ps-lesson-stage relative h-full min-h-0 flex-1 bg-black">
      {showCanvas && session.exercise ? (
        <>
          <GlassHighway
            attemptId={preview ? demoSession.attempt : undefined}
            exercise={session.exercise}
            sessionState={session.sessionState}
            playheadProgress={session.playheadProgress}
            getElapsedSeconds={session.getElapsedSeconds}
            currentScore={session.currentScore}
            currentCombo={session.currentCombo}
            currentAccuracy={session.currentAccuracy}
            metronomeBeat={session.metronomeBeat}
            countdownBeat={session.countdownBeat}
            eventResultsLength={session.eventResults.length}
            eventResults={session.eventResults}
            dimAlpha={showAudioModePrompt || showPlaysenseTest ? 0.55 : 0}
            showThemePicker={!exerciseVideo}
            fill
          />

          {(session.sessionState === 'playing' || session.sessionState === 'paused') && (
            <div className="ps-lesson-stage-title absolute left-5 top-[104px] z-20 flex flex-col gap-0.5 pointer-events-none">
              <span className="text-xs font-semibold text-white/60 tracking-wide drop-shadow-sm">
                {session.exercise.title}
              </span>
              <span className="text-xs font-mono text-white/50 drop-shadow-sm">
                {session.exercise.bpm} BPM &middot; {session.exercise.timeSignature[0]}/
                {session.exercise.timeSignature[1]}
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          {t('dashboard.classViewer.exercise.preparing')}
        </div>
      )}
    </div>
  )

  // Session prompts cover the whole workspace, not just the highway.
  const overlays = showCanvas && session.exercise ? (
    <>
      <AnimatePresence>
        {showAudioModePrompt && (
          <motion.div
            key="audio-mode-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="ps-lesson-overlay absolute inset-0 z-30 flex items-center justify-center bg-background/55 p-4 backdrop-blur-[2px]"
          >
            <div className="w-full max-w-md">
              <AudioModePrompt
                onSelect={session.setAudioMode}
                instrument={session.exercise.instrument}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPlaysenseTest && (
          <motion.div
            key="playsense-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="ps-lesson-overlay absolute inset-0 z-30 flex items-center justify-center bg-background/55 p-4 backdrop-blur-[2px]"
          >
            <div className="w-full max-w-lg">
              <PlaysenseTestPanel
                instrument={session.exercise.instrument}
                onReady={session.startExercise}
                onBack={session.clearAudioMode}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  ) : null

  return (
    <div className="ps-lesson-game rounded-xl border border-border bg-card overflow-hidden flex flex-col">
      {isActive && inLesson && exerciseVideo && <WorkspaceToolsPortal><WorkspaceLayoutSwitcher controller={workspace} /></WorkspaceToolsPortal>}
      {isActive && !inLesson && (
        <div className="ps-lesson-game-heading flex items-center justify-between gap-3 border-b border-border bg-primary/5 px-4 py-2.5" data-has-tools={!!backingTracks?.length || !!exerciseVideo}>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{preview ? 'Lesson preview' : t('dashboard.classViewer.exercise.yourTurn')}</p>
            <p className="truncate text-xs text-muted-foreground">
              {preview ? 'Instructor video, notation, and PlaySense · simulated performance' : t('dashboard.classViewer.exercise.yourTurnHint')}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {exerciseVideo && <WorkspaceToolsPortal><WorkspaceLayoutSwitcher controller={workspace} /></WorkspaceToolsPortal>}
            {mixer}
          </div>
        </div>
      )}

      {/* The lesson workspace: staff over the highway, the demo video
          floating in a corner (or beside them — the student's choice). */}
      <ExerciseScoreWorkspaceBridge controller={workspace}>
      <SplitWorkspace
        controller={workspace}
        frame="fill"
        media={exerciseVideo && (
          // Muted, follows the engine clock (see the sync effect above).
          <video
            ref={videoRef}
            src={exerciseVideo.url}
            muted
            playsInline
            preload="auto"
            className="h-full w-full bg-black object-contain"
            aria-label="Instructor reference video"
          />
        )}
        music={hasStaff ? scoreEl : stageEl}
        highway={hasStaff ? stageEl : undefined}
        overlay={overlays}
      />
      </ExerciseScoreWorkspaceBridge>

      {preview && isActive && <div className="ps-lesson-preview-controls flex items-center justify-between gap-3 border-t border-border px-4 py-3">
        <span className="text-xs text-muted-foreground">Demo · muted video · results are not saved</span>
        <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => void session.startExercise()}>Replay preview</Button><Button size="sm" onClick={demoSession.review}>View results</Button></div>
      </div>}

      {!preview && inLesson && session.exercise && isActive && !showAudioModePrompt && !showPlaysenseTest && (
        <LessonAction>
          <LessonTransport
            state={session.sessionState as 'selecting' | 'countdown' | 'playing' | 'paused'}
            bpm={session.exercise.bpm}
            countdownBeat={session.countdownBeat}
            click={session.audioMetronome}
            mix={mixer}
            onStart={() => void session.startExercise()}
            onPause={session.pauseExercise}
            onResume={session.resumeExercise}
            onRestart={() => void session.restartExercise()}
            onFinish={session.stopExercise}
            onClickToggle={() => session.setAudioMetronome(!session.audioMetronome)}
            onWatchDemo={onWatchDemo}
          />
        </LessonAction>
      )}

      {!preview && !inLesson && session.exercise && isActive && !showAudioModePrompt && !showPlaysenseTest && (
        <div className="ps-lesson-transport">
        <NowPlayingBar
          exercise={session.exercise}
          sessionState={session.sessionState}
          playheadProgress={session.playheadProgress}
          calibrationData={session.calibrationData}
          noisyRoomMode={session.noisyRoomMode}
          inputLevel={session.inputLevel}
          isListening={session.isListening}
          isMicTesting={session.isMicTesting}
          backingTrackLoading={session.backingTrackLoading}
          backingTrackLoaded={session.backingTrackLoaded}
          audioMetronome={session.audioMetronome}
          audioMode={session.audioMode}
          onAudioModeChange={session.setAudioMode}
          currentScore={session.currentScore}
          currentCombo={session.currentCombo}
          currentAccuracy={session.currentAccuracy}
          lastHitGrade={session.lastHitGrade}
          onStart={session.startExercise}
          onStop={session.stopExercise}
          onPause={session.pauseExercise}
          onResume={session.resumeExercise}
          onRestart={() => void session.restartExercise()}
          onCalibrate={session.startCalibration}
          onTestMic={session.testMic}
          onStopTestMic={session.stopTestMic}
          onNoisyRoomChange={session.setNoisyRoomMode}
          onAudioMetronomeChange={session.setAudioMetronome}
        />
        </div>
      )}

      {session.audioError && (
        <div className="m-4 p-3 rounded-xl border border-red-500/30 bg-destructive/10">
          <p className="text-sm text-muted-foreground">{session.audioError}</p>
        </div>
      )}
    </div>
  )
}
