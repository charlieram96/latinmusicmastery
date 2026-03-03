'use client'

import { useState, useRef, useCallback } from 'react'
import type { CalibrationData, OnsetEvent } from '@/lib/play-sense/types'

const STORAGE_KEY = 'playSenseCalibration'
const CALIBRATION_BPM = 100
const CALIBRATION_BEATS = 16

interface UseCalibrationResult {
  calibrationData: CalibrationData | null
  isCalibrating: boolean
  calibrationBeat: number
  totalCalibrationBeats: number
  startCalibration: (audioContext: AudioContext, onsetWorkletNode?: AudioWorkletNode | null) => void
  cancelCalibration: () => void
  loadStoredCalibration: () => CalibrationData | null
  clearCalibration: () => void
}

export function useCalibration(): UseCalibrationResult {
  const [calibrationData, setCalibrationData] = useState<CalibrationData | null>(null)
  const [isCalibrating, setIsCalibrating] = useState(false)
  const [calibrationBeat, setCalibrationBeat] = useState(0)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const expectedTimesRef = useRef<number[]>([])
  const onsetsRef = useRef<OnsetEvent[]>([])
  const onsetHandlerRef = useRef<((e: MessageEvent) => void) | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const beatCountRef = useRef(0)
  const nextBeatTimeRef = useRef(0)

  const loadStoredCalibration = useCallback((): CalibrationData | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return null
      const data = JSON.parse(stored) as CalibrationData
      // Check if browser changed (invalidate)
      if (data.browser !== navigator.userAgent) return null
      setCalibrationData(data)
      return data
    } catch {
      return null
    }
  }, [])

  const clearCalibration = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setCalibrationData(null)
  }, [])

  const cancelCalibration = useCallback(() => {
    setIsCalibrating(false)
    setCalibrationBeat(0)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (workletNodeRef.current && onsetHandlerRef.current) {
      workletNodeRef.current.port.removeEventListener('message', onsetHandlerRef.current)
    }
  }, [])

  const computeCalibration = useCallback((expectedTimes: number[], onsets: OnsetEvent[]): CalibrationData | null => {
    if (onsets.length < 4) return null

    // For each onset, find the nearest expected beat and compute offset
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
      // Only include if reasonably close (within 200ms)
      if (Math.abs(bestOffset) < 0.2) {
        offsets.push(bestOffset * 1000) // Convert to ms
      }
    }

    if (offsets.length < 4) return null

    // Remove outliers (beyond 1.5 * IQR)
    const sorted = [...offsets].sort((a, b) => a - b)
    const q1 = sorted[Math.floor(sorted.length * 0.25)]
    const q3 = sorted[Math.floor(sorted.length * 0.75)]
    const iqr = q3 - q1
    const lower = q1 - 1.5 * iqr
    const upper = q3 + 1.5 * iqr
    const filtered = sorted.filter(o => o >= lower && o <= upper)

    if (filtered.length < 3) return null

    // Compute median
    const mid = Math.floor(filtered.length / 2)
    const median = filtered.length % 2 === 0
      ? (filtered[mid - 1] + filtered[mid]) / 2
      : filtered[mid]

    // Compute IQR of filtered values
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

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    setCalibrationData(data)
    return data
  }, [])

  const startCalibration = useCallback((audioContext: AudioContext, onsetWorkletNode?: AudioWorkletNode | null) => {
    audioCtxRef.current = audioContext
    setIsCalibrating(true)
    setCalibrationBeat(0)
    beatCountRef.current = 0
    expectedTimesRef.current = []
    onsetsRef.current = []

    const beatDuration = 60 / CALIBRATION_BPM

    // 4-beat count-in then 16 recording beats
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

    // Listen for onset events from the worklet node passed in by the session hook
    if (onsetWorkletNode) {
      workletNodeRef.current = onsetWorkletNode
      const handler = (e: MessageEvent) => {
        if (e.data.type === 'onset') {
          onsetsRef.current.push({
            timestamp: e.data.timestamp,
            energy: e.data.energy,
          })
        }
      }
      onsetHandlerRef.current = handler
      onsetWorkletNode.port.addEventListener('message', handler)
    }

    // Track beats for UI
    nextBeatTimeRef.current = recordStart
    intervalRef.current = setInterval(() => {
      if (!audioCtxRef.current) return
      const now = audioCtxRef.current.currentTime
      if (now >= nextBeatTimeRef.current && beatCountRef.current < CALIBRATION_BEATS) {
        beatCountRef.current++
        setCalibrationBeat(beatCountRef.current)
        nextBeatTimeRef.current += beatDuration
      }
      // End calibration
      if (beatCountRef.current >= CALIBRATION_BEATS && now > recordStart + CALIBRATION_BEATS * beatDuration + 0.5) {
        cancelCalibration()
        computeCalibration(expectedTimesRef.current, onsetsRef.current)
      }
    }, 25)
  }, [cancelCalibration, computeCalibration])

  return {
    calibrationData,
    isCalibrating,
    calibrationBeat,
    totalCalibrationBeats: CALIBRATION_BEATS,
    startCalibration,
    cancelCalibration,
    loadStoredCalibration,
    clearCalibration,
  }
}
