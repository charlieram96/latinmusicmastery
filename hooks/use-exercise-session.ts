'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type {
  ExerciseDefinition,
  SessionState,
  EventResult,
  AttemptStats,
  InstrumentCategory,
} from '@/lib/play-sense/types'
import { TOLERANCE_BY_DIFFICULTY, getInstrumentCategory } from '@/lib/play-sense/types'
import { gradeSingleOnset, gradeChordOnset, matchOnsetToExpected, computeStats, frequencyToMidi, orderSessionResults, currentComboForResults } from '@/lib/play-sense/scoring'
import type { ExpectedEvent } from '@/lib/play-sense/scoring'
import { generateExpectedTimestamps, getExerciseDuration, getCountInDuration, getLoopDuration } from '@/lib/play-sense/exercise-utils'
import { gridCountIn } from '@/lib/play-sense/grid'
import { useOnsetDetection } from './use-onset-detection'
import { useMetronome } from './use-metronome'
import { useCalibration } from './use-calibration'
import type { BackingMix } from '@/lib/play-sense/backing-mix'
import { useBackingTrack, type PlacedBackingTrack } from './use-backing-track'
import { usePlaysenseOnsets } from './use-playsense-onsets'
import { useMidiOnsets } from './use-midi-onsets'
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
  noisyRoomMode: boolean

  // Calibration
  calibrationData: ReturnType<typeof useCalibration>['calibrationData']
  isCalibrating: boolean
  calibrationBeat: number
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
  pauseExercise: () => void
  resumeExercise: () => void
  /** Discard the attempt (no grading) and run a fresh count-in with the same setup. */
  restartExercise: () => Promise<void>
  retry: () => void
  goToSelect: () => void
  setNoisyRoomMode: (enabled: boolean) => void
}

export interface UseExerciseSessionOptions {
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
}

export function useExerciseSession(options: UseExerciseSessionOptions = {}): UseExerciseSessionResult {
  const [sessionState, setSessionState] = useState<SessionState>('idle')
  const [audioMode, setAudioModeState] = useState<AudioMode | null>(null)
  const [exercise, setExercise] = useState<ExerciseDefinition | null>(null)
  const [eventResults, setEventResults] = useState<EventResult[]>([])
  const [attemptStats, setAttemptStats] = useState<AttemptStats | null>(null)
  const [countdownBeat, setCountdownBeat] = useState(0)
  const [noisyRoomMode, setNoisyRoomMode] = useState(false)
  const [audioMetronome, setAudioMetronome] = useState(false)
  const [playheadProgress, setPlayheadProgress] = useState(0)
  const [currentScore, setCurrentScore] = useState(0)
  const [currentCombo, setCurrentCombo] = useState(0)
  const [currentAccuracy, setCurrentAccuracy] = useState(0)
  const [tempoDrift, setTempoDrift] = useState(0)
  const [lastHitGrade, setLastHitGrade] = useState<string | null>(null)
  const [detectedMidiNote, setDetectedMidiNote] = useState<number | null>(null)
  const lastDetectedMidiRef = useRef<number | null>(null)

  const expectedEventsRef = useRef<ExpectedEvent[]>([])
  const matchedIndicesRef = useRef<Set<number>>(new Set())
  const extraHitsRef = useRef(0)
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
    if (sessionStateRef.current === 'playing' || sessionStateRef.current === 'countdown') return
    stopMicListening(); stopBleListening(); stopMidiListening()
    audioCtxRef.current = null
    setAudioModeState(mode)
    try { localStorage.setItem(AUDIO_MODE_STORAGE_KEY, mode) } catch { /* optional preference */ }
  }, [stopMicListening, stopBleListening, stopMidiListening])

  // Mic testing — opens the mic so user can see level meter without starting an exercise
  const [isMicTesting, setIsMicTesting] = useState(false)

  const testMic = useCallback(async () => {
    const audioCtx = await startListening()
    if (audioCtx) {
      audioCtxRef.current = audioCtx
      setIsMicTesting(true)
    }
  }, [startListening])

  const stopTestMic = useCallback(() => {
    stopListening()
    setIsMicTesting(false)
  }, [stopListening])

  // Keep sessionStateRef in sync so rAF callback reads latest value
  useEffect(() => { sessionStateRef.current = sessionState }, [sessionState])

  // Keep refs in sync for rAF callback access
  useEffect(() => {
    calibrationDataRef.current = audioMode === 'midi' ? null : calibration.calibrationData
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

    const calibOffset = isMidiMode ? 0 : (calibration.calibrationData?.latencyMs || 0) / 1000
    const widenMs = !isMidiMode && calibration.calibrationData && calibration.calibrationData.iqrMs > 30 ? 15 : 0

    const earliestOnset = exerciseStartTimeRef.current + calibOffset - (TOLERANCE_BY_DIFFICULTY[exercise.difficulty].ok + widenMs) / 1000
    const newOnsets = consumeOnsets(recentOnsets, seenOnsetsRef.current, earliestOnset)
    if (newOnsets.length === 0) return
    const category = getInstrumentCategory(exercise.instrument)
    const publishResults = (grade: string) => {
      eventResultsRef.current = orderSessionResults(eventResultsRef.current, expectedEventsRef.current)
      liveComboRef.current = currentComboForResults(eventResultsRef.current)
      setEventResults(eventResultsRef.current)
      setLastHitGrade(grade)
      setCurrentCombo(liveComboRef.current)
      const stats = computeStats(eventResultsRef.current, extraHitsRef.current, 0)
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
  }, [recentOnsets, sessionState, exercise, calibration.calibrationData, isMidiMode, chromaByOnsetRef, getFrequency])

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
    const calibOffset = (calibrationDataRef.current?.latencyMs || 0) / 1000
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
      const stats = computeStats(eventResultsRef.current, extraHitsRef.current, 0)
      setCurrentScore(stats.score)
      setCurrentAccuracy(stats.accuracy)
    }

    // Let final-note input delivery and deferred pitch analysis finish before closing.
    if (elapsed >= exerciseDurationRef.current + 0.35) {
      finishExerciseRef.current()
      return
    }

    rafRef.current = requestAnimationFrame(updatePlayhead)
  }, [getFrequency])

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

    const stats = computeStats(allResults, extraHitsRef.current, duration)

    setEventResults(allResults)
    setAttemptStats(stats)
    setSessionState('results')
    stopListening()
  }, [metronome, stopListening, backingTrack])

  useEffect(() => { finishExerciseRef.current = finishExercise }, [finishExercise])

  const cancelSession = useCallback(() => {
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
    stopListening()
    audioCtxRef.current = null
  }, [metronome, backingTrack, stopListening, calibration])

  const selectExercise = useCallback((ex: ExerciseDefinition) => {
    cancelSession()
    setExercise(ex)
    setSessionState('selecting')
    setEventResults([])
    setAttemptStats(null)
    setPlayheadProgress(0)
    sessionStateRef.current = 'selecting'
    // Saved input choice must support the newly selected instrument.
    if (audioMode && !availableInputModes(ex.instrument).includes(audioMode)) clearAudioMode()
  }, [cancelSession, audioMode, clearAudioMode])

  const startCalibrationFlow = useCallback(async () => {
    if (audioMode === 'midi') return
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
      const audioCtx = await startListening()
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
    const audioCtx = await startListening()
    if (generation !== sessionGenerationRef.current) return
    startingRef.current = false
    if (!audioCtx) return
    audioCtxRef.current = audioCtx

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
    const countInDuration = grid
      ? Math.max(0, -gridCountIn(grid, countInBars, beatsPerMeasure)[0])
      : getCountInDuration(exercise.bpm, beatsPerMeasure)
    const exerciseStartTime = metronome.startMetronome(audioCtx)
    exerciseStartTimeRef.current = exerciseStartTime

    // Start backing track in sync with exercise start (after count-in)
    if (backingTrack.isLoaded) {
      backingTrack.startPlayback(audioCtx, exerciseStartTime)
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
  }, [exercise, startListening, clearOnsets, metronome, updatePlayhead, backingTrack, countInBars])

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
    setPlayheadProgress(0)
    await startExercise()
  }, [metronome, backingTrack, startExercise])

  const retry = useCallback(() => {
    cancelSession()
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
    return audioCtxRef.current ? audioCtxRef.current.currentTime - exerciseStartTimeRef.current : 0
  }, [])

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
    audioError,
    inputLevel,
    noisyRoomMode,
    calibrationData: calibration.calibrationData,
    isCalibrating: calibration.isCalibrating,
    calibrationBeat: calibration.calibrationBeat,
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
    pauseExercise,
    resumeExercise,
    restartExercise,
    retry,
    goToSelect,
    setNoisyRoomMode,
  }
}
