'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { OnsetEvent, Instrument } from '@/lib/play-sense/types'
import { getInstrumentConfig, type OnsetConfig } from '@/lib/play-sense/onset-config'

type AudioMode = 'headphones' | 'speaker-safe'

interface UseOnsetDetectionOptions {
  noisyRoomMode?: boolean
  instrument?: Instrument | null
  audioMode?: AudioMode
}

interface UseOnsetDetectionResult {
  isListening: boolean
  hasPermission: boolean | null
  error: string | null
  inputLevel: number
  recentOnsets: OnsetEvent[]
  audioContext: AudioContext | null
  workletNode: AudioWorkletNode | null
  startListening: () => Promise<AudioContext | null>
  stopListening: () => void
  clearOnsets: () => void
}

export function useOnsetDetection(
  options: UseOnsetDetectionOptions = {}
): UseOnsetDetectionResult {
  const { noisyRoomMode = false, instrument = null, audioMode } = options

  const [isListening, setIsListening] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [inputLevel, setInputLevel] = useState(0)
  const [recentOnsets, setRecentOnsets] = useState<OnsetEvent[]>([])

  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const levelUpdateRef = useRef<number>(0)

  const stopListening = useCallback(() => {
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect()
      workletNodeRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    setIsListening(false)
    setInputLevel(0)
  }, [])

  const clearOnsets = useCallback(() => {
    setRecentOnsets([])
  }, [])

  const startListening = useCallback(async (): Promise<AudioContext | null> => {
    setError(null)

    const AudioContextClass =
      typeof window !== 'undefined'
        ? window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        : null
    if (!AudioContextClass) {
      setError('Web Audio API is not supported in this browser.')
      return null
    }

    try {
      // In speaker-safe mode, enable browser echo cancellation to reduce backing track bleed
      const useSpeakerSafe = audioMode === 'speaker-safe'
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: useSpeakerSafe,
          noiseSuppression: useSpeakerSafe,
          autoGainControl: false,
        },
      })
      mediaStreamRef.current = stream
      setHasPermission(true)

      // Reuse existing AudioContext if still open, otherwise create new
      let audioContext = audioContextRef.current
      if (audioContext && audioContext.state !== 'closed') {
        await audioContext.resume()
      } else {
        audioContext = new AudioContextClass()
        await audioContext.resume()
        audioContextRef.current = audioContext
      }

      // Load AudioWorklet
      await audioContext.audioWorklet.addModule('/audio-worklets/onset-detector-processor.js')

      const source = audioContext.createMediaStreamSource(stream)
      const workletNode = new AudioWorkletNode(audioContext, 'onset-detector-processor')
      workletNodeRef.current = workletNode

      // Send config — use instrument-specific profile when available
      const speakerSafe = audioMode === 'speaker-safe'
      const config: OnsetConfig = instrument
        ? getInstrumentConfig(instrument, noisyRoomMode, speakerSafe)
        : getInstrumentConfig('conga', noisyRoomMode, speakerSafe)
      workletNode.port.postMessage({ type: 'config', config })

      // Listen for messages from worklet
      workletNode.port.onmessage = (e) => {
        if (e.data.type === 'onset') {
          const onset: OnsetEvent = {
            timestamp: e.data.timestamp,
            energy: e.data.energy,
          }
          setRecentOnsets((prev) => {
            const next = [...prev, onset]
            // Cap at 500 to prevent unbounded growth
            return next.length > 500 ? next.slice(-500) : next
          })
        } else if (e.data.type === 'level') {
          // Throttle level updates to ~30fps
          const now = performance.now()
          if (now - levelUpdateRef.current > 33) {
            levelUpdateRef.current = now
            setInputLevel(e.data.level)
          }
        }
      }

      source.connect(workletNode)
      // Don't connect workletNode to destination — we don't want to hear the mic

      setIsListening(true)
      setRecentOnsets([])
      return audioContext
    } catch (err: unknown) {
      const domErr = err as DOMException
      if (domErr.name === 'NotAllowedError') {
        setHasPermission(false)
        setError('Microphone permission was denied. Please allow access to use Play Sense.')
      } else if (domErr.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.')
      } else {
        setError('Could not access the microphone. Please try again.')
      }
      stopListening()
      return null
    }
  }, [noisyRoomMode, instrument, audioMode, stopListening])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (workletNodeRef.current) {
        workletNodeRef.current.disconnect()
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
      }
    }
  }, [])

  return {
    isListening,
    hasPermission,
    error,
    inputLevel,
    recentOnsets,
    audioContext: audioContextRef.current,
    workletNode: workletNodeRef.current,
    startListening,
    stopListening,
    clearOnsets,
  }
}
