'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { generateExpectedTimestamps, getExerciseDuration } from '@/lib/play-sense/exercise-utils'
import type { AttemptStats, EventResult, ExerciseDefinition } from '@/lib/play-sense/types'
import { computeStats } from '@/lib/play-sense/scoring'
import type { useExerciseSession } from './use-exercise-session'

/** A silent, local showcase clock. It neither opens input devices nor produces saved attempts. */
export function useStageDemoSession(exercises: ExerciseDefinition[], enabled: boolean) {
  const [exercise, setExercise] = useState<ExerciseDefinition | null>(() => enabled ? exercises[0] ?? null : null)
  const [running, setRunning] = useState(true)
  const [elapsed, setElapsed] = useState(-3.5)
  const [results, setResults] = useState<EventResult[]>([])
  const [attempt, setAttempt] = useState(0)
  const [reviewStats, setReviewStats] = useState<AttemptStats | null>(null)
  const clock = useRef(-3.5)
  const nextEvent = useRef(0)
  const history = useRef<EventResult[]>([])
  const expected = useMemo(() => exercise ? generateExpectedTimestamps(exercise) : [], [exercise])
  const duration = exercise ? getExerciseDuration(exercise) : 1
  const reset = useCallback(() => {
    clock.current = -3.5; nextEvent.current = 0; history.current = []
    setElapsed(-3.5); setResults([]); setReviewStats(null); setAttempt(value => value + 1)
  }, [])
  const selectExercise = useCallback((value: ExerciseDefinition) => {
    reset(); setExercise(value); setRunning(true)
  }, [reset])
  const startExercise = useCallback(async () => { reset(); setRunning(true) }, [reset])
  const stopExercise = useCallback(() => { setRunning(false); reset() }, [reset])
  const getElapsedSeconds = useCallback(() => clock.current, [])
  const review = useCallback(() => {
    if (!enabled) return
    setRunning(false)
    setReviewStats(computeStats(history.current, 0, Math.max(0, clock.current)))
  }, [enabled])

  useEffect(() => {
    if (!enabled || !exercise || !running) return
    let raf = 0, previous = 0, lastUI = 0
    const tick = (now: number) => {
      const dt = previous ? Math.min(.1, (now - previous) / 1000) : 0
      previous = now
      if (!document.hidden) {
        clock.current += dt
        if (clock.current > duration + .4) reset()
        let changed = false
        while (nextEvent.current < expected.length && expected[nextEvent.current].timestamp <= clock.current) {
          history.current.push({ eventIndex: expected[nextEvent.current++].eventIndex, grade: 'perfect',
            offsetMs: 0, timing: 'on_time', onsetEnergy: 1 })
          changed = true
        }
        if (changed) setResults([...history.current])
        if (now - lastUI > 50) { setElapsed(clock.current); lastUI = now }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [enabled, exercise, running, duration, expected, reset])

  const beat = exercise ? Math.floor(Math.max(0, elapsed) * exercise.bpm / 60) : 0
  const overrides: Partial<ReturnType<typeof useExerciseSession>> = {
    exercise, sessionState: reviewStats ? 'results' : running ? 'playing' : 'selecting', eventResults: results, attemptStats: reviewStats,
    audioMode: 'headphones', audioError: null, isListening: false, inputLevel: 0,
    backingTrackLoading: false, backingTrackLoaded: false, audioMetronome: false,
    playheadProgress: Math.max(0, elapsed) / duration, getElapsedSeconds,
    currentScore: results.length ? 100 : 0, currentAccuracy: results.length ? 100 : 0,
    currentCombo: results.length, lastHitGrade: results.length ? 'perfect' : null,
    countdownBeat: 0, metronomeBeat: beat % 4 + 1, metronomeDownbeat: beat % 4 === 0,
    selectExercise, startExercise, stopExercise, retry: startExercise, goToSelect: stopExercise,
  }
  return { overrides, attempt, review }
}
