'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ExerciseDefinition } from '@/lib/play-sense/types'
import type { BackingTrack, ExerciseMedia } from '@/app/actions/playsense-studio'
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types'
import { getLoopDuration, getSessionCountInSeconds } from '@/lib/play-sense/exercise-utils'
import { timelineToEngineSeconds } from '@/lib/play-sense/backing-track-timing'
import { expectedMediaTime, followRate, type PlayMedia } from '@/lib/play-sense/play-follow'
import type { PlaysenseStudioPlayerTimeMap } from '@/components/playsense-studio/player/playsense-studio-player'
import { useExerciseSession } from '@/hooks/use-exercise-session'
import { useStageDemoSession } from '@/hooks/use-stage-demo-session'
import { StageHighway as GlassHighway } from '@/components/play-sense/stage-highway/StageHighway'
import { ExerciseScore } from './exercise-score'
import { exerciseScoreTime } from '@/lib/playsense-studio/notation-playback'
import { NowPlayingBar } from '@/components/play-sense/now-playing-bar'
import { CalibrationWizard } from '@/components/play-sense/calibration-wizard'
import { AudioModePrompt } from '@/components/play-sense/audio-mode-prompt'
import { PlaysenseTestPanel } from '@/components/play-sense/playsense-test-panel'
import { getBestAttemptAccuracy, saveAttempt } from '@/app/actions/play-sense'
import { buildBarResults, reachedResults, takeBaseline } from '@/lib/play-sense/bar-results'
import { computeStats } from '@/lib/play-sense/scoring'
import { audioErrorKey } from '@/lib/play-sense/audio-errors'
import { PartDone } from './part-done'
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

type PitchPreservingMedia = HTMLMediaElement & {
  webkitPreservesPitch?: boolean
  mozPreservesPitch?: boolean
}

// Module-level, not a closure: mirrors lib/playsense-studio/use-flex-playback.ts's
// own setFlexPitch — a plain DOM element parameter rather than a captured
// value the React Compiler lint would flag as a render-time mutation.
function setPreservesPitch(el: PitchPreservingMedia): void {
  el.preservesPitch = true
  if ('webkitPreservesPitch' in el) el.webkitPreservesPitch = true
  if ('mozPreservesPitch' in el) el.mozPreservesPitch = true
}

const MEDIA_CLASS = 'h-full w-full bg-black object-contain'

// The play-along element is created once and kept (see ensureMediaEl): this
// applies the current props to it. Muted unless audible (a jam's own track),
// which also forces pitch preservation (the follow trims the rate ±3 %).
function applyMediaProps(el: HTMLVideoElement, url: string, audible: boolean, label: string): void {
  if (el.getAttribute('src') !== url) el.src = url
  el.muted = !audible
  el.toggleAttribute('muted', !audible)
  el.setAttribute('playsinline', '')
  el.preload = 'auto'
  el.className = MEDIA_CLASS
  el.setAttribute('aria-label', label)
  if (audible) setPreservesPitch(el as PitchPreservingMedia)
}

/** A play() refused by the browser's autoplay policy (not a play() cut short by a pause). */
function isAutoplayRefusal(err: unknown): boolean {
  return (err as { name?: string } | null)?.name === 'NotAllowedError'
}

/** Beyond this start lag an audible track hard-seeks once it is running. */
const START_SEEK_SECONDS = 0.03

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
  /** The published play settings (Studio rework P5): the count-in length
   *  applies to every take; bar 1 and pre-roll place the play-along video.
   *  Absent = a one-bar count-in, pre-roll on, bar 1 at the video's trim-in. */
  play?: ExerciseMedia['play'] | null
  /** Optional exercise-part video: plays MUTED by default, following the
   *  engine clock from `play.bar1Seconds` (or the trim-in point when bar 1
   *  is unset). See `mediaAudible` for the one exception. */
  exerciseVideo?: {
    url: string
    /** Trim in-point: where the usable region of the video starts. */
    startSeconds: number
    /** End of the usable region; null = play to the end. */
    trimOutSeconds?: number | null
    /** The older exercise time map. No longer read here: bar 1 places the video and its backing tracks. */
    timeMap: PlaysenseStudioPlayerTimeMap | null
  } | null
  /** A jam session's own track (Studio rework P5, Task 8 fix round 1): unlike
   *  an exercise's silent reference video, the student must actually hear
   *  this one, so the media element plays UNMUTED and with pitch
   *  preservation forced on — the clock-follow effect trims its rate by up
   *  to ±3%, and an unpitched rate change would slide the key. Exercises
   *  never set this; it defaults to false (muted, no forced pitch setting). */
  mediaAudible?: boolean
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
  play,
  preview = false,
  mediaAudible = false,
}: ScoreExerciseGameProps) {
  const { t } = useTranslation()
  const completePerformance = useLessonActivity('performance')
  const playsense = usePlaysense()
  const frame = useLessonFrame()
  const inLesson = !!frame
  // Play opens with the staff and highway filling the stage and the teacher
  // video floating bottom right (24 % wide); the student can re-lay it out.
  // Remembered per staff layout, like watch (lmm-workspace:play:stacked / :horizontal).
  const [staffLayout, setStaffLayout] = useStaffLayoutPreference()
  const workspace = useWorkspaceLayout(`play:${staffLayout}`, PLAY_WORKSPACE)
  // Without a teacher video there is nothing to lay out: the music fills the
  // workspace (staff over highway), and the score's shape must not follow a
  // stored layout the student can neither see nor change here.
  const hasVideo = !!exerciseVideo
  const scoreWorkspace = useMemo(
    // Read-only: nothing here may rewrite the layout saved for exercises that do have a video.
    () => hasVideo ? workspace : {
      ...workspace, layout: 'music' as const, state: { ...workspace.state, layout: 'music' as const, swap: false },
      setLayout: () => {}, swap: () => {}, update: () => {}, beforeLayoutChangeRef: { current: null },
    },
    [hasVideo, workspace],
  )
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

  // --- Optional exercise video, following the engine clock ---
  // One element for the whole visit, created on first use and moved into the
  // workspace while the stage shows. An audible track (a jam) must be played
  // inside a click to satisfy Safari/iOS autoplay rules, and the Ready check
  // and Part done screens, where Start/Retry are clicked, show no media: the
  // element they prime has to be the one that plays afterwards.
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const videoUrl = exerciseVideo?.url ?? null
  const videoLabel = t('dashboard.classViewer.exercise.referenceVideo')
  const ensureMediaEl = useCallback((): HTMLVideoElement | null => {
    if (!videoUrl) return null
    const el = videoRef.current ?? document.createElement('video')
    videoRef.current = el
    applyMediaProps(el, videoUrl, mediaAudible, videoLabel)
    return el
  }, [videoUrl, mediaAudible, videoLabel])
  useEffect(() => {
    if (videoRef.current) ensureMediaEl()
  }, [ensureMediaEl])
  const mountMedia = useCallback((slot: HTMLDivElement | null) => {
    const el = slot ? ensureMediaEl() : null
    if (!slot || !el) return
    slot.appendChild(el)
    return () => { if (el.parentNode === slot) slot.removeChild(el) }
  }, [ensureMediaEl])

  // Safari/iOS may still refuse an audible play(): offer a tap to retry it.
  const [soundBlocked, setSoundBlocked] = useState(false)
  /** Play the audible track synchronously inside a click (Start, Retry, the
   *  notice), then pause it again: the follow loop positions and runs it. */
  const primeMedia = () => {
    if (!mediaAudible) return
    const v = ensureMediaEl()
    if (!v) return
    const wasPaused = v.paused
    const started = v.play()
    if (wasPaused) v.pause()
    setSoundBlocked(false)
    void started?.catch((err) => { if (isAutoplayRefusal(err)) setSoundBlocked(true) })
  }
  const start = () => { primeMedia(); void session.startExercise() }
  const loopSeconds = useMemo(() => getLoopDuration(exercise), [exercise])
  const exerciseDurationSec = loopSeconds * exercise.loopCount
  const countInBars = play?.countInBars ?? 1
  // Where the play-along shows bar 1: the published bar 1, else the trim
  // in-point (exerciseVideo.startSeconds IS the trim in-point; 040 folded the
  // old crop into it).
  const bar1 = exerciseVideo ? play?.bar1Seconds ?? exerciseVideo.startSeconds : null

  // Backing tracks. With a video they are placed against it, so on the clock
  // (video = bar 1 + engine) a clip starts at its timeline position less bar 1.
  // Students never read positionQn: live rows carry stale values. Without a
  // video, the timeline IS the score grid, placed exactly as before.
  const placedTracks = useMemo(
    () =>
      (backingTracks ?? []).map((track) => ({
        id: track.id,
        audioUrl: track.audioUrl,
        startSeconds: bar1 !== null
          ? track.timelineStartSeconds - bar1
          : timelineToEngineSeconds(
              track.timelineStartSeconds,
              null,
              { bpm: exercise.bpm, timeSignature: exercise.timeSignature, grid: exercise.grid },
              0
            ),
        trimInSeconds: track.trimInSeconds,
        trimOutSeconds: track.trimOutSeconds,
        gain: track.gain,
      })),
    [backingTracks, bar1, exercise.bpm, exercise.timeSignature, exercise.grid]
  )

  // An explicit (possibly empty) selection only when backing tracks are
  // authored; otherwise the legacy path (exercise.audioUrl) stays in charge.
  const liveSession = useExerciseSession(backingTracks ? { backingTracks: placedTracks, backingMix: mix, countInBars } : { countInBars })
  const demoExercises = useMemo(() => [exercise], [exercise])
  const demoSession = useStageDemoSession(demoExercises, preview)
  const session = preview ? { ...liveSession, ...demoSession.overrides } : liveSession
  const stableExercise = useMemo(() => exercise, [exercise])

  // Where the video shows bar 1 and how it behaves around the count-in.
  const playMedia = useMemo<PlayMedia | null>(() => exerciseVideo && bar1 !== null ? {
    bar1,
    trimIn: exerciseVideo.startSeconds,
    trimOut: exerciseVideo.trimOutSeconds ?? null,
    countInSeconds: getSessionCountInSeconds(exercise, countInBars),
    preroll: play?.preroll ?? true,
    loopSeconds,
  } : null, [exerciseVideo, bar1, play, exercise, countInBars, loopSeconds])

  // Each frame, ask where the video should be at the engine time and trim its
  // rate toward it (±3 %); hard-seek only on a large drift or a loop wrap.
  const getElapsedSeconds = session.getElapsedSeconds
  useEffect(() => {
    const v = videoRef.current
    if (!v || !playMedia) return
    const state = session.sessionState
    if (state !== 'countdown' && state !== 'playing') {
      if (!v.paused) v.pause()
      // Before a take, rest on the frame the take will start from.
      if (state === 'selecting') {
        const first = expectedMediaTime(playMedia, -playMedia.countInSeconds).media
        if (Math.abs(v.currentTime - first) > 0.05) v.currentTime = first
      }
      return
    }
    // The game has no student speed control today: the engine always runs at the score's tempo.
    const userSpeed = 1
    let raf = 0
    let lastPass: number | null = null
    // An audible track's element starts late (play() latency); the rate trim
    // would take seconds to close that, so it hard-seeks once it is running.
    let startSeek = mediaAudible
    const tick = () => {
      const e = getElapsedSeconds()
      const { media, playing } = expectedMediaTime(playMedia, e)
      const pass = e >= 0 && playMedia.loopSeconds > 0 ? Math.floor(e / playMedia.loopSeconds) : null
      const wrapped = pass !== null && lastPass !== null && pass !== lastPass
      lastPass = pass
      // The end of the file is a trim-out too: live passes can run past it.
      // Once known, fold the element's duration into the effective end.
      let endAt = playMedia.trimOut ?? Infinity
      if (Number.isFinite(v.duration)) endAt = Math.min(endAt, v.duration - 0.05)
      if (playing && media >= endAt) {
        // Hold the last frame until the next pass brings bar 1 back inside:
        // no play() (on an ended element it restarts from 0) and no seek.
        if (!v.paused) v.pause()
        startSeek = mediaAudible
      } else if (!playing) {
        if (!v.paused) v.pause()
        if (!v.seeking && Math.abs(v.currentTime - media) > 0.05) v.currentTime = media
        startSeek = mediaAudible
      } else {
        // A seek already in flight: let it land before correcting again.
        if (!v.seeking) {
          const { rate, seekTo } = followRate(media, v.currentTime, userSpeed)
          // The first frame an audible track is actually running: land it on
          // the clock at once (see startSeek).
          const startLag = startSeek && !v.paused && Math.abs(media - v.currentTime) > START_SEEK_SECONDS
          if (!v.paused) startSeek = false
          if (seekTo !== null || wrapped || v.ended || startLag) {
            v.currentTime = seekTo ?? media
            v.playbackRate = userSpeed
          } else if (Math.abs(v.playbackRate - rate) > 0.0005) {
            v.playbackRate = rate
          }
        }
        if (v.paused && !v.ended) {
          void v.play().catch((err) => { if (mediaAudible && isAutoplayRefusal(err)) setSoundBlocked(true) })
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    // No pause here: the next state's run decides (a count-in running into
    // bar 1 must not blip the pre-roll).
    return () => cancelAnimationFrame(raf)
  }, [session.sessionState, getElapsedSeconds, playMedia, mediaAudible])

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

  // Part done's comparison: the best saved take (fetched once; undefined while
  // it loads) and the best take finished earlier in this visit, frozen when a
  // take starts. The saved best stays live, so a late answer still lands.
  const [savedBest, setSavedBest] = useState<number | null | undefined>(preview ? null : undefined)
  const [visitBest, setVisitBest] = useState<number | null>(null)
  const [visitBaseline, setVisitBaseline] = useState<number | null>(null)
  useEffect(() => {
    if (preview) return
    let live = true
    getBestAttemptAccuracy(exercise.id)
      .then(best => { if (live) setSavedBest(best) })
      .catch(() => { if (live) setSavedBest(null) })
    return () => { live = false }
  }, [exercise.id, preview])
  useEffect(() => {
    if (session.sessionState === 'countdown') setVisitBaseline(visitBest)
  }, [session.sessionState, visitBest])
  useEffect(() => {
    if (session.sessionState === 'results' && session.attemptStats) setVisitBest(best => maxOrNull(best, session.attemptStats!.accuracy))
  }, [session.sessionState, session.attemptStats])

  // Finish take mid-pass: remember how far the take got, so the notes it never
  // reached are "not played" on Part done instead of missed.
  const [stoppedAt, setStoppedAt] = useState<number | null>(null)
  useEffect(() => {
    if (session.sessionState === 'countdown') setStoppedAt(null)
  }, [session.sessionState])
  const finishTake = () => {
    // Nothing has been played yet (still counting in): cancel back to the start, not a 0% Part done.
    if (session.sessionState === 'countdown') { session.retry(); return }
    setStoppedAt(Math.min(1, Math.max(0, session.playheadProgress)))
    session.stopExercise()
  }
  const playAgain = () => {
    session.retry()
    primeMedia()
    void session.startExercise()
  }

  // The input hooks report in English; show the ones we know in the student's language.
  const errorKey = audioErrorKey(session.audioError)
  const audioError = errorKey ? t(errorKey) : session.audioError

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
    start()
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
          micError={session.isListening ? null : audioError}
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
            onSkip={start}
            onClearCalibration={() => session.startCalibration()}
            audioMode={session.audioMode}
          />
        </div>
      </div>
    )
  }

  // Part done — the take's accuracy and a bar-by-bar strip
  if (session.sessionState === 'results' && session.attemptStats && session.exercise) {
    const reached = stoppedAt != null && stoppedAt < 1 ? stoppedAt : null
    // The ring shows what was played; the saved attempt keeps the engine's numbers.
    const shown = reached == null ? session.attemptStats
      : { ...computeStats(reachedResults(session.exercise, session.eventResults, reached), session.attemptStats.extraHits, session.attemptStats.durationSeconds) }
    return (
      <div className="ps-lesson-results">
        <PartDone
          stats={shown}
          bars={buildBarResults(session.exercise, session.eventResults, { reached })}
          previousBest={takeBaseline(savedBest, visitBaseline)}
          onAgain={playAgain}
          onContinue={frame ? frame.advance : undefined}
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
                            aria-label={t(entry.muted ? 'dashboard.classViewer.exercise.unmuteTrack' : 'dashboard.classViewer.exercise.muteTrack', { track: track.label })}
                            title={t(entry.muted ? 'dashboard.classViewer.exercise.unmute' : 'dashboard.classViewer.exercise.mute')}
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
                              aria-label={t('dashboard.classViewer.exercise.trackLevel', { track: track.label })}
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
                onReady={start}
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
      <ExerciseScoreWorkspaceBridge controller={scoreWorkspace}>
      <SplitWorkspace
        controller={workspace}
        frame="fill"
        // Only once the session is live: a paused video beside "Preparing…" reads as broken.
        media={exerciseVideo && showCanvas && (
          // The kept <video> (see ensureMediaEl): muted unless mediaAudible —
          // a jam's own track — and following the engine clock.
          <div ref={mountMedia} className="h-full min-h-0 w-full" data-exercise-media="" />
        )}
        music={hasStaff ? scoreEl : stageEl}
        highway={hasStaff ? stageEl : undefined}
        overlay={overlays}
      />
      </ExerciseScoreWorkspaceBridge>

      {mediaAudible && soundBlocked && isActive && (
        <div className="ps-lesson-sound-blocked flex items-center justify-between gap-3 border-t border-border bg-primary/5 px-4 py-2" role="status">
          <span className="text-xs text-muted-foreground">{t('dashboard.classViewer.exercise.enableSoundHint')}</span>
          <Button size="sm" variant="outline" onClick={primeMedia}>
            <Volume2 className="h-3.5 w-3.5" /> {t('dashboard.classViewer.exercise.enableSound')}
          </Button>
        </div>
      )}

      {preview && isActive && <div className="ps-lesson-preview-controls flex items-center justify-between gap-3 border-t border-border px-4 py-3">
        <span className="text-xs text-muted-foreground">{mediaAudible ? 'Demo · jam track · results are not saved' : 'Demo · muted video · results are not saved'}</span>
        <div className="flex gap-2"><Button size="sm" variant="outline" onClick={start}>Replay preview</Button><Button size="sm" onClick={demoSession.review}>View results</Button></div>
      </div>}

      {!preview && inLesson && session.exercise && isActive && !showAudioModePrompt && !showPlaysenseTest && (
        <LessonAction>
          <LessonTransport
            state={session.sessionState as 'selecting' | 'countdown' | 'playing' | 'paused'}
            bpm={session.exercise.bpm}
            countdownBeat={session.countdownBeat}
            click={session.audioMetronome}
            mix={mixer}
            onStart={start}
            onPause={session.pauseExercise}
            onResume={() => { primeMedia(); session.resumeExercise() }}
            onRestart={() => { primeMedia(); void session.restartExercise() }}
            onFinish={finishTake}
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
          onStart={start}
          onStop={finishTake}
          onPause={session.pauseExercise}
          onResume={() => { primeMedia(); session.resumeExercise() }}
          onRestart={() => { primeMedia(); void session.restartExercise() }}
          onCalibrate={session.startCalibration}
          onTestMic={session.testMic}
          onStopTestMic={session.stopTestMic}
          onNoisyRoomChange={session.setNoisyRoomMode}
          onAudioMetronomeChange={session.setAudioMetronome}
        />
        </div>
      )}

      {audioError && (
        <div className="m-4 p-3 rounded-xl border border-red-500/30 bg-destructive/10">
          <p className="text-sm text-muted-foreground">{audioError}</p>
        </div>
      )}
    </div>
  )
}

function maxOrNull(a: number | null, b: number | null): number | null {
  return a == null ? b : b == null ? a : Math.max(a, b)
}
