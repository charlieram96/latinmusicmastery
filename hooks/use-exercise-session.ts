'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { TIMING_TEST_ITEM } from '@/lib/playsense-studio/local-exercise-timing-reset'
import { readTimingCompensation } from '@/lib/audio/timing-compensation'
import type {
  ExerciseDefinition,
  OnsetEvent,
  SessionState,
  EventResult,
  AttemptStats,
  InstrumentCategory,
} from '@/lib/play-sense/types'
import { TOLERANCE_BY_DIFFICULTY, getInstrumentCategory } from '@/lib/play-sense/types'
import { gradeSingleOnset, gradeChordOnset, matchOnsetToExpected, computeStats, frequencyToMidi, orderSessionResults, currentComboForResults } from '@/lib/play-sense/scoring'
import type { ExpectedEvent } from '@/lib/play-sense/scoring'
import { generateExpectedTimestamps, getExerciseDuration, getLoopDuration, getSessionCountInSeconds } from '@/lib/play-sense/exercise-utils'
import { useOnsetDetection } from './use-onset-detection'
import { useMetronome } from './use-metronome'
import { useCalibration } from './use-calibration'
import type { BackingMix } from '@/lib/play-sense/backing-mix'
import { useBackingTrack, type PlacedBackingTrack } from './use-backing-track'
import { usePlaysenseOnsets } from './use-playsense-onsets'
import { useMidiOnsets } from './use-midi-onsets'
import { sessionLatencyMs } from '@/lib/audio/session-latency'
import { applyRhythmGrade } from '@/lib/play-sense/rhythm-grade'
import { evaluateRhythm } from '@/lib/play-sense/rhythm-evaluation'
import { audibleTime } from '@/lib/audio/audible-clock'
import { microphoneTiming, MIC_PRACTICE_ALLOWANCE_MS } from '@/lib/play-sense/microphone-timing'
import { consumeOnsets } from '@/lib/play-sense/input-events'

import { availableInputModes, type AudioMode } from '@/lib/play-sense/input-modes'
export type { AudioMode } from '@/lib/play-sense/input-modes'

const AUDIO_MODE_STORAGE_KEY = 'playSenseAudioMode'

// Wait for the worklet's post-strum chroma (~80 ms) to arrive before grading a chord.
const CHORD_GRADE_DELAY_MS = 95

/**
 * The count-in display's current number, counting DOWN from `countInBeats`
 * to 1 as `elapsed` (seconds since the count-in started) advances one
 * `beatSec` at a time. Clamped to `[0, countInBeats]`: 0 before the count-in
 * has started (a scheduling tick can land a hair before `elapsed` reaches 0)
 * and 0 once it has finished — callers only display a positive value.
 */
export function countdownFor(elapsed: number, countInBeats: number, beatSec: number): number {
  if (beatSec <= 0 || countInBeats <= 0 || elapsed < 0) return 0
  const beatIndex = Math.floor(elapsed / beatSec)
  return Math.max(0, Math.min(countInBeats, countInBeats - beatIndex))
}

function loadStoredAudioMode(): AudioMode | null {
  if (typeof window === 'undefined') return null
  let stored: string | null = null
  try { stored = localStorage.getItem(AUDIO_MODE_STORAGE_KEY) } catch { return null }
  if (stored === 'headphones' || stored === 'speaker-safe' || stored === 'playsense' || stored === 'midi') return stored
  return null
}

interface UseExerciseSessionResult {
  // State
  sessionState: SessionState
  exercise: ExerciseDefinition | null
  eventResults: EventResult[]
  attemptStats: AttemptStats | null
  countdownBeat: number

  // Audio mode
  audioMode: AudioMode | null
  setAudioMode: (mode: AudioMode) => void
  clearAudioMode: () => void

  // Audio state
  isListening: boolean
  hasPermission: boolean | null
  audioError: string | null
  inputLevel: number
  inputPeak: number
  getLiveAudioInput: () => import('@/lib/audio/live-audio-input').LiveAudioInput | null
  micDevices: MediaDeviceInfo[]
  micDeviceId: string
  micDeviceLabel: string | null
  micMuted: boolean
  selectMicDevice: (id: string) => Promise<void>
  toggleMicMute: () => void
  micOnsets: OnsetEvent[]
  setMicDetectionFloor: (value: number | null, sampling?: boolean) => void
  noisyRoomMode: boolean

  // Calibration
  calibrationData: ReturnType<typeof useCalibration>['calibrationData']
  isCalibrating: boolean
  calibrationBeat: number
  calibrationVisual: ReturnType<typeof useCalibration>['calibrationVisual']
  getTimingElapsed: ReturnType<typeof useCalibration>['getTimingElapsed']
  timingHits: ReturnType<typeof useCalibration>['timingHits']
  cancelCalibration: () => void
  totalCalibrationBeats: number
  calibrationError: string | null

  // Backing track
  backingTrackLoading: boolean
  backingTrackLoaded: boolean

  // Metronome
  metronomeBeat: number
  metronomeDownbeat: boolean
  audioMetronome: boolean
  setAudioMetronome: (enabled: boolean) => void

  // Playhead
  playheadProgress: number // 0-1
  getElapsedSeconds: () => number

  // Live scoring
  currentScore: number
  currentCombo: number
  currentAccuracy: number
  detectedHitCount: number
  tempoDrift: number
  lastHitGrade: string | null
  detectedMidiNote: number | null

  // Mic testing
  isMicTesting: boolean
  testMic: () => void
  stopTestMic: () => void

  // Actions
  selectExercise: (exercise: ExerciseDefinition) => void
  startCalibration: () => void
  startExercise: () => void
  stopExercise: () => void
  /** Freeze the attempt in place: the shared AudioContext is suspended, so the
   *  clock, click, backing tracks and input all stop together. */
  seekExercise: (seconds: number) => void
  pauseExercise: () => void
  resumeExercise: () => void
  /** Discard the attempt (no grading) and run a fresh count-in with the same setup. */
  restartExercise: () => Promise<void>
  retry: () => void
  goToSelect: () => void
  setNoisyRoomMode: (enabled: boolean) => void
}

export interface UseExerciseSessionOptions {
  /** Initial click state when entering a new exercise. */
  defaultAudioMetronome?: boolean
  metronomeVolume?: number
  playbackRate?: number
  /**
   * Explicit backing-track URLs (course exercises: the student's selected
   * instrument tracks). When provided — even as an empty array — this wins over
   * the legacy single `exercise.audioUrl`. Every track starts at the engine's
   * t0, untrimmed.
   *
   * @deprecated Prefer `backingTracks`, which carries the position and trim the
   * admin set in the studio. Kept so callers that never place tracks (and the
   * legacy single-audio path) keep working unchanged.
   */
  backingTrackUrls?: string[]
  /**
   * Backing tracks with their studio placement already converted to engine
   * seconds. Wins over `backingTrackUrls` when present.
   */
  backingTracks?: PlacedBackingTrack[]
  /** The student's own level/mute per backing track id; applied live. */
  backingMix?: BackingMix
  /**
   * Count-in length in bars for graded owners (a score with `exercise.grid`).
   * Ignored without a grid, where the count-in is always one bar, as before.
   */
  countInBars?: 1 | 2
  /** Playback-only preview: use an output clock without opening an input device. */
  playbackOnly?: boolean
}

export function useExerciseSession(options: UseExerciseSessionOptions = {}): UseExerciseSessionResult {
  const previewContext = useRef<AudioContext | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  useEffect(() => () => { void previewContext.current?.close().catch(() => {}) }, [])
  const [sessionState, setSessionState] = useState<SessionState>('idle')
  const [audioMode, setAudioModeState] = useState<AudioMode | null>(null)
  const [exercise, setExercise] = useState<ExerciseDefinition | null>(null)
  const [eventResults, setEventResults] = useState<EventResult[]>([])
  const [attemptStats, setAttemptStats] = useState<AttemptStats | null>(null)
  const [countdownBeat, setCountdownBeat] = useState(0)
  const [noisyRoomMode, setNoisyRoomMode] = useState(false)
  const [audioMetronome, setAudioMetronome] = useState(options.defaultAudioMetronome ?? false)
  const [playheadProgress, setPlayheadProgress] = useState(0)
  const [currentScore, setCurrentScore] = useState(0)
  const [currentCombo, setCurrentCombo] = useState(0)
  const [currentAccuracy, setCurrentAccuracy] = useState(0)
  const [tempoDrift, setTempoDrift] = useState(0)
  const [lastHitGrade, setLastHitGrade] = useState<string | null>(null)
  const [detectedMidiNote, setDetectedMidiNote] = useState<number | null>(null)
  const lastDetectedMidiRef = useRef<number | null>(null)

  const seekPositionRef = useRef<number | null>(null)
  const expectedEventsRef = useRef<ExpectedEvent[]>([])
  const matchedIndicesRef = useRef<Set<number>>(new Set())
  const extraHitsRef = useRef(0)
  const micLatencyRef = useRef(0)
  const manualMicTimingTestRef = useRef(false)
  const presetMicTimingRef = useRef(false)
  const observedTimesRef = useRef<number[]>([])
  const exerciseStartTimeRef = useRef(0)
  const exerciseDurationRef = useRef(0)
  const singleLoopDurationRef = useRef(0)
  const sessionStateRef = useRef<SessionState>('idle')
  const rafRef = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const eventResultsRef = useRef<EventResult[]>([])
  const seenOnsetsRef = useRef(new WeakSet<import('@/lib/play-sense/types').OnsetEvent>())
  const sessionGenerationRef = useRef(0)
  const startingRef = useRef(false)
  const finishExerciseRef = useRef<() => void>(() => {})
  const lastUiUpdateRef = useRef(0)
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const liveComboRef = useRef(0)
  const lastMissCheckIndexRef = useRef(0)
  const calibrationDataRef = useRef<import('@/lib/play-sense/types').CalibrationData | null>(null)
  const exerciseDifficultyRef = useRef<import('@/lib/play-sense/types').Difficulty>('beginner')
  // Sustain tracking: maps eventIndex -> { onsetTime, expectedDurationSec }
  const sustainTrackingRef = useRef<Map<number, { onsetTime: number; expectedDurationSec: number }>>(new Map())
  const lastInputLevelRef = useRef(0)
  const missDetectedIndicesRef = useRef<Set<number>>(new Set())
  // Deferred pitch grading: pending timeouts for pitched onsets where pitch was null at onset time
  const pendingPitchTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  const [micMuted, setMicMuted] = useState(false)
  const micAudioMode = (audioMode === 'headphones' || audioMode === 'speaker-safe') ? audioMode : undefined
  const micOnsets = useOnsetDetection({ noisyRoomMode, instrument: exercise?.instrument, audioMode: micAudioMode })
  const bleOnsets = usePlaysenseOnsets(exercise?.instrument ?? null)

  const midiOnsets = useMidiOnsets()
  const isMidiMode = audioMode === 'midi'
  const isPlaysenseMode = audioMode === 'playsense'
  const activeOnsets = isMidiMode ? midiOnsets : isPlaysenseMode ? bleOnsets : micOnsets

  const {
    isListening,
    hasPermission,
    error: audioError,
    inputLevel,
    recentOnsets,
    startListening,
    stopListening,
    clearOnsets,
  } = activeOnsets

  const chromaByOnsetRef = micOnsets.chromaByOnsetRef
  const getFrequency = micOnsets.getFrequency
  const stopMicListening = micOnsets.stopListening
  const stopBleListening = bleOnsets.stopListening
  const stopMidiListening = midiOnsets.stopListening

  const countInBeats = exercise?.timeSignature?.[0] || 4
  const countInBars = options.countInBars ?? 1
  const metronome = useMetronome({
    volume: options.metronomeVolume,
    bpm: exercise?.bpm || 100,
    timeSignature: exercise?.timeSignature || [4, 4],
    countInBeats,
    grid: exercise?.grid,
    countInBars,
    silent: !audioMetronome,
  })

  // Keep metronome silent state in sync at runtime
  const handleSetAudioMetronome = useCallback((enabled: boolean) => {
    setAudioMetronome(enabled)
    metronome.setSilent(!enabled)
  }, [metronome])

  const calibration = useCalibration()

  const backingTrackAudioMode = (audioMode === 'headphones' || audioMode === 'speaker-safe') ? audioMode : undefined
  const backingTrackUrls =
    options.backingTrackUrls ?? (exercise?.audioUrl ? [exercise.audioUrl] : [])
  const backingTrack = useBackingTrack({
    playbackRate: options.playbackRate,
    tracks: options.backingTracks,
    audioUrls: options.backingTracks ? undefined : backingTrackUrls,
    mix: options.backingMix,
    audioMode: backingTrackAudioMode,
    // Placed clips must repeat with the exercise, or a looping exercise would
    // hear them only on the first pass. loopCount is 1 in production today.
    // Derived here rather than read from singleLoopDurationRef, which is only
    // populated once the session starts — after this render.
    loopDurationSeconds: exercise ? getLoopDuration(exercise) : undefined,
    loopCount: exercise?.loopCount ?? 1,
  })

  // Microphone pitch analysis runs in its worklet on the same stream and clock.
  const instrumentCategoryRef = useRef<InstrumentCategory>('percussion')

  // Load stored audio mode and calibration on mount
  useEffect(() => {
    const stored = loadStoredAudioMode()
    if (stored) setAudioModeState(stored)
    calibration.loadStoredCalibration()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the calibration hook's active source type aligned with the chosen audio mode
  // so calibrationData returns the right record.
  useEffect(() => {
    calibration.setActiveSourceType(audioMode === 'playsense' ? 'ble' : 'mic')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioMode])

  const clearAudioMode = useCallback(() => {
    setAudioModeState(null)
    try { localStorage.removeItem(AUDIO_MODE_STORAGE_KEY) } catch { /* optional preference */ }
  }, [])

  const setAudioMode = useCallback((mode: AudioMode) => {
    if (mode === audioMode) return
    if (sessionStateRef.current === 'playing' || sessionStateRef.current === 'countdown') return
    stopMicListening(); stopBleListening(); stopMidiListening()
    audioCtxRef.current = null
    setAudioModeState(mode)
    try { localStorage.setItem(AUDIO_MODE_STORAGE_KEY, mode) } catch { /* optional preference */ }
  }, [stopMicListening, stopBleListening, stopMidiListening, audioMode])

  // Mic testing — opens the mic so user can see level meter without starting an exercise
  const [isMicTesting, setIsMicTesting] = useState(false)

  const testMic = useCallback(async () => {
    setMicMuted(false)
    let audioCtx: AudioContext | null = null
    try {
      if (options.playbackOnly) {
        previewContext.current ??= new AudioContext()
        audioCtx = previewContext.current
        await audioCtx.resume()
        setPreviewError(null)
      } else {
        audioCtx = await startListening()
      }
    } catch (error) {
      startingRef.current = false
      setPreviewError(error instanceof Error ? error.message : 'Audio playback could not start.')
      return
    }
    if (audioCtx) {
      audioCtxRef.current = audioCtx
      setIsMicTesting(true)
    }
  }, [startListening])

  // The mic wizard remains on Ready check after Timing, ready for instrument hits.
  const wasCalibrating = useRef(false)
  useEffect(() => {
    if (wasCalibrating.current && audioMode !== 'playsense' && audioMode !== 'midi' && sessionState === 'calibrating' && !calibration.isCalibrating) {
      sessionStateRef.current = 'selecting'
      setSessionState('selecting')
    }
    wasCalibrating.current = calibration.isCalibrating
  }, [audioMode, sessionState, calibration.isCalibrating])

  const stopTestMic = useCallback(() => {
    stopListening()
    setIsMicTesting(false)
  }, [stopListening])

  // Keep sessionStateRef in sync so rAF callback reads latest value
  useEffect(() => { sessionStateRef.current = sessionState }, [sessionState])

  // Keep refs in sync for rAF callback access
  useEffect(() => {
    calibrationDataRef.current = audioMode === 'playsense' ? calibration.calibrationData : null
  }, [calibration.calibrationData, audioMode])

  useEffect(() => {
    if (exercise) {
      exerciseDifficultyRef.current = exercise.difficulty
      instrumentCategoryRef.current = getInstrumentCategory(exercise.instrument)
    }
  }, [exercise])

  // Keep input level ref in sync for sustain tracking
  useEffect(() => {
    lastInputLevelRef.current = inputLevel
  }, [inputLevel])

  // Process new onsets during playing
  useEffect(() => {
    if (sessionState !== 'playing' || !exercise) return

    const calibOffset = isPlaysenseMode ? (calibration.calibrationData?.latencyMs || 0) / 1000 : !isMidiMode ? micLatencyRef.current / 1000 : 0
    const widenMs = isPlaysenseMode ? (calibration.calibrationData && calibration.calibrationData.iqrMs > 30 ? 15 : 0) : !isMidiMode && getInstrumentCategory(exercise.instrument) === 'percussion' ? MIC_PRACTICE_ALLOWANCE_MS : 0

    const earliestOnset = exerciseStartTimeRef.current + calibOffset - (TOLERANCE_BY_DIFFICULTY[exercise.difficulty].ok + widenMs) / 1000
    const newOnsets = consumeOnsets(recentOnsets, seenOnsetsRef.current, earliestOnset)
    if (newOnsets.length === 0) return
    observedTimesRef.current.push(...newOnsets.map(onset => onset.timestamp - exerciseStartTimeRef.current - calibOffset))
    const category = getInstrumentCategory(exercise.instrument)
    const publishResults = (grade: string) => {
      eventResultsRef.current = orderSessionResults(eventResultsRef.current, expectedEventsRef.current)
      liveComboRef.current = currentComboForResults(eventResultsRef.current)
      setEventResults(eventResultsRef.current)
      setLastHitGrade(grade)
      setCurrentCombo(liveComboRef.current)
      const rawStats = computeStats(eventResultsRef.current, extraHitsRef.current, 0)
      const stats = !isMidiMode && !isPlaysenseMode && instrumentCategoryRef.current === 'percussion' ? applyRhythmGrade(rawStats) : rawStats
      setCurrentScore(stats.score)
      setCurrentAccuracy(stats.accuracy)
      setTempoDrift(stats.tempoDriftMs)
    }

    for (const onset of newOnsets) {
      // Chord routing: if this onset lands on a chord-group event, reserve the
      // whole group now (so later onsets / miss-detection skip it) and defer
      // grading briefly to await the worklet's post-strum chroma, then grade the
      // group as a set.
      if (category === 'pitched' && !isMidiMode) {
        const relTs = onset.timestamp - exerciseStartTimeRef.current
        const cand = matchOnsetToExpected(
          relTs,
          expectedEventsRef.current,
          matchedIndicesRef.current,
          exercise.difficulty,
          calibOffset,
          widenMs
        )
        if (cand?.chordId) {
          const chordId = cand.chordId
          const onsetTs = onset.timestamp
          const energy = onset.energy
          // Reserve the group so subsequent onsets and the rAF miss-detector skip it.
          const group = (expectedEventsRef.current).filter(
            e => e.chordId === chordId
          )
          for (const e of group) matchedIndicesRef.current.add(e.eventIndex)

          const timer = setTimeout(() => {
            pendingPitchTimersRef.current.delete(timer)
            if (sessionStateRef.current !== 'playing') return

            const chroma = chromaByOnsetRef.current.get(Math.round(onsetTs * 1000)) ?? null
            const results = gradeChordOnset(
              onsetTs - exerciseStartTimeRef.current,
              energy,
              expectedEventsRef.current,
              matchedIndicesRef.current,
              chordId,
              exercise.difficulty,
              calibOffset,
              widenMs,
              chroma
            )
            if (results.length === 0) return

            // Replace any tentative misses recorded for these events.
            for (const r of results) {
              if (missDetectedIndicesRef.current.has(r.eventIndex)) {
                missDetectedIndicesRef.current.delete(r.eventIndex)
                eventResultsRef.current = eventResultsRef.current.filter(
                  er => !(er.eventIndex === r.eventIndex && er.grade === 'miss')
                )
              }
            }

            eventResultsRef.current = [...eventResultsRef.current, ...results]
            publishResults(results[0].grade)
          }, CHORD_GRADE_DELAY_MS)
          pendingPitchTimersRef.current.add(timer)
          continue
        }
      }

      // For pitched instruments, use frequency from onset if available,
      // otherwise read a fresh pitch-worklet value from the same input stream.
      const pitchFreq = onset.frequency ?? getFrequency() ?? null
      const detectedMidi = category === 'pitched'
        ? (onset.midiNote ?? (pitchFreq ? frequencyToMidi(pitchFreq) : undefined))
        : undefined
      const detectedFreq = category === 'pitched'
        ? (pitchFreq ?? undefined)
        : undefined

      // If pitched instrument and no pitch detected, defer grading by 100ms
      // to allow the note to stabilize before pitch detection
      if (category === 'pitched' && detectedMidi == null) {
        const deferredOnset = { ...onset }
        const timer = setTimeout(() => {
          pendingPitchTimersRef.current.delete(timer)
          if (sessionStateRef.current !== 'playing') return

          // Re-read pitch after 100ms delay
          const delayedFreq = getFrequency() ?? null
          const delayedMidi = delayedFreq ? frequencyToMidi(delayedFreq) : undefined

          const deferredResult = gradeSingleOnset(
            deferredOnset.timestamp - exerciseStartTimeRef.current,
            deferredOnset.energy,
            expectedEventsRef.current,
            matchedIndicesRef.current,
            exercise.difficulty,
            calibOffset,
            widenMs,
            category,
            delayedMidi,
            delayedFreq ?? undefined,
            deferredOnset.surface ?? undefined
          )

          if (deferredResult) {
            if (missDetectedIndicesRef.current.has(deferredResult.eventIndex)) {
              missDetectedIndicesRef.current.delete(deferredResult.eventIndex)
              eventResultsRef.current = eventResultsRef.current.filter(
                r => !(r.eventIndex === deferredResult.eventIndex && r.grade === 'miss')
              )
            }

            eventResultsRef.current = [...eventResultsRef.current, deferredResult]
            publishResults(deferredResult.grade)
          } else {
            extraHitsRef.current++
          }
        }, 100)
        pendingPitchTimersRef.current.add(timer)
        continue
      }

      const result = gradeSingleOnset(
        onset.timestamp - exerciseStartTimeRef.current,
        onset.energy,
        expectedEventsRef.current,
        matchedIndicesRef.current,
        exercise.difficulty,
        calibOffset,
        widenMs,
        category,
        detectedMidi,
        detectedFreq,
        onset.surface ?? undefined,
        isMidiMode ? 'midi' : 'microphone'
      )

      if (result) {
        // If this onset matched an event previously marked as a tentative miss,
        // remove the tentative miss result so the real hit takes its place
        if (missDetectedIndicesRef.current.has(result.eventIndex)) {
          missDetectedIndicesRef.current.delete(result.eventIndex)
          eventResultsRef.current = eventResultsRef.current.filter(
            r => !(r.eventIndex === result.eventIndex && r.grade === 'miss')
          )
        }

        // Start sustain tracking for pitched instruments with duration > 0
        if (category === 'pitched') {
          const matchedExpected = expectedEventsRef.current.find(
            e => e.eventIndex === result.eventIndex
          )
          if (matchedExpected && (matchedExpected as import('@/lib/play-sense/scoring').ExpectedEvent).expectedDurationSec) {
            sustainTrackingRef.current.set(result.eventIndex, {
              onsetTime: onset.timestamp,
              expectedDurationSec: (matchedExpected as import('@/lib/play-sense/scoring').ExpectedEvent).expectedDurationSec!,
            })
          }
        }

        eventResultsRef.current = [...eventResultsRef.current, result]
        publishResults(result.grade)
      } else {
        extraHitsRef.current++
      }
    }
  }, [recentOnsets, sessionState, exercise, calibration.calibrationData, isMidiMode, isPlaysenseMode, chromaByOnsetRef, getFrequency])

  // Playhead animation and exercise end detection
  const updatePlayhead = useCallback(() => {
    if (!audioCtxRef.current || sessionStateRef.current !== 'playing') return

    const currentTime = audioCtxRef.current.currentTime
    const elapsed = currentTime - exerciseStartTimeRef.current
    const overallProgress = Math.min(elapsed / exerciseDurationRef.current, 1)

    if (currentTime - lastUiUpdateRef.current >= 1 / 30 || overallProgress >= 1) {
      setPlayheadProgress(Math.max(0, overallProgress))
      lastUiUpdateRef.current = currentTime
    }

    // Update detected MIDI note for visualization (pitched instruments only)
    if (instrumentCategoryRef.current === 'pitched') {
      const freq = getFrequency()
      const midi = freq ? frequencyToMidi(freq) : null
      if (midi !== lastDetectedMidiRef.current) {
        lastDetectedMidiRef.current = midi
        setDetectedMidiNote(midi)
      }
    }

    // Resolve sustain tracking: when input level drops or expected duration passes
    const SUSTAIN_SILENCE_THRESHOLD = 0.005
    const currentInputLevel = lastInputLevelRef.current
    for (const [eventIndex, tracking] of sustainTrackingRef.current.entries()) {
      const heldSec = currentTime - tracking.onsetTime
      // Resolve if silence detected or held past 150% of expected duration
      if (currentInputLevel < SUSTAIN_SILENCE_THRESHOLD || heldSec > tracking.expectedDurationSec * 1.5) {
        eventResultsRef.current = eventResultsRef.current.map(r =>
          r.eventIndex === eventIndex
            ? { ...r, durationHeld: Math.round(heldSec * 100) / 100 }
            : r
        )
        sustainTrackingRef.current.delete(eventIndex)
      }
    }

    // Detect missed events in real-time: any unmatched event whose ok window has passed
    // Use missDetectedIndicesRef (not matchedIndicesRef) so gradeSingleOnset can still
    // match late onsets that arrive after the miss window
    const calibOffset = (isPlaysenseMode ? calibrationDataRef.current?.latencyMs || 0 : !isMidiMode ? micLatencyRef.current : 0) / 1000
    const difficulty = exerciseDifficultyRef.current
    const okWindowSec = (TOLERANCE_BY_DIFFICULTY[difficulty].ok + 200) / 1000 // generous buffer for late hits
    const correctedTime = elapsed - calibOffset
    const expected = expectedEventsRef.current
    let missDetected = false

    for (let i = lastMissCheckIndexRef.current; i < expected.length; i++) {
      const evt = expected[i]
      if (correctedTime < evt.timestamp + okWindowSec) break
      if (matchedIndicesRef.current.has(evt.eventIndex) || missDetectedIndicesRef.current.has(evt.eventIndex)) {
        lastMissCheckIndexRef.current = i + 1
        continue
      }
      // This event was tentatively missed — record it but don't block gradeSingleOnset
      const missResult: EventResult = {
        eventIndex: evt.eventIndex,
        grade: 'miss',
        offsetMs: null,
        timing: null,
        onsetEnergy: null,
        pitchCorrect: evt.expectedPitch != null ? false : null,
      }
      eventResultsRef.current = [...eventResultsRef.current, missResult]
      missDetectedIndicesRef.current.add(evt.eventIndex)
      liveComboRef.current = 0
      missDetected = true
      lastMissCheckIndexRef.current = i + 1
    }

    if (missDetected) {
      eventResultsRef.current = orderSessionResults(eventResultsRef.current, expectedEventsRef.current)
      liveComboRef.current = currentComboForResults(eventResultsRef.current)
      setEventResults(eventResultsRef.current)
      setCurrentCombo(liveComboRef.current)
      setLastHitGrade('miss')
      const rawStats = computeStats(eventResultsRef.current, extraHitsRef.current, 0)
      const stats = !isMidiMode && !isPlaysenseMode && instrumentCategoryRef.current === 'percussion' ? applyRhythmGrade(rawStats) : rawStats
      setCurrentScore(stats.score)
      setCurrentAccuracy(stats.accuracy)
    }

    // Let final-note input delivery and deferred pitch analysis finish before closing.
    if (elapsed >= exerciseDurationRef.current + 0.35) {
      finishExerciseRef.current()
      return
    }

    rafRef.current = requestAnimationFrame(updatePlayhead)
  }, [getFrequency, isMidiMode, isPlaysenseMode])

  const finishExercise = useCallback(() => {
    if (sessionStateRef.current === 'results') return
    sessionStateRef.current = 'results'
    sessionGenerationRef.current++
    startingRef.current = false
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }

    // Flush pending deferred pitch checks — clear timers so callbacks don't fire
    for (const timer of pendingPitchTimersRef.current) {
      clearTimeout(timer)
    }
    pendingPitchTimersRef.current.clear()

    metronome.stopMetronome()
    backingTrack.stopPlayback()

    // Build authoritative results: deduplicate by eventIndex, preferring
    // non-miss grades over miss when duplicates exist (race condition safety net)
    const resultsByIndex = new Map<number, EventResult>()
    for (const r of eventResultsRef.current) {
      const existing = resultsByIndex.get(r.eventIndex)
      if (!existing || (existing.grade === 'miss' && r.grade !== 'miss')) {
        resultsByIndex.set(r.eventIndex, r)
      }
    }

    // Fill in any expected events that have no result as misses
    for (const expected of expectedEventsRef.current) {
      if (!resultsByIndex.has(expected.eventIndex)) {
        resultsByIndex.set(expected.eventIndex, {
          eventIndex: expected.eventIndex,
          grade: 'miss',
          offsetMs: null,
          timing: null,
          onsetEnergy: null,
          pitchCorrect: expected.expectedPitch != null ? false : null,
        })
      }
    }

    // Musical order is independent of how the author stored events.
    const timeByIndex = new Map(expectedEventsRef.current.map(e => [e.eventIndex, e.timestamp]))
    const allResults = Array.from(resultsByIndex.values())
    allResults.sort((a, b) => (timeByIndex.get(a.eventIndex) ?? 0) - (timeByIndex.get(b.eventIndex) ?? 0) || a.eventIndex - b.eventIndex)

    const duration = audioCtxRef.current
      ? audioCtxRef.current.currentTime - exerciseStartTimeRef.current
      : exerciseDurationRef.current

    let stats = computeStats(allResults, extraHitsRef.current, duration)
    if (!isMidiMode && !isPlaysenseMode && instrumentCategoryRef.current === 'percussion') {
      const rhythm = evaluateRhythm(expectedEventsRef.current.map(event => event.timestamp), observedTimesRef.current, microphoneTiming(exerciseDifficultyRef.current).good)
      stats.micLatencyMs = micLatencyRef.current
      stats.manualMicTimingTest = manualMicTimingTestRef.current
      stats.presetMicTiming = presetMicTimingRef.current
      stats.rhythm = rhythm
      stats = applyRhythmGrade(stats)
    }

    setEventResults(allResults)
    setAttemptStats(stats)
    setSessionState('results')
    // A validated loopback belongs to this exact stream/context. Keep it alive
    // for another take; stopping here silently discarded compensation on retry.
    const keepCalibratedMic = !isMidiMode && !isPlaysenseMode && sessionLatencyMs(micOnsets.getLiveAudioInput?.()) !== null
    if (!keepCalibratedMic) stopListening()
  }, [metronome, stopListening, backingTrack, isMidiMode, isPlaysenseMode, micOnsets.getLiveAudioInput])

  useEffect(() => { finishExerciseRef.current = finishExercise }, [finishExercise])

  const cancelSession = useCallback((keepCalibratedInput = false) => {
    sessionGenerationRef.current++
    startingRef.current = false
    sessionStateRef.current = 'idle'
    calibration.cancelCalibration()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    countdownIntervalRef.current = null
    for (const timer of pendingPitchTimersRef.current) clearTimeout(timer)
    pendingPitchTimersRef.current.clear()
    metronome.stopMetronome()
    backingTrack.stopPlayback()
    const keepInput = keepCalibratedInput && !isMidiMode && !isPlaysenseMode && sessionLatencyMs(micOnsets.getLiveAudioInput?.()) !== null
    if (!keepInput) {
      stopListening()
      audioCtxRef.current = null
    }
  }, [metronome, backingTrack, stopListening, calibration, isMidiMode, isPlaysenseMode, micOnsets.getLiveAudioInput])

  const selectExercise = useCallback((ex: ExerciseDefinition) => {
    cancelSession()
    seekPositionRef.current = null
    setExercise(ex)
    if (options.defaultAudioMetronome !== undefined) setAudioMetronome(options.defaultAudioMetronome)
    setSessionState('selecting')
    setEventResults([])
    setAttemptStats(null)
    setPlayheadProgress(0)
    sessionStateRef.current = 'selecting'
    // Saved input choice must support the newly selected instrument.
    if (audioMode && !availableInputModes(ex.instrument).includes(audioMode)) clearAudioMode()
  }, [cancelSession, audioMode, clearAudioMode, options.defaultAudioMetronome])

  const startCalibrationFlow = useCallback(async () => {
    if (audioMode === 'midi') return
    const generation = ++sessionGenerationRef.current
    setSessionState('calibrating')

    if (audioMode === 'playsense') {
      // BLE calibration — we still need an AudioContext for the count-in metronome,
      // but the onset source is the PlaySense device.
      let audioCtx = audioCtxRef.current
      if (!audioCtx || audioCtx.state === 'closed') {
        audioCtx = new AudioContext()
        audioCtxRef.current = audioCtx
      } else if (audioCtx.state === 'suspended') {
        await audioCtx.resume()
      }
      calibration.startCalibration(audioCtx, {
        type: 'ble',
        subscribeToHits: bleOnsets.subscribeToHits,
      })
    } else {
      let audioCtx: AudioContext | null = null
    try {
      if (options.playbackOnly) {
        previewContext.current ??= new AudioContext()
        audioCtx = previewContext.current
        await audioCtx.resume()
        setPreviewError(null)
      } else {
        audioCtx = await startListening()
      }
    } catch (error) {
      startingRef.current = false
      setPreviewError(error instanceof Error ? error.message : 'Audio playback could not start.')
      return
    }
      if (generation !== sessionGenerationRef.current) return
      if (audioCtx) {
        audioCtxRef.current = audioCtx
        calibration.startCalibration(audioCtx, {
          type: 'mic',
          workletNode: micOnsets.getWorkletNode(),
        })
      }
    }
  }, [startListening, calibration, audioMode, bleOnsets, micOnsets])

  const startExercise = useCallback(async () => {
    if (!exercise || startingRef.current || sessionStateRef.current === 'playing' || sessionStateRef.current === 'countdown') return
    startingRef.current = true
    const generation = ++sessionGenerationRef.current

    // Clear mic test state if active
    setIsMicTesting(false)

    // Reset state
    setEventResults([])
    eventResultsRef.current = []
    setAttemptStats(null)
    setPlayheadProgress(0)
    setCurrentScore(0)
    setCurrentCombo(0)
    setCurrentAccuracy(0)
    setTempoDrift(0)
    setLastHitGrade(null)
    matchedIndicesRef.current = new Set()
    missDetectedIndicesRef.current = new Set()
    extraHitsRef.current = 0
    observedTimesRef.current = []
    seenOnsetsRef.current = new WeakSet()
    lastUiUpdateRef.current = 0
    liveComboRef.current = 0
    lastMissCheckIndexRef.current = 0
    sustainTrackingRef.current.clear()
    for (const timer of pendingPitchTimersRef.current) clearTimeout(timer)
    pendingPitchTimersRef.current.clear()
    clearOnsets()

    // The input source owns its AudioContext; always activate that source.
    // A calibration-only context must never bypass microphone/BLE/MIDI startup.
    let audioCtx: AudioContext | null = null
    try {
      if (options.playbackOnly) {
        previewContext.current ??= new AudioContext()
        audioCtx = previewContext.current
        await audioCtx.resume()
        setPreviewError(null)
      } else {
        audioCtx = await startListening()
      }
    } catch (error) {
      startingRef.current = false
      setPreviewError(error instanceof Error ? error.message : 'Audio playback could not start.')
      return
    }
    if (generation !== sessionGenerationRef.current) return
    startingRef.current = false
    if (!audioCtx) return
    audioCtxRef.current = audioCtx

    // Explicit, reversible local experiment requested by the owner. Replace,
    // never add to, the hardware correction; do not record it as calibration.
    const presetMs = !isMidiMode && !isPlaysenseMode && !options.playbackOnly ? readTimingCompensation(micOnsets.getLiveAudioInput?.(), audioMode) : null
    presetMicTimingRef.current = presetMs !== null
    manualMicTimingTestRef.current = presetMs === null && process.env.NODE_ENV === 'development' && exercise.id === TIMING_TEST_ITEM && !isMidiMode && !isPlaysenseMode && !options.playbackOnly
    micLatencyRef.current = presetMs ?? (manualMicTimingTestRef.current ? 125
      : !isMidiMode && !isPlaysenseMode ? sessionLatencyMs(micOnsets.getLiveAudioInput?.()) ?? 0 : 0
    )
    // Generate expected events
    expectedEventsRef.current = generateExpectedTimestamps(exercise)
    exerciseDurationRef.current = getExerciseDuration(exercise)

    // Compute single loop duration for playhead looping
    const beatsPerMeasure = exercise.timeSignature[0]
    singleLoopDurationRef.current = getLoopDuration(exercise)

    // Start countdown
    sessionStateRef.current = 'countdown'
    setSessionState('countdown')
    setCountdownBeat(0)
    // With a grid (a graded owner), the count-in spans `countInBars` at bar 1's
    // meter and beat length. Without one, it's always a single bar, as before.
    const grid = exercise.grid
    const totalCountInBeats = grid ? countInBars * beatsPerMeasure : beatsPerMeasure
    const countInBeatSec = grid ? grid.beatQN[0] * grid.secPerQN[0] : 60 / exercise.bpm
    const countInDuration = getSessionCountInSeconds(exercise, countInBars)
    const offset = seekPositionRef.current
    const exerciseStartTime = metronome.startMetronome(audioCtx, offset ?? undefined)
    exerciseStartTimeRef.current = exerciseStartTime

    // Start backing track in sync with exercise start (after count-in)
    if (backingTrack.isLoaded) {
      backingTrack.startPlayback(audioCtx, exerciseStartTime)
    }

    if (offset !== null) {
      expectedEventsRef.current.filter(event => event.timestamp < offset).forEach(event => matchedIndicesRef.current.add(event.eventIndex))
      setPlayheadProgress(offset / exerciseDurationRef.current)
      sessionStateRef.current = 'playing'
      setSessionState('playing')
      rafRef.current = requestAnimationFrame(updatePlayhead)
      return
    }

    // Track countdown beats — store interval in ref for cleanup. Counts DOWN:
    // totalCountInBeats, totalCountInBeats - 1, ..., 1.
    let countBeat = 0
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    countdownIntervalRef.current = setInterval(() => {
      if (!audioCtxRef.current) return
      const elapsed = audioCtxRef.current.currentTime - (exerciseStartTime - countInDuration)
      const newBeat = countdownFor(elapsed, totalCountInBeats, countInBeatSec)
      if (newBeat !== countBeat && newBeat > 0) {
        countBeat = newBeat
        setCountdownBeat(countBeat)
      }
      if (audioCtxRef.current.currentTime >= exerciseStartTime) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current)
          countdownIntervalRef.current = null
        }
        sessionStateRef.current = 'playing'
        setSessionState('playing')
        setCountdownBeat(0)
        rafRef.current = requestAnimationFrame(updatePlayhead)
      }
    }, 25)
  }, [exercise, startListening, clearOnsets, metronome, updatePlayhead, backingTrack, countInBars, options.playbackOnly, isMidiMode, isPlaysenseMode, micOnsets.getLiveAudioInput, audioMode])

  const stopExercise = useCallback(() => {
    finishExercise()
  }, [finishExercise])

  // Pause = suspend the context. Every timestamp in this engine — the playhead,
  // scheduled clicks, backing sources, onset times — is on that one clock, so
  // suspending it freezes the attempt coherently and resuming needs no
  // re-anchoring of exerciseStartTimeRef.
  const pauseExercise = useCallback(() => {
    if (sessionStateRef.current !== 'playing') return
    sessionStateRef.current = 'paused'
    setSessionState('paused')
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    void audioCtxRef.current?.suspend().catch(() => {})
  }, [])

  const seekExercise = useCallback((seconds: number) => {
    if (!exercise || !Number.isFinite(seconds)) return
    const offset = Math.max(0, Math.min(seconds, getExerciseDuration(exercise) - .001))
    seekPositionRef.current = offset
    const ctx = audioCtxRef.current
    const running = sessionStateRef.current === 'playing' || sessionStateRef.current === 'countdown'
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    countdownIntervalRef.current = null
    metronome.stopMetronome()
    backingTrack.stopPlayback()
    clearOnsets()
    setEventResults([])
    eventResultsRef.current = []
    matchedIndicesRef.current = new Set(expectedEventsRef.current.filter(event => event.timestamp < offset).map(event => event.eventIndex))
    missDetectedIndicesRef.current = new Set()
    lastMissCheckIndexRef.current = 0
    setPlayheadProgress(offset / getExerciseDuration(exercise))
    if (ctx && (running || sessionStateRef.current === 'paused')) {
      exerciseStartTimeRef.current = metronome.startMetronome(ctx, offset)
      if (backingTrack.isLoaded) backingTrack.startPlayback(ctx, exerciseStartTimeRef.current)
      if (running) {
        sessionStateRef.current = 'playing'
        setSessionState('playing')
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(updatePlayhead)
      }
    }
  }, [exercise, metronome, backingTrack, clearOnsets, updatePlayhead])

  const resumeExercise = useCallback(() => {
    if (sessionStateRef.current !== 'paused') return
    sessionStateRef.current = 'playing'
    setSessionState('playing')
    void audioCtxRef.current?.resume().catch(() => {})
    rafRef.current = requestAnimationFrame(updatePlayhead)
  }, [updatePlayhead])

  const restartExercise = useCallback(async () => {
    const state = sessionStateRef.current
    if (state !== 'countdown' && state !== 'playing' && state !== 'paused') return
    // Abandon the attempt without grading it. The input source stays open so
    // the new count-in starts on the same context without another permission
    // round-trip.
    sessionGenerationRef.current++
    startingRef.current = false
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    countdownIntervalRef.current = null
    for (const timer of pendingPitchTimersRef.current) clearTimeout(timer)
    pendingPitchTimersRef.current.clear()
    metronome.stopMetronome()
    backingTrack.stopPlayback()
    if (state === 'paused') await audioCtxRef.current?.resume().catch(() => {})
    sessionStateRef.current = 'selecting'
    seekPositionRef.current = null
    setPlayheadProgress(0)
    await startExercise()
  }, [metronome, backingTrack, startExercise])

  const retry = useCallback(() => {
    seekPositionRef.current = null
    cancelSession(true)
    sessionStateRef.current = 'selecting'
    setSessionState('selecting')
    setEventResults([])
    setAttemptStats(null)
    setPlayheadProgress(0)
  }, [cancelSession])

  const goToSelect = useCallback(() => {
    cancelSession()
    setExercise(null)
    setSessionState('idle')
    setIsMicTesting(false)
    setEventResults([])
    setAttemptStats(null)
    stopListening()
    metronome.stopMetronome()
    backingTrack.stopPlayback()
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
  }, [stopListening, metronome, backingTrack, cancelSession])

  const cancelSessionRef = useRef(cancelSession)
  useEffect(() => { cancelSessionRef.current = cancelSession }, [cancelSession])
  useEffect(() => () => { cancelSessionRef.current() }, [])

  const getElapsedSeconds = useCallback(() => {
    const ctx = audioCtxRef.current
    if (sessionStateRef.current === 'selecting' || !ctx) return seekPositionRef.current ?? 0
    return (!isMidiMode && !isPlaysenseMode ? audibleTime(ctx) : ctx.currentTime) - exerciseStartTimeRef.current
  }, [isMidiMode, isPlaysenseMode])

  const selectMicDevice = async (id: string) => {
    if (isPlaysenseMode || isMidiMode) return
    calibration.cancelCalibration()
    calibration.clearCalibration('mic')
    setMicMuted(false)
    setSessionState('selecting')
    await micOnsets.selectDevice(id)
  }
  const toggleMicMute = () => {
    if (isPlaysenseMode || isMidiMode) return
    if (!micMuted) {
      if (sessionState === 'playing') pauseExercise()
      calibration.cancelCalibration()
      micOnsets.stopListening()
      setIsMicTesting(false)
      if (sessionState === 'calibrating') setSessionState('selecting')
      setMicMuted(true)
    } else {
      setMicMuted(false)
      void testMic()
    }
  }

  return {
    sessionState,
    exercise,
    eventResults,
    attemptStats,
    countdownBeat,
    audioMode,
    setAudioMode,
    clearAudioMode,
    isListening,
    hasPermission,
    audioError: previewError ?? backingTrack.error ?? audioError,
    inputLevel,
    inputPeak: micOnsets.inputPeak ?? 0,
    getLiveAudioInput: micOnsets.getLiveAudioInput,
    micDevices: micOnsets.devices ?? [],
    micDeviceId: micOnsets.selectedDeviceId ?? '',
    micDeviceLabel: micOnsets.deviceLabel ?? null,
    micMuted, selectMicDevice, toggleMicMute,
    micOnsets: micOnsets.calibrationOnsets ?? micOnsets.recentOnsets,
    setMicDetectionFloor: micOnsets.setDetectionFloor,
    noisyRoomMode,
    calibrationData: calibration.calibrationData,
    isCalibrating: calibration.isCalibrating,
    calibrationBeat: calibration.calibrationBeat,
    calibrationVisual: calibration.calibrationVisual,
    getTimingElapsed: calibration.getTimingElapsed,
    timingHits: calibration.timingHits,
    cancelCalibration: () => { sessionGenerationRef.current++; calibration.cancelCalibration(); setSessionState('selecting'); sessionStateRef.current='selecting' },
    totalCalibrationBeats: calibration.totalCalibrationBeats,
    calibrationError: calibration.calibrationError,
    metronomeBeat: metronome.currentBeat,
    metronomeDownbeat: metronome.isDownbeat,
    audioMetronome,
    setAudioMetronome: handleSetAudioMetronome,
    backingTrackLoading: backingTrack.isLoading,
    backingTrackLoaded: backingTrack.isLoaded,
    playheadProgress,
    getElapsedSeconds,
    currentScore,
    currentCombo,
    currentAccuracy,
    detectedHitCount: observedTimesRef.current.length,
    tempoDrift,
    lastHitGrade,
    detectedMidiNote,
    isMicTesting,
    testMic,
    stopTestMic,
    selectExercise,
    startCalibration: startCalibrationFlow,
    startExercise,
    stopExercise,
    seekExercise,
    pauseExercise,
    resumeExercise,
    restartExercise,
    retry,
    goToSelect,
    setNoisyRoomMode,
  }
}
