'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { OnsetEvent, Instrument } from '@/lib/play-sense/types'
import { usePlaysense } from '@/contexts/playsense-context'
import { getPlaySenseMapping } from '@/lib/play-sense/playsense-mappings'

interface UsePlaysenseOnsetsResult {
  isListening: boolean
  hasPermission: boolean | null
  error: string | null
  inputLevel: number
  recentOnsets: OnsetEvent[]
  audioContext: AudioContext | null
  workletNode: null
  startListening: () => Promise<AudioContext | null>
  stopListening: () => void
  clearOnsets: () => void
  /** Subscribe to BLE hits regardless of `isListening` — used by calibration. */
  subscribeToHits: (cb: (timestampMs: number) => void) => () => void
}

export function usePlaysenseOnsets(
  instrument: Instrument | null
): UsePlaysenseOnsetsResult {
  const playsense = usePlaysense()

  const [isListening, setIsListening] = useState(false)
  const [inputLevel, setInputLevel] = useState(0)
  const [recentOnsets, setRecentOnsets] = useState<OnsetEvent[]>([])

  const audioContextRef = useRef<AudioContext | null>(null)
  const lastReadingRef = useRef<number>(0)
  /** Subscribers that always fire on any BLE hit (irrespective of `isListening`). */
  const hitSubscribersRef = useRef<Set<(ts: number) => void>>(new Set())
  const lastHitReadingRef = useRef<number>(0)

  const subscribeToHits = useCallback((cb: (timestampMs: number) => void) => {
    hitSubscribersRef.current.add(cb)
    return () => {
      hitSubscribersRef.current.delete(cb)
    }
  }, [])

  const clearOnsets = useCallback(() => {
    setRecentOnsets([])
  }, [])

  const stopListening = useCallback(() => {
    setIsListening(false)
    setInputLevel(0)
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
  }, [])

  const startListening = useCallback(async (): Promise<AudioContext | null> => {
    const AudioContextClass =
      typeof window !== 'undefined'
        ? window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        : null
    if (!AudioContextClass) {
      return null
    }

    let audioContext = audioContextRef.current
    if (audioContext && audioContext.state !== 'closed') {
      await audioContext.resume()
    } else {
      audioContext = new AudioContextClass()
      await audioContext.resume()
      audioContextRef.current = audioContext
    }

    if (playsense.connectionStatus !== 'connected') {
      await playsense.connect()
    }

    setIsListening(true)
    setRecentOnsets([])
    return audioContext
  }, [playsense])

  // Always-on subscribers — fire on any BLE hit, regardless of `isListening`.
  // Used for the calibration wizard which doesn't go through the normal start/stop lifecycle.
  useEffect(() => {
    if (!playsense.lastReading) return
    const reading = playsense.lastReading
    if (reading.receivedAt <= lastHitReadingRef.current) return
    lastHitReadingRef.current = reading.receivedAt
    const anyHit = (reading.piezos || []).some((v) => v > 0)
    if (!anyHit) return
    for (const cb of hitSubscribersRef.current) {
      try { cb(reading.receivedAt) } catch { /* swallow */ }
    }
  }, [playsense.lastReading])

  useEffect(() => {
    if (!isListening || !playsense.lastReading || !instrument) return

    const reading = playsense.lastReading

    if (reading.receivedAt <= lastReadingRef.current) return
    lastReadingRef.current = reading.receivedAt

    const mapping = getPlaySenseMapping(instrument)
    if (!mapping) return

    const audioContext = audioContextRef.current
    if (!audioContext || audioContext.state === 'closed') return

    const timestamp = audioContext.currentTime

    const newOnsets: OnsetEvent[] = []
    for (let i = 0; i < reading.piezos.length; i++) {
      const val = reading.piezos[i]
      if (val > 0 && mapping.piezoMap[i] !== undefined) {
        newOnsets.push({
          timestamp,
          energy: val,
          surface: mapping.piezoMap[i],
        })
      }
    }

    if (newOnsets.length > 0) {
      setRecentOnsets((prev) => {
        const next = [...prev, ...newOnsets]
        return next.length > 500 ? next.slice(-500) : next
      })
    }

    const maxPiezo = Math.max(...reading.piezos, 0)
    setInputLevel(Math.min(maxPiezo / 4095, 1))
  }, [isListening, playsense.lastReading, instrument])

  useEffect(() => {
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {})
      }
    }
  }, [])

  const hasPermission = playsense.connectionStatus === 'connected' ? true
    : playsense.connectionStatus === 'error' ? false
    : null

  return {
    isListening: isListening && playsense.connectionStatus === 'connected',
    hasPermission,
    error: playsense.error,
    inputLevel,
    recentOnsets,
    audioContext: audioContextRef.current,
    workletNode: null,
    startListening,
    stopListening,
    clearOnsets,
    subscribeToHits,
  }
}
