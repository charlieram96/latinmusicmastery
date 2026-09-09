'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { MutableRefObject } from 'react'
import type { OnsetEvent, Instrument } from '@/lib/play-sense/types'
import { getInstrumentCategory } from '@/lib/play-sense/types'
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
  /** Chord chroma vectors keyed by rounded onset timestamp (ms). Read by the grader for chord events. */
  chromaByOnsetRef: MutableRefObject<Map<number, number[]>>
  getFrequency: () => number | null
  getWorkletNode: () => AudioWorkletNode | null
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

  const [resources, setResources] = useState<{ audioContext: AudioContext | null; workletNode: AudioWorkletNode | null }>({ audioContext: null, workletNode: null })
  const generationRef = useRef(0)
  const pitchWorkletRef = useRef<AudioWorkletNode | null>(null)
  const silentSinkRef = useRef<GainNode | null>(null)
  const pitchRef = useRef<{ frequency: number | null; at: number }>({ frequency: null, at: 0 })
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const levelUpdateRef = useRef<number>(0)
  const chromaByOnsetRef = useRef<Map<number, number[]>>(new Map())

  const stopListening = useCallback(() => {
    generationRef.current++
    pitchWorkletRef.current?.disconnect()
    pitchWorkletRef.current = null
    silentSinkRef.current?.disconnect()
    silentSinkRef.current = null
    pitchRef.current = { frequency: null, at: 0 }
    setResources({ audioContext: null, workletNode: null })
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
    chromaByOnsetRef.current.clear()
  }, [])

  const startListening = useCallback(async (): Promise<AudioContext | null> => {
    setError(null)
    const generation = ++generationRef.current
    if (audioContextRef.current?.state !== 'closed' && audioContextRef.current && workletNodeRef.current && mediaStreamRef.current?.active) {
      await audioContextRef.current.resume()
      return audioContextRef.current
    }

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
      if (generation !== generationRef.current) { stream.getTracks().forEach(track => track.stop()); return null }
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
      if (generation !== generationRef.current) return null

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
            frequency: e.data.frequency ?? null,
          }
          setRecentOnsets((prev) => {
            const next = [...prev, onset]
            // Cap at 500 to prevent unbounded growth
            return next.length > 500 ? next.slice(-500) : next
          })
        } else if (e.data.type === 'chord') {
          // Post-strum chroma for chord scoring — key by rounded onset timestamp (ms).
          const key = Math.round(e.data.onsetTimestamp * 1000)
          const map = chromaByOnsetRef.current
          map.set(key, e.data.chroma)
          // Bound growth
          if (map.size > 200) {
            const oldest = map.keys().next().value
            if (oldest !== undefined) map.delete(oldest)
          }
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
      // A silent sink keeps both processors scheduled without monitoring the mic.
      const sink = audioContext.createGain()
      sink.gain.value = 0
      sink.connect(audioContext.destination)
      workletNode.connect(sink)
      silentSinkRef.current = sink
      if (instrument && getInstrumentCategory(instrument) === 'pitched') {
        await audioContext.audioWorklet.addModule('/audio-worklets/pitch-detector-processor.js')
        if (generation !== generationRef.current) return null
        const pitchNode = new AudioWorkletNode(audioContext, 'pitch-detector-processor')
        pitchNode.port.onmessage = message => {
          pitchRef.current = { frequency: message.data.hz ?? null, at: performance.now() }
        }
        source.connect(pitchNode)
        pitchNode.connect(sink)
        pitchWorkletRef.current = pitchNode
      }
      setResources({ audioContext, workletNode })

      setIsListening(true)
      setRecentOnsets([])
      return audioContext
    } catch (err: unknown) {
      if (generation !== generationRef.current) return null
      const domErr = err as DOMException
      if (domErr.name === 'NotAllowedError') {
        setHasPermission(false)
        setError('Microphone permission was denied. Click the lock/site-info icon in your address bar, allow microphone access, then click Play to retry.')
      } else if (domErr.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.')
      } else if (domErr.name === 'NotReadableError') {
        setError('Your microphone is in use by another app. Close other apps that might be using it and try again.')
      } else if (err instanceof Error && err.message.toLowerCase().includes('worklet')) {
        setError('Audio processor failed to load. Refresh the page (the AudioWorklet must be served over HTTPS or localhost).')
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
      // Invalidate pending permission/worklet work at unmount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generationRef.current++
      pitchWorkletRef.current?.disconnect()
      silentSinkRef.current?.disconnect()
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

  const getFrequency = useCallback(() => performance.now() - pitchRef.current.at <= 150 ? pitchRef.current.frequency : null, [])
  const getWorkletNode = useCallback(() => workletNodeRef.current, [])

  return {
    isListening,
    hasPermission,
    error,
    inputLevel,
    recentOnsets,
    audioContext: resources.audioContext,
    workletNode: resources.workletNode,
    getFrequency,
    getWorkletNode,
    chromaByOnsetRef,
    startListening,
    stopListening,
    clearOnsets,
  }
}
