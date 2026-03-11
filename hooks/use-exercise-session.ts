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
import { gradeSingleOnset, computeStats, frequencyToMidi } from '@/lib/play-sense/scoring'
import { generateExpectedTimestamps, getExerciseDuration, getCountInDuration } from '@/lib/play-sense/exercise-utils'
import { useOnsetDetection } from './use-onset-detection'
import { useMetronome } from './use-metronome'
import { useCalibration } from './use-calibration'
import { useBackingTrack } from './use-backing-track'
import { usePitchDetection } from './use-pitch-detection'

export type AudioMode = 'headphones' | 'speaker-safe'

const AUDIO_MODE_STORAGE_KEY = 'playSenseAudioMode'

function loadStoredAudioMode(): AudioMode | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem(AUDIO_MODE_STORAGE_KEY)
  if (stored === 'headphones' || stored === 'speaker-safe') return stored
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
  retry: () => void
  goToSelect: () => void
  setNoisyRoomMode: (enabled: boolean) => void
}

export function useExerciseSession(): UseExerciseSessionResult {
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

  const expectedEventsRef = useRef<Array<{ eventIndex: number; timestamp: number }>>([])
  const matchedIndicesRef = useRef<Set<number>>(new Set())
  const extraHitsRef = useRef(0)
  const exerciseStartTimeRef = useRef(0)
  const exerciseDurationRef = useRef(0)
  const singleLoopDurationRef = useRef(0)
  const sessionStateRef = useRef<SessionState>('idle')
  const rafRef = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const eventResultsRef = useRef<EventResult[]>([])
  const lastProcessedOnsetRef = useRef(0)
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const liveComboRef = useRef(0)
  const lastMissCheckIndexRef = useRef(0)
  const calibrationDataRef = useRef<import('@/lib/play-sense/types').CalibrationData | null>(null)
  const exerciseDifficultyRef = useRef<import('@/lib/play-sense/types').Difficulty>('beginner')
  // Sustain tracking: maps eventIndex -> { onsetTime, expectedDurationSec }
  const sustainTrackingRef = useRef<Map<number, { onsetTime: number; expectedDurationSec: number }>>(new Map())
  const lastInputLevelRef = useRef(0)
  const readyToGradeRef = useRef(false)
  const missDetectedIndicesRef = useRef<Set<number>>(new Set())
  // Deferred pitch grading: pending timeouts for pitched onsets where pitch was null at onset time
  const pendingPitchTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  const {
    isListening,
    hasPermission,
    error: audioError,
    inputLevel,
    recentOnsets,
    workletNode,
    startListening,
    stopListening,
    clearOnsets,
  } = useOnsetDetection({ noisyRoomMode, instrument: exercise?.instrument, audioMode: audioMode ?? undefined })

  const countInBeats = exercise?.timeSignature?.[0] || 4
  const metronome = useMetronome({
    bpm: exercise?.bpm || 100,
    timeSignature: exercise?.timeSignature || [4, 4],
    countInBeats,
    silent: !audioMetronome,
  })

  // Keep metronome silent state in sync at runtime
  const handleSetAudioMetronome = useCallback((enabled: boolean) => {
    setAudioMetronome(enabled)
    metronome.setSilent(!enabled)
  }, [metronome])

  const calibration = useCalibration()

  const backingTrack = useBackingTrack({ audioUrl: exercise?.audioUrl, audioMode: audioMode ?? undefined })

  // Pitch detection for melodic instruments
  const pitchDetection = usePitchDetection()
  const pitchDetectionRef = useRef(pitchDetection)
  pitchDetectionRef.current = pitchDetection
  const instrumentCategoryRef = useRef<InstrumentCategory>('percussion')

  // Load stored audio mode and calibration on mount
  useEffect(() => {
    const stored = loadStoredAudioMode()
    if (stored) setAudioModeState(stored)
    calibration.loadStoredCalibration()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setAudioMode = useCallback((mode: AudioMode) => {
    setAudioModeState(mode)
    localStorage.setItem(AUDIO_MODE_STORAGE_KEY, mode)
  }, [])

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
    calibrationDataRef.current = calibration.calibrationData
  }, [calibration.calibrationData])

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

    // On the first render in 'playing' state, sync the processed index
    // to skip all countdown-period onsets, then enable grading
    if (!readyToGradeRef.current) {
      lastProcessedOnsetRef.current = recentOnsets.length
      readyToGradeRef.current = true
      return
    }

    // Process only new onsets
    const newOnsets = recentOnsets.slice(lastProcessedOnsetRef.current)
    if (newOnsets.length === 0) return
    lastProcessedOnsetRef.current = recentOnsets.length

    const calibOffset = (calibration.calibrationData?.latencyMs || 0) / 1000
    const widenMs = calibration.calibrationData && calibration.calibrationData.iqrMs > 30 ? 15 : 0

    const category = getInstrumentCategory(exercise.instrument)

    for (const onset of newOnsets) {
      // For pitched instruments, use frequency from onset if available,
      // otherwise read the latest pitch detection value, then fall back to
      // the last MIDI note seen by the rAF loop so wrong notes are caught
      const pitchFreq = onset.frequency ?? pitchDetectionRef.current.getFrequency() ?? null
      const detectedMidi = category === 'pitched'
        ? (pitchFreq ? frequencyToMidi(pitchFreq) : lastDetectedMidiRef.current ?? undefined)
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
          const delayedFreq = pitchDetectionRef.current.getFrequency() ?? null
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
            delayedFreq ?? undefined
          )

          if (deferredResult) {
            if (missDetectedIndicesRef.current.has(deferredResult.eventIndex)) {
              missDetectedIndicesRef.current.delete(deferredResult.eventIndex)
              eventResultsRef.current = eventResultsRef.current.filter(
                r => !(r.eventIndex === deferredResult.eventIndex && r.grade === 'miss')
              )
            }

            eventResultsRef.current = [...eventResultsRef.current, deferredResult]
            setEventResults([...eventResultsRef.current])
            setLastHitGrade(deferredResult.grade)

            if (deferredResult.grade !== 'miss') {
              liveComboRef.current++
            } else {
              liveComboRef.current = 0
            }
            setCurrentCombo(liveComboRef.current)

            const stats = computeStats(eventResultsRef.current, extraHitsRef.current, 0)
            setCurrentScore(stats.score)
            setCurrentAccuracy(stats.accuracy)
            setTempoDrift(stats.tempoDriftMs)
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
        detectedFreq
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
        setEventResults([...eventResultsRef.current])
        setLastHitGrade(result.grade)

        if (result.grade !== 'miss') {
          liveComboRef.current++
        } else {
          liveComboRef.current = 0
        }
        setCurrentCombo(liveComboRef.current)

        // Update live stats
        const stats = computeStats(eventResultsRef.current, extraHitsRef.current, 0)
        setCurrentScore(stats.score)
        setCurrentAccuracy(stats.accuracy)
        setTempoDrift(stats.tempoDriftMs)
      } else {
        extraHitsRef.current++
      }
    }
  }, [recentOnsets, sessionState, exercise, calibration.calibrationData])

  // Playhead animation and exercise end detection
  const updatePlayhead = useCallback(() => {
    if (!audioCtxRef.current || sessionStateRef.current !== 'playing') return

    const currentTime = audioCtxRef.current.currentTime
    const elapsed = currentTime - exerciseStartTimeRef.current
    const overallProgress = Math.min(elapsed / exerciseDurationRef.current, 1)

    setPlayheadProgress(overallProgress)

    // Update detected MIDI note for visualization (pitched instruments only)
    if (instrumentCategoryRef.current === 'pitched') {
      const freq = pitchDetectionRef.current.getFrequency()
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
      }
      eventResultsRef.current = [...eventResultsRef.current, missResult]
      missDetectedIndicesRef.current.add(evt.eventIndex)
      liveComboRef.current = 0
      missDetected = true
      lastMissCheckIndexRef.current = i + 1
    }

    if (missDetected) {
      setEventResults([...eventResultsRef.current])
      setCurrentCombo(0)
      setLastHitGrade('miss')
      const stats = computeStats(eventResultsRef.current, extraHitsRef.current, 0)
      setCurrentScore(stats.score)
      setCurrentAccuracy(stats.accuracy)
    }

    if (overallProgress >= 1) {
      finishExercise()
      return
    }

    rafRef.current = requestAnimationFrame(updatePlayhead)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const finishExercise = useCallback(() => {
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
        })
      }
    }

    // Sort by eventIndex
    const allResults = Array.from(resultsByIndex.values())
    allResults.sort((a, b) => a.eventIndex - b.eventIndex)

    const duration = audioCtxRef.current
      ? audioCtxRef.current.currentTime - exerciseStartTimeRef.current
      : exerciseDurationRef.current

    const stats = computeStats(allResults, extraHitsRef.current, duration)

    setEventResults(allResults)
    setAttemptStats(stats)
    setSessionState('results')
    stopListening()
    pitchDetectionRef.current.stopListening()
  }, [metronome, stopListening, backingTrack])

  const selectExercise = useCallback((ex: ExerciseDefinition) => {
    setExercise(ex)
    setSessionState('selecting')
    setEventResults([])
    setAttemptStats(null)
  }, [])

  const startCalibrationFlow = useCallback(async () => {
    setSessionState('calibrating')
    const audioCtx = await startListening()
    if (audioCtx) {
      audioCtxRef.current = audioCtx
      // Pass the worklet node so calibration can listen for onset events
      calibration.startCalibration(audioCtx, workletNode)
    }
  }, [startListening, calibration, workletNode])

  const startExercise = useCallback(async () => {
    if (!exercise) return

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
    lastProcessedOnsetRef.current = 0
    readyToGradeRef.current = false
    liveComboRef.current = 0
    lastMissCheckIndexRef.current = 0
    sustainTrackingRef.current.clear()
    for (const timer of pendingPitchTimersRef.current) clearTimeout(timer)
    pendingPitchTimersRef.current.clear()
    clearOnsets()

    // Start mic
    let audioCtx = audioCtxRef.current
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = await startListening()
      if (!audioCtx) return
      audioCtxRef.current = audioCtx
    } else if (audioCtx.state === 'suspended') {
      await audioCtx.resume()
    }

    // Start pitch detection for pitched instruments
    if (getInstrumentCategory(exercise.instrument) === 'pitched') {
      pitchDetectionRef.current.startListening()
    }

    // Generate expected events
    expectedEventsRef.current = generateExpectedTimestamps(exercise)
    exerciseDurationRef.current = getExerciseDuration(exercise)

    // Compute single loop duration for playhead looping
    const beatsPerMeasure = exercise.timeSignature[0]
    const singleLoopBeats = exercise.measures * beatsPerMeasure
    singleLoopDurationRef.current = (singleLoopBeats * 60) / exercise.bpm

    // Start countdown
    setSessionState('countdown')
    const countInDuration = getCountInDuration(exercise.bpm, beatsPerMeasure)
    const exerciseStartTime = metronome.startMetronome(audioCtx)
    exerciseStartTimeRef.current = exerciseStartTime

    // Start backing track in sync with exercise start (after count-in)
    if (backingTrack.isLoaded) {
      backingTrack.startPlayback(audioCtx, exerciseStartTime)
    }

    // Track countdown beats — store interval in ref for cleanup
    const beatDuration = 60 / exercise.bpm
    let countBeat = 0
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    countdownIntervalRef.current = setInterval(() => {
      if (!audioCtxRef.current) return
      const elapsed = audioCtxRef.current.currentTime - (exerciseStartTime - countInDuration)
      const newBeat = Math.floor(elapsed / beatDuration) + 1
      if (newBeat !== countBeat && newBeat <= beatsPerMeasure) {
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
  }, [exercise, startListening, clearOnsets, metronome, updatePlayhead, backingTrack])

  const stopExercise = useCallback(() => {
    finishExercise()
  }, [finishExercise])

  const retry = useCallback(() => {
    setSessionState('selecting')
    setEventResults([])
    setAttemptStats(null)
    setPlayheadProgress(0)
  }, [])

  const goToSelect = useCallback(() => {
    setExercise(null)
    setSessionState('idle')
    setIsMicTesting(false)
    setEventResults([])
    setAttemptStats(null)
    stopListening()
    pitchDetectionRef.current.stopListening()
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
  }, [stopListening, metronome, backingTrack])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
      metronome.stopMetronome()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    sessionState,
    exercise,
    eventResults,
    attemptStats,
    countdownBeat,
    audioMode,
    setAudioMode,
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
    retry,
    goToSelect,
    setNoisyRoomMode,
  }
}
