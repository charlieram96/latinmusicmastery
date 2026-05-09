'use client'

import { useState, useRef, useCallback } from 'react'
import type { CalibrationData, OnsetEvent } from '@/lib/play-sense/types'

const STORAGE_KEY_MIC = 'playSenseCalibration'
const STORAGE_KEY_BLE = 'playSenseCalibrationBle'
const CALIBRATION_BPM = 100
const CALIBRATION_BEATS = 16

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
    for (const onset of onsets) {
      let minDist = Infinity
      let bestOffset = 0
      for (const expected of expectedTimes) {
        const dist = Math.abs(onset.timestamp - expected)
        if (dist < minDist) {
          minDist = dist
          bestOffset = onset.timestamp - expected
        }
      }
      if (Math.abs(bestOffset) < 0.2) {
        offsets.push(bestOffset * 1000)
      }
    }

    if (offsets.length < 4) {
      setCalibrationError(
        `Not enough valid taps detected (${offsets.length} of 4 minimum). Tap more closely to the beat and try again.`
      )
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

    const data: CalibrationData = {
      latencyMs: Math.round(median * 100) / 100,
      iqrMs: Math.round(finalIqr * 100) / 100,
      sampleRate: audioCtxRef.current?.sampleRate || 44100,
      browser: navigator.userAgent,
      timestamp: new Date().toISOString(),
      method: 'tap_along',
    }

    const key = sourceType === 'ble' ? STORAGE_KEY_BLE : STORAGE_KEY_MIC
    localStorage.setItem(key, JSON.stringify(data))
    if (sourceType === 'ble') {
      setBleCalibration(data)
    } else {
      setMicCalibration(data)
    }
    return data
  }, [])

  const startCalibration = useCallback((audioContext: AudioContext, source: CalibrationSource) => {
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

    // Schedule count-in clicks
    for (let i = 0; i < 4; i++) {
      const osc = audioContext.createOscillator()
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
          if (e.data.type === 'onset') {
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
    totalCalibrationBeats: CALIBRATION_BEATS,
    calibrationError,
    setActiveSourceType,
    startCalibration,
    cancelCalibration,
    loadStoredCalibration,
    clearCalibration,
  }
}
