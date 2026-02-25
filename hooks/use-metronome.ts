'use client'

import { useRef, useCallback } from 'react'

interface UseMetronomeOptions {
  bpm: number
  timeSignature: [number, number]
  countInBeats?: number
}

interface UseMetronomeResult {
  startMetronome: (audioContext: AudioContext) => number // returns startTime (after count-in)
  stopMetronome: () => void
  isPlaying: boolean
}

/**
 * Precise metronome click scheduling using Web Audio API.
 * Uses OscillatorNode with high-frequency sine tones (4kHz+)
 * to be spectrally distinct from percussion (120-2000Hz band-pass).
 */
export function useMetronome(options: UseMetronomeOptions): UseMetronomeResult {
  const { bpm, timeSignature, countInBeats = 4 } = options
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isPlayingRef = useRef(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const scheduledBeatsRef = useRef(0)
  const nextBeatTimeRef = useRef(0)

  const scheduleClick = useCallback(
    (audioContext: AudioContext, time: number, isDownbeat: boolean) => {
      const osc = audioContext.createOscillator()
      const gain = audioContext.createGain()

      osc.type = 'sine'
      osc.frequency.value = isDownbeat ? 4400 : 3300
      gain.gain.value = isDownbeat ? 0.3 : 0.15

      osc.connect(gain)
      gain.connect(audioContext.destination)

      const duration = isDownbeat ? 0.005 : 0.004
      osc.start(time)
      osc.stop(time + duration)

      // Ramp down to avoid click
      gain.gain.setValueAtTime(gain.gain.value, time)
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration)
    },
    []
  )

  const startMetronome = useCallback(
    (audioContext: AudioContext): number => {
      audioCtxRef.current = audioContext
      isPlayingRef.current = true

      const beatDuration = 60 / bpm
      const beatsPerMeasure = timeSignature[0]

      // Count-in starts immediately
      const countInStart = audioContext.currentTime + 0.05 // tiny buffer
      const exerciseStart = countInStart + countInBeats * beatDuration

      // Schedule count-in clicks
      for (let i = 0; i < countInBeats; i++) {
        const time = countInStart + i * beatDuration
        const isDownbeat = i % beatsPerMeasure === 0
        scheduleClick(audioContext, time, isDownbeat)
      }

      // Start scheduling exercise metronome
      scheduledBeatsRef.current = 0
      nextBeatTimeRef.current = exerciseStart

      const lookahead = 0.1 // 100ms
      const scheduleInterval = 25 // 25ms

      intervalRef.current = setInterval(() => {
        if (!audioCtxRef.current || !isPlayingRef.current) return

        while (nextBeatTimeRef.current < audioCtxRef.current.currentTime + lookahead) {
          const beatInMeasure = scheduledBeatsRef.current % beatsPerMeasure
          const isDownbeat = beatInMeasure === 0
          scheduleClick(audioCtxRef.current, nextBeatTimeRef.current, isDownbeat)

          scheduledBeatsRef.current++
          nextBeatTimeRef.current += beatDuration
        }
      }, scheduleInterval)

      return exerciseStart
    },
    [bpm, timeSignature, countInBeats, scheduleClick]
  )

  const stopMetronome = useCallback(() => {
    isPlayingRef.current = false
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    scheduledBeatsRef.current = 0
    nextBeatTimeRef.current = 0
  }, [])

  return {
    startMetronome,
    stopMetronome,
    isPlaying: isPlayingRef.current,
  }
}
