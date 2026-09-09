'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { OnsetEvent, Instrument } from '@/lib/play-sense/types'
import { usePlaysense } from '@/contexts/playsense-context'
import { inputTimestampToAudioTime } from '@/lib/play-sense/input-events'
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
  const subscribeToReadings = playsense.subscribeToReadings

  const [isListening, setIsListening] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [inputLevel, setInputLevel] = useState(0)
  const [recentOnsets, setRecentOnsets] = useState<OnsetEvent[]>([])

  const audioContextRef = useRef<AudioContext | null>(null)
  const listeningRef = useRef(false)
  const generationRef = useRef(0)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  /** Subscribers that always fire on any BLE hit (irrespective of `isListening`). */
  const hitSubscribersRef = useRef<Set<(ts: number) => void>>(new Set())

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
    generationRef.current++
    listeningRef.current = false
    setIsListening(false)
    setAudioContext(null)
    setInputLevel(0)
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
  }, [])

  const startListening = useCallback(async (): Promise<AudioContext | null> => {
    const generation = ++generationRef.current
    const AudioContextClass =
      typeof window !== 'undefined'
        ? window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        : null
    if (!AudioContextClass) {
      return null
    }

    setLocalError(null)
    try {
      let audioContext = audioContextRef.current
      if (audioContext && audioContext.state !== 'closed') {
        await audioContext.resume()
      } else {
        audioContext = new AudioContextClass()
        await audioContext.resume()
        audioContextRef.current = audioContext
      }

      if (!playsense.isConnected()) await playsense.connect()
      if (generation !== generationRef.current) return null
      if (!playsense.isConnected()) { setLocalError('No PlaySense device connected. Connect your device and try again.'); stopListening(); return null }
      listeningRef.current = true
      setAudioContext(audioContext)
      setIsListening(true)
      setRecentOnsets([])
      return audioContext
    } catch {
      if (generation === generationRef.current) {
        setLocalError('Could not start the PlaySense input. Check your connection and try again.')
        stopListening()
      }
      return null
    }
  }, [playsense, stopListening])

  // Every packet is delivered directly; UI batching cannot collapse rapid hits.
  useEffect(() => subscribeToReadings(reading => {
    if ((reading.piezos || []).some(value => value > 0)) {
      for (const cb of hitSubscribersRef.current) cb(reading.receivedAt)
    }
    const context = audioContextRef.current
    if (!listeningRef.current || !instrument || !context || context.state !== 'running') return
    const mapping = getPlaySenseMapping(instrument)
    if (!mapping) return
    const timestamp = inputTimestampToAudioTime(reading.receivedAt, performance.now(), context.currentTime)
    const onsets: OnsetEvent[] = []
    for (let i = 0; i < reading.piezos.length; i++) {
      const value = reading.piezos[i]
      if (Number.isFinite(value) && value > 0 && mapping.piezoMap[i] !== undefined) {
        onsets.push({ timestamp, energy: value, surface: mapping.piezoMap[i] })
      }
    }
    if (onsets.length) setRecentOnsets(prev => [...prev, ...onsets].slice(-500))
    setInputLevel(Math.min(Math.max(...reading.piezos, 0) / 4095, 1))
  }), [subscribeToReadings, instrument])

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
    error: localError ?? playsense.error,
    inputLevel,
    recentOnsets,
    audioContext,
    workletNode: null,
    startListening,
    stopListening,
    clearOnsets,
    subscribeToHits,
  }
}
