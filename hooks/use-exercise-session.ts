'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type {
  ExerciseDefinition,
  SessionState,
  EventResult,
  AttemptStats,
  OnsetEvent,
} from '@/lib/play-sense/types'
import { gradeSingleOnset, computeStats } from '@/lib/play-sense/scoring'
import { generateExpectedTimestamps, getExerciseDuration, getCountInDuration } from '@/lib/play-sense/exercise-utils'
import { useOnsetDetection } from './use-onset-detection'
import { useMetronome } from './use-metronome'
import { useCalibration } from './use-calibration'
import { useBackingTrack } from './use-backing-track'

interface UseExerciseSessionResult {
  // State
  sessionState: SessionState
  exercise: ExerciseDefinition | null
  eventResults: EventResult[]
  attemptStats: AttemptStats | null
  countdownBeat: number

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

  // Backing track
  backingTrackLoading: boolean
  backingTrackLoaded: boolean

  // Playhead
  playheadProgress: number // 0-1

  // Live scoring
  currentScore: number
  currentCombo: number
  currentAccuracy: number
  tempoDrift: number
  lastHitGrade: string | null

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
  const [exercise, setExercise] = useState<ExerciseDefinition | null>(null)
  const [eventResults, setEventResults] = useState<EventResult[]>([])
  const [attemptStats, setAttemptStats] = useState<AttemptStats | null>(null)
  const [countdownBeat, setCountdownBeat] = useState(0)
  const [noisyRoomMode, setNoisyRoomMode] = useState(false)
  const [playheadProgress, setPlayheadProgress] = useState(0)
  const [currentScore, setCurrentScore] = useState(0)
  const [currentCombo, setCurrentCombo] = useState(0)
  const [currentAccuracy, setCurrentAccuracy] = useState(0)
  const [tempoDrift, setTempoDrift] = useState(0)
  const [lastHitGrade, setLastHitGrade] = useState<string | null>(null)

  const expectedEventsRef = useRef<Array<{ eventIndex: number; timestamp: number }>>([])
  const matchedIndicesRef = useRef<Set<number>>(new Set())
  const extraHitsRef = useRef(0)
  const exerciseStartTimeRef = useRef(0)
  const exerciseDurationRef = useRef(0)
  const singleLoopDurationRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const eventResultsRef = useRef<EventResult[]>([])
  const lastProcessedOnsetRef = useRef(0)
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const liveComboRef = useRef(0)

  const {
    isListening,
    hasPermission,
    error: audioError,
    inputLevel,
    recentOnsets,
    startListening,
    stopListening,
    clearOnsets,
  } = useOnsetDetection({ noisyRoomMode })

  const metronome = useMetronome({
    bpm: exercise?.bpm || 100,
    timeSignature: exercise?.timeSignature || [4, 4],
    countInBeats: 4,
  })

  const calibration = useCalibration()

  const backingTrack = useBackingTrack({ audioUrl: exercise?.audioUrl })

  // Load stored calibration on mount
  useEffect(() => {
    calibration.loadStoredCalibration()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Process new onsets during playing
  useEffect(() => {
    if (sessionState !== 'playing' || !exercise) return

    // Process only new onsets
    const newOnsets = recentOnsets.slice(lastProcessedOnsetRef.current)
    if (newOnsets.length === 0) return
    lastProcessedOnsetRef.current = recentOnsets.length

    const calibOffset = (calibration.calibrationData?.latencyMs || 0) / 1000
    const widenMs = calibration.calibrationData && calibration.calibrationData.iqrMs > 30 ? 15 : 0

    for (const onset of newOnsets) {
      const result = gradeSingleOnset(
        onset.timestamp,
        onset.energy,
        expectedEventsRef.current,
        matchedIndicesRef.current,
        exercise.difficulty,
        calibOffset,
        widenMs
      )

      if (result) {
        eventResultsRef.current = [...eventResultsRef.current, result]
        setEventResults([...eventResultsRef.current])
        setLastHitGrade(result.grade)

        // Track live combo: increment on non-miss, reset on miss
        if (result.grade === 'miss') {
          liveComboRef.current = 0
        } else {
          liveComboRef.current++
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
    if (!audioCtxRef.current || sessionState !== 'playing') return

    const elapsed = audioCtxRef.current.currentTime - exerciseStartTimeRef.current
    const overallProgress = Math.min(elapsed / exerciseDurationRef.current, 1)

    // For multi-loop exercises, playhead loops within a single loop's worth of notation
    const singleLoop = singleLoopDurationRef.current
    const progress = singleLoop > 0 && exerciseDurationRef.current > singleLoop
      ? (elapsed % singleLoop) / singleLoop
      : overallProgress
    setPlayheadProgress(progress)

    if (overallProgress >= 1) {
      // Exercise ended
      finishExercise()
      return
    }

    rafRef.current = requestAnimationFrame(updatePlayhead)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionState])

  const finishExercise = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
    metronome.stopMetronome()
    backingTrack.stopPlayback()

    // Mark any unmatched expected events as misses
    const allResults = [...eventResultsRef.current]
    for (const expected of expectedEventsRef.current) {
      if (!matchedIndicesRef.current.has(expected.eventIndex)) {
        // Check if we already have a result for this event
        const hasResult = allResults.some(r => r.eventIndex === expected.eventIndex)
        if (!hasResult) {
          allResults.push({
            eventIndex: expected.eventIndex,
            grade: 'miss',
            offsetMs: null,
            timing: null,
            onsetEnergy: null,
          })
        }
      }
    }

    // Sort by eventIndex
    allResults.sort((a, b) => a.eventIndex - b.eventIndex)

    const duration = audioCtxRef.current
      ? audioCtxRef.current.currentTime - exerciseStartTimeRef.current
      : exerciseDurationRef.current

    const stats = computeStats(allResults, extraHitsRef.current, duration)

    setEventResults(allResults)
    setAttemptStats(stats)
    setSessionState('results')
    stopListening()
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
      calibration.startCalibration(audioCtx)
    }
  }, [startListening, calibration])

  const startExercise = useCallback(async () => {
    if (!exercise) return

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
    extraHitsRef.current = 0
    lastProcessedOnsetRef.current = 0
    liveComboRef.current = 0
    clearOnsets()

    // Start mic
    let audioCtx = audioCtxRef.current
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = await startListening()
      if (!audioCtx) return
      audioCtxRef.current = audioCtx
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
    const countInDuration = getCountInDuration(exercise.bpm)
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
      if (newBeat !== countBeat && newBeat <= 4) {
        countBeat = newBeat
        setCountdownBeat(countBeat)
      }
      if (audioCtxRef.current.currentTime >= exerciseStartTime) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current)
          countdownIntervalRef.current = null
        }
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
    isListening,
    hasPermission,
    audioError,
    inputLevel,
    noisyRoomMode,
    calibrationData: calibration.calibrationData,
    isCalibrating: calibration.isCalibrating,
    calibrationBeat: calibration.calibrationBeat,
    totalCalibrationBeats: calibration.totalCalibrationBeats,
    backingTrackLoading: backingTrack.isLoading,
    backingTrackLoaded: backingTrack.isLoaded,
    playheadProgress,
    currentScore,
    currentCombo,
    currentAccuracy,
    tempoDrift,
    lastHitGrade,
    selectExercise,
    startCalibration: startCalibrationFlow,
    startExercise,
    stopExercise,
    retry,
    goToSelect,
    setNoisyRoomMode,
  }
}
