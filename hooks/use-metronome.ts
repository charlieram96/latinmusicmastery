'use client'

import { useRef, useCallback, useState } from 'react'
import type { ExerciseGrid } from '@/lib/play-sense/types'
import { gridBeats, gridCountIn, gridLoopSeconds } from '@/lib/play-sense/grid'

interface UseMetronomeOptions {
  bpm: number
  timeSignature: [number, number]
  countInBeats?: number
  silent?: boolean
  /**
   * A graded owner's per-bar grid (tempo/meter changes honoured). When given,
   * the count-in and the exercise clicks follow it instead of the uniform
   * `bpm`/`timeSignature`. Without it, behaviour is unchanged.
   */
  grid?: ExerciseGrid
  /** Count-in length in bars. Only meaningful with `grid`; defaults to 1. */
  countInBars?: 1 | 2
}

interface UseMetronomeResult {
  startMetronome: (audioContext: AudioContext) => number // returns startTime (after count-in)
  stopMetronome: () => void
  isPlaying: boolean
  currentBeat: number // 1-indexed beat in measure
  isDownbeat: boolean
  setSilent: (silent: boolean) => void
}

/**
 * Precise metronome click scheduling using Web Audio API.
 * Uses OscillatorNode with high-frequency sine tones (4kHz+)
 * to be spectrally distinct from percussion (120-2000Hz band-pass).
 */
export function useMetronome(options: UseMetronomeOptions): UseMetronomeResult {
  const { bpm, timeSignature, countInBeats = 4, silent: silentProp = true, grid, countInBars = 1 } = options
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentBeat, setCurrentBeat] = useState(0)
  const [isDownbeat, setIsDownbeat] = useState(false)
  const [silent, setSilent] = useState(silentProp)
  const silentRef = useRef(silentProp)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const scheduledBeatsRef = useRef(0)
  const nextBeatTimeRef = useRef(0)
  const countInStartRef = useRef(0)
  const beatCounterRef = useRef(0) // total beats elapsed (for visual tracking)

  const scheduleClick = useCallback(
    (audioContext: AudioContext, time: number, isDownbeat: boolean, force = false) => {
      // Skip audio output when silent. The count-in forces its clicks: it plays
      // before the student starts, so it can't mask their onsets, and without it
      // they have nothing but a visual countdown to come in on.
      if (silentRef.current && !force) return

      const osc = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      osc.type = 'sine'
      osc.frequency.value = isDownbeat ? 4400 : 3300

      const peakGain = isDownbeat ? 0.6 : 0.4
      const duration = isDownbeat ? 0.03 : 0.02
      const holdTime = duration * 0.7
      const rampTime = duration * 0.3

      // Start gain at 0 to prevent artifacts from default value (1.0)
      gainNode.gain.value = 0

      osc.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // Envelope: silent → attack → hold → ramp down
      gainNode.gain.setValueAtTime(0, Math.max(0, time - 0.001))
      gainNode.gain.setValueAtTime(peakGain, time)
      gainNode.gain.setValueAtTime(peakGain, time + holdTime)
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + holdTime + rampTime)

      osc.start(time)
      osc.stop(time + duration + 0.01)
    },
    []
  )

  // Keep silentRef in sync with state
  const handleSetSilent = useCallback((value: boolean) => {
    setSilent(value)
    silentRef.current = value
  }, [])

  const startMetronome = useCallback(
    (audioContext: AudioContext): number => {
      // Clear any existing scheduling interval to prevent leaks
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }

      audioCtxRef.current = audioContext
      setIsPlaying(true)
      beatCounterRef.current = 0

      const beatsPerMeasure = timeSignature[0]

      // Count-in starts immediately
      const countInStart = audioContext.currentTime + 0.05 // tiny buffer
      countInStartRef.current = countInStart

      const lookahead = 0.1 // 100ms
      const scheduleInterval = 25 // 25ms

      if (grid) {
        // Graded owners: the count-in and the exercise clicks follow the
        // per-bar grid instead of a uniform bpm.
        const beats = gridBeats(grid)
        const loopLen = gridLoopSeconds(grid)
        const beatSec0 = grid.beatQN[0] * grid.secPerQN[0]
        // 1-indexed position within each beat's own measure, for the visual counter.
        let posInMeasure = 0
        const beatPositions = beats.map(b => {
          posInMeasure = b.downbeat ? 1 : posInMeasure + 1
          return posInMeasure
        })

        const countInOffsets = gridCountIn(grid, countInBars, beatsPerMeasure)
        const countInSeconds = countInOffsets.length > 0 ? -countInOffsets[0] : 0
        const exerciseStart = countInStart + countInSeconds

        // Count-in clicks: bar 1's meter and beat length, always audible.
        countInOffsets.forEach((offset, i) => {
          const time = exerciseStart + offset
          scheduleClick(audioContext, time, i % beatsPerMeasure === 0, true)
        })

        // Exercise clicks: every beat of the grid, looping every `loopLen` seconds.
        scheduledBeatsRef.current = 0
        nextBeatTimeRef.current = beats.length > 0 ? exerciseStart + beats[0].seconds : exerciseStart

        intervalRef.current = setInterval(() => {
          if (!audioCtxRef.current || beats.length === 0) return

          while (nextBeatTimeRef.current < audioCtxRef.current.currentTime + lookahead) {
            const idx = scheduledBeatsRef.current % beats.length
            scheduleClick(audioCtxRef.current, nextBeatTimeRef.current, beats[idx].downbeat)

            scheduledBeatsRef.current++
            const nextIdx = scheduledBeatsRef.current % beats.length
            const nextLoop = Math.floor(scheduledBeatsRef.current / beats.length)
            nextBeatTimeRef.current = exerciseStart + nextLoop * loopLen + beats[nextIdx].seconds
          }

          // Update visual beat tracking (including count-in), following the grid.
          const now = audioCtxRef.current.currentTime
          const elapsedSinceCountIn = now - countInStartRef.current
          if (elapsedSinceCountIn < 0) return
          const sinceExerciseStart = now - exerciseStart
          if (sinceExerciseStart < 0) {
            const idx = Math.floor(elapsedSinceCountIn / beatSec0)
            if (idx !== beatCounterRef.current) {
              beatCounterRef.current = idx
              const beatInMeasure = (idx % beatsPerMeasure) + 1
              setCurrentBeat(beatInMeasure)
              setIsDownbeat(beatInMeasure === 1)
            }
          } else if (beats.length > 0) {
            const wrapped = ((sinceExerciseStart % loopLen) + loopLen) % loopLen
            let idx = 0
            for (let i = 0; i < beats.length; i++) {
              if (beats[i].seconds <= wrapped + 1e-9) idx = i
              else break
            }
            const totalBeatIndex = Math.floor(sinceExerciseStart / loopLen) * beats.length + idx
            if (totalBeatIndex !== beatCounterRef.current) {
              beatCounterRef.current = totalBeatIndex
              setCurrentBeat(beatPositions[idx])
              setIsDownbeat(beats[idx].downbeat)
            }
          }
        }, scheduleInterval)

        setCurrentBeat(1)
        setIsDownbeat(true)

        return exerciseStart
      }

      // Uniform path (no grid): unchanged.
      const beatDuration = 60 / bpm
      const exerciseStart = countInStart + countInBeats * beatDuration

      // Schedule count-in clicks
      for (let i = 0; i < countInBeats; i++) {
        const time = countInStart + i * beatDuration
        const isDownbeat = i % beatsPerMeasure === 0
        scheduleClick(audioContext, time, isDownbeat, true)
      }

      // Start scheduling exercise metronome
      scheduledBeatsRef.current = 0
      nextBeatTimeRef.current = exerciseStart

      intervalRef.current = setInterval(() => {
        if (!audioCtxRef.current) return

        // Schedule audio clicks ahead
        while (nextBeatTimeRef.current < audioCtxRef.current.currentTime + lookahead) {
          const beatInMeasure = scheduledBeatsRef.current % beatsPerMeasure
          const isDownbeat = beatInMeasure === 0
          scheduleClick(audioCtxRef.current, nextBeatTimeRef.current, isDownbeat)

          scheduledBeatsRef.current++
          // Use multiplication from base time to avoid floating-point drift
          nextBeatTimeRef.current = exerciseStart + scheduledBeatsRef.current * beatDuration
        }

        // Update visual beat tracking (including count-in)
        const now = audioCtxRef.current.currentTime
        const elapsedSinceStart = now - countInStartRef.current
        if (elapsedSinceStart >= 0) {
          const totalBeatIndex = Math.floor(elapsedSinceStart / beatDuration)
          if (totalBeatIndex !== beatCounterRef.current) {
            beatCounterRef.current = totalBeatIndex
            const beatInMeasure = (totalBeatIndex % beatsPerMeasure) + 1 // 1-indexed
            setCurrentBeat(beatInMeasure)
            setIsDownbeat(beatInMeasure === 1)
          }
        }
      }, scheduleInterval)

      // Set initial beat
      setCurrentBeat(1)
      setIsDownbeat(true)

      return exerciseStart
    },
    [bpm, timeSignature, countInBeats, grid, countInBars, scheduleClick]
  )

  const stopMetronome = useCallback(() => {
    setIsPlaying(false)
    setCurrentBeat(0)
    setIsDownbeat(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    scheduledBeatsRef.current = 0
    nextBeatTimeRef.current = 0
    beatCounterRef.current = 0
  }, [])

  return {
    startMetronome,
    stopMetronome,
    isPlaying,
    currentBeat,
    isDownbeat,
    setSilent: handleSetSilent,
  }
}
