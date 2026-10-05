'use client'

import { useState, useRef, useCallback } from 'react'
import type { CalibrationData, OnsetEvent } from '@/lib/play-sense/types'
import { TIMING_BPM } from '@/lib/audio/timing-compensation'

const STORAGE_KEY_MIC = 'playSenseCalibration'
const STORAGE_KEY_BLE = 'playSenseCalibrationBle'
const CALIBRATION_BPM = TIMING_BPM
const CALIBRATION_BEATS = 16

/** Derive visuals from the scheduled audio timeline, never a separate animation. */
export function calibrationVisual(time: number, start: number) {
  const elapsed = Math.max(0, time - start)
  const index = time < start ? -1 : Math.floor((elapsed + 1e-8) / (60 / CALIBRATION_BPM))
  return {
    phase: index < 4 ? 'count-in' as const : 'measuring' as const,
    countInBeat: index < 4 ? Math.max(0, index + 1) : 0,
    beat: Math.min(CALIBRATION_BEATS, Math.max(0, index - 3)),
    pulse: index >= 0 && index < 4 + CALIBRATION_BEATS && elapsed - index * (60 / CALIBRATION_BPM) < 0.16 ? index % 4 + 1 : 0,
  }
}

/** Source of tap timestamps for calibration. */
export type CalibrationSource =
  | { type: 'mic'; workletNode: AudioWorkletNode | null }
  | {
      /** Subscribes to BLE hits — returns an unsubscribe fn. cb is called with a timestamp in performance.now() ms. */
      type: 'ble'
      subscribeToHits: (cb: (timestamp: number) => void) => () => void
    }

interface UseCalibrationResult {
  /** The calibration record matching the active source — defaults to mic if none selected. */
  calibrationData: CalibrationData | null
  /** Mic-source latency, separate from BLE. */
  micCalibration: CalibrationData | null
  /** BLE-source latency, separate from mic. */
  bleCalibration: CalibrationData | null
  isCalibrating: boolean
  calibrationBeat: number
  calibrationVisual: ReturnType<typeof calibrationVisual> | null
  getTimingElapsed: () => number
  timingHits: Array<{ elapsed: number; offsetMs: number; beat: number }>
  totalCalibrationBeats: number
  calibrationError: string | null
  /** Source for the currently-loaded calibrationData ('mic' | 'ble'). */
  setActiveSourceType: (type: 'mic' | 'ble') => void
  startCalibration: (audioContext: AudioContext, source: CalibrationSource) => void
  cancelCalibration: () => void
  loadStoredCalibration: () => CalibrationData | null
  clearCalibration: (sourceType?: 'mic' | 'ble') => void
}

function loadFromStorage(key: string): CalibrationData | null {
  try {
    const stored = localStorage.getItem(key)
    if (!stored) return null
    const data = JSON.parse(stored) as CalibrationData
    // Only invalidate on browser change for mic (BLE latency is device-driven, not browser-driven)
    if (key === STORAGE_KEY_MIC && data.browser !== navigator.userAgent) return null
    return data
  } catch {
    return null
  }
}

export function useCalibration(): UseCalibrationResult {
  const [micCalibration, setMicCalibration] = useState<CalibrationData | null>(null)
  const [bleCalibration, setBleCalibration] = useState<CalibrationData | null>(null)
  const [activeSourceType, setActiveSourceTypeState] = useState<'mic' | 'ble'>('mic')
  const [isCalibrating, setIsCalibrating] = useState(false)
  const [calibrationBeat, setCalibrationBeat] = useState(0)
  const [visual, setVisual] = useState<ReturnType<typeof calibrationVisual> | null>(null)
  const timingStartRef = useRef(0)
  const [timingHits, setTimingHits] = useState<Array<{ elapsed: number; offsetMs: number; beat: number }>>([])
  const getTimingElapsed = useCallback(() => {
    const ctx = audioCtxRef.current
    if (!ctx) return -2.4
    const stamp = ctx.getOutputTimestamp?.()
    const heard = stamp && typeof stamp.performanceTime === 'number' && stamp.performanceTime > 0 && typeof stamp.contextTime === 'number'
      ? Math.min(ctx.currentTime, stamp.contextTime + (performance.now() - stamp.performanceTime) / 1000)
      : ctx.currentTime - (ctx.outputLatency || 0) - (ctx.baseLatency || 0)
    return heard - timingStartRef.current
  }, [])
  const frameRef = useRef<number | null>(null)
  const micClicksRef = useRef<OscillatorNode[]>([])
  const [calibrationError, setCalibrationError] = useState<string | null>(null)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const expectedTimesRef = useRef<number[]>([])
  const onsetsRef = useRef<OnsetEvent[]>([])
  const onsetHandlerRef = useRef<((e: MessageEvent) => void) | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const beatCountRef = useRef(0)
  const nextBeatTimeRef = useRef(0)
  const sourceTypeRef = useRef<'mic' | 'ble'>('mic')
  const bleUnsubRef = useRef<(() => void) | null>(null)
  /** performance.now() value at exercise t=0 — needed to convert BLE timestamps into AudioContext seconds */
  const perfToAudioOffsetRef = useRef(0)

  const setActiveSourceType = useCallback((type: 'mic' | 'ble') => {
    setActiveSourceTypeState(type)
  }, [])

  const calibrationData = activeSourceType === 'ble' ? bleCalibration : micCalibration

  const loadStoredCalibration = useCallback((): CalibrationData | null => {
    const mic = loadFromStorage(STORAGE_KEY_MIC)
    const ble = loadFromStorage(STORAGE_KEY_BLE)
    if (mic) setMicCalibration(mic)
    if (ble) setBleCalibration(ble)
    return activeSourceType === 'ble' ? ble : mic
  }, [activeSourceType])

  const clearCalibration = useCallback((sourceType?: 'mic' | 'ble') => {
    const target = sourceType ?? activeSourceType
    if (target === 'ble') {
      localStorage.removeItem(STORAGE_KEY_BLE)
      setBleCalibration(null)
    } else {
      localStorage.removeItem(STORAGE_KEY_MIC)
      setMicCalibration(null)
    }
  }, [activeSourceType])

  const cancelCalibration = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    setVisual(null)
    for (const osc of micClicksRef.current) { try { osc.stop() } catch { /* Already ended. */ } }
    micClicksRef.current = []
    setIsCalibrating(false)
    setCalibrationBeat(0)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (workletNodeRef.current && onsetHandlerRef.current) {
      workletNodeRef.current.port.removeEventListener('message', onsetHandlerRef.current)
      workletNodeRef.current = null
      onsetHandlerRef.current = null
    }
    if (bleUnsubRef.current) {
      bleUnsubRef.current()
      bleUnsubRef.current = null
    }
  }, [])

  const computeCalibration = useCallback((expectedTimes: number[], onsets: OnsetEvent[], sourceType: 'mic' | 'ble'): CalibrationData | null => {
    if (onsets.length < 4) {
      setCalibrationError(
        `Not enough taps detected (${onsets.length} of 4 minimum). Make sure your ${sourceType === 'ble' ? 'PlaySense device' : 'mic'} is registering taps and try again.`
      )
      return null
    }

    const offsets: number[] = []
    const matchedBeats = new Set<number>()
    for (const onset of onsets) {
      let minDist = Infinity
      let bestOffset = 0
      let bestBeat = -1
      for (const [index, expected] of expectedTimes.entries()) {
        if (sourceType === 'mic' && matchedBeats.has(index)) continue
        const dist = Math.abs(onset.timestamp - expected)
        if (dist < minDist) {
          minDist = dist
          bestOffset = onset.timestamp - expected
          bestBeat = index
        }
      }
      if (bestBeat >= 0 && Math.abs(bestOffset) < 0.2) {
        matchedBeats.add(bestBeat)
        offsets.push(bestOffset * 1000)
      }
    }

    if (offsets.length < 4) {
      setCalibrationError(
        `Not enough valid taps detected (${offsets.length} of 4 minimum). Tap more closely to the beat and try again.`
      )
      return null
    }

    // Setup quality gates, not student pass grades or a scientific latency estimate.
    if (sourceType === 'mic' && offsets.length < 12) {
      setCalibrationError('timing-insufficient')
      return null
    }
    const sorted = [...offsets].sort((a, b) => a - b)
    const q1 = sorted[Math.floor(sorted.length * 0.25)]
    const q3 = sorted[Math.floor(sorted.length * 0.75)]
    const iqr = q3 - q1
    const lower = q1 - 1.5 * iqr
    const upper = q3 + 1.5 * iqr
    const filtered = sorted.filter(o => o >= lower && o <= upper)

    if (filtered.length < 3) {
      setCalibrationError(
        'Tap timing was too inconsistent. Try tapping more steadily with the beat.'
      )
      return null
    }

    const mid = Math.floor(filtered.length / 2)
    const median = filtered.length % 2 === 0
      ? (filtered[mid - 1] + filtered[mid]) / 2
      : filtered[mid]

    const fq1 = filtered[Math.floor(filtered.length * 0.25)]
    const fq3 = filtered[Math.floor(filtered.length * 0.75)]
    const finalIqr = fq3 - fq1

    if (sourceType === 'mic' && (iqr > 80 || filtered.length < 12)) {
      setCalibrationError('timing-inconsistent')
      return null
    }
    const data: CalibrationData = {
      latencyMs: Math.round(median * 100) / 100,
      iqrMs: Math.round(finalIqr * 100) / 100,
      sampleRate: audioCtxRef.current?.sampleRate || 44100,
      browser: navigator.userAgent,
      timestamp: new Date().toISOString(),
      method: 'tap_along',
    }

    // Microphone timing is committed with the completed acoustic profile.
    // Keep sensor persistence unchanged.
    if (sourceType === 'ble') {
      localStorage.setItem(STORAGE_KEY_BLE, JSON.stringify(data))
      setBleCalibration(data)
    } else {
      setMicCalibration(data)
    }
    return data
  }, [])

  const startCalibration = useCallback((audioContext: AudioContext, source: CalibrationSource) => {
    if (source.type === 'mic') { cancelCalibration(); setMicCalibration(null) }
    audioCtxRef.current = audioContext
    sourceTypeRef.current = source.type
    setActiveSourceTypeState(source.type)
    setIsCalibrating(true)
    setCalibrationBeat(0)
    setCalibrationError(null)
    beatCountRef.current = 0
    expectedTimesRef.current = []
    onsetsRef.current = []

    const beatDuration = 60 / CALIBRATION_BPM
    const countInStart = audioContext.currentTime + 0.05
    const recordStart = countInStart + 4 * beatDuration
    timingStartRef.current = recordStart
    setTimingHits([])

    // Schedule count-in clicks
    for (let i = 0; i < 4; i++) {
      const osc = audioContext.createOscillator()
      if (source.type === 'mic') micClicksRef.current.push(osc)
      const gain = audioContext.createGain()
      osc.type = 'sine'
      osc.frequency.value = i === 0 ? 4400 : 3300
      gain.gain.value = i === 0 ? 0.3 : 0.15
      osc.connect(gain)
      gain.connect(audioContext.destination)
      const time = countInStart + i * beatDuration
      osc.start(time)
      osc.stop(time + 0.005)
      gain.gain.setValueAtTime(gain.gain.value, time)
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.005)
    }

    // Schedule recording beats
    const expectedTimes: number[] = []
    for (let i = 0; i < CALIBRATION_BEATS; i++) {
      const time = recordStart + i * beatDuration
      expectedTimes.push(time)

      const osc = audioContext.createOscillator()
      if (source.type === 'mic') micClicksRef.current.push(osc)
      const gain = audioContext.createGain()
      osc.type = 'sine'
      osc.frequency.value = i % 4 === 0 ? 4400 : 3300
      gain.gain.value = i % 4 === 0 ? 0.3 : 0.15
      osc.connect(gain)
      gain.connect(audioContext.destination)
      osc.start(time)
      osc.stop(time + 0.005)
      gain.gain.setValueAtTime(gain.gain.value, time)
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.005)
    }
    expectedTimesRef.current = expectedTimes

    // Wire up the chosen onset source
    if (source.type === 'mic') {
      if (source.workletNode) {
        workletNodeRef.current = source.workletNode
        const handler = (e: MessageEvent) => {
          if (e.data.type === 'onset' && e.data.timestamp >= recordStart - 0.2 && e.data.timestamp <= recordStart + CALIBRATION_BEATS * beatDuration) {
            const elapsed = e.data.timestamp - recordStart
            const beat = Math.max(0, Math.min(CALIBRATION_BEATS - 1, Math.round(elapsed / beatDuration)))
            setTimingHits(hits => [...hits, { elapsed, beat, offsetMs: (elapsed - beat * beatDuration) * 1000 }])
            onsetsRef.current.push({
              timestamp: e.data.timestamp,
              energy: e.data.energy,
            })
          }
        }
        onsetHandlerRef.current = handler
        source.workletNode.port.addEventListener('message', handler)
      }
    } else {
      // BLE: receive timestamps in performance.now() and convert to AudioContext seconds
      // by sampling the offset right now.
      perfToAudioOffsetRef.current = performance.now() / 1000 - audioContext.currentTime
      bleUnsubRef.current = source.subscribeToHits((perfTimestampMs) => {
        const audioCtxSeconds = perfTimestampMs / 1000 - perfToAudioOffsetRef.current
        onsetsRef.current.push({ timestamp: audioCtxSeconds, energy: 1 })
      })
    }

    nextBeatTimeRef.current = recordStart
    if (source.type === 'mic') {
      const paint = () => {
        // Output timestamps map the audio being heard to the display clock.
        // Fall back to the context clock minus reported output latency.
        const stamp = audioContext.getOutputTimestamp?.()
        const audibleTime = stamp && typeof stamp.performanceTime === 'number' && stamp.performanceTime > 0 && typeof stamp.contextTime === 'number'
          ? Math.min(audioContext.currentTime, stamp.contextTime + (performance.now() - stamp.performanceTime) / 1000)
          : audioContext.currentTime - (audioContext.outputLatency || 0) - (audioContext.baseLatency || 0)
        const next = calibrationVisual(audibleTime, countInStart)
        setVisual(previous => previous?.phase === next.phase && previous.countInBeat === next.countInBeat && previous.beat === next.beat && previous.pulse === next.pulse ? previous : next)
        setCalibrationBeat(next.beat)
        if (audibleTime > recordStart + CALIBRATION_BEATS * beatDuration + 0.5) {
          cancelCalibration()
          computeCalibration(expectedTimesRef.current, onsetsRef.current, 'mic')
          return
        }
        frameRef.current = requestAnimationFrame(paint)
      }
      paint()
      return
    }
    intervalRef.current = setInterval(() => {
      if (!audioCtxRef.current) return
      const now = audioCtxRef.current.currentTime
      if (now >= nextBeatTimeRef.current && beatCountRef.current < CALIBRATION_BEATS) {
        beatCountRef.current++
        setCalibrationBeat(beatCountRef.current)
        nextBeatTimeRef.current += beatDuration
      }
      if (beatCountRef.current >= CALIBRATION_BEATS && now > recordStart + CALIBRATION_BEATS * beatDuration + 0.5) {
        cancelCalibration()
        computeCalibration(expectedTimesRef.current, onsetsRef.current, sourceTypeRef.current)
      }
    }, 25)
  }, [cancelCalibration, computeCalibration])

  return {
    calibrationData,
    micCalibration,
    bleCalibration,
    isCalibrating,
    calibrationBeat,
    calibrationVisual: visual,
    getTimingElapsed, timingHits,
    totalCalibrationBeats: CALIBRATION_BEATS,
    calibrationError,
    setActiveSourceType,
    startCalibration,
    cancelCalibration,
    loadStoredCalibration,
    clearCalibration,
  }
}
