'use client'
import type { LiveAudioInput } from '@/lib/audio/live-audio-input'

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
  inputPeak: number
  devices: MediaDeviceInfo[]
  selectedDeviceId: string
  deviceLabel: string | null
  selectDevice: (id: string) => Promise<void>
  setDetectionFloor: (value: number | null, sampling?: boolean) => void
  calibrationOnsets: OnsetEvent[]
  recentOnsets: OnsetEvent[]
  audioContext: AudioContext | null
  workletNode: AudioWorkletNode | null
  /** Chord chroma vectors keyed by rounded onset timestamp (ms). Read by the grader for chord events. */
  chromaByOnsetRef: MutableRefObject<Map<number, number[]>>
  getFrequency: () => number | null
  getLiveAudioInput: () => LiveAudioInput | null
  getWorkletNode: () => AudioWorkletNode | null
  startListening: () => Promise<AudioContext | null>
  stopListening: () => void
  clearOnsets: () => void
}

export function useOnsetDetection(
  options: UseOnsetDetectionOptions = {}
): UseOnsetDetectionResult {
  const { noisyRoomMode = false, instrument = null, audioMode } = options

  const [calibrationOnsets, setCalibrationOnsets] = useState<OnsetEvent[]>([])
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const selectedIdRef = useRef('')
  const [deviceLabel, setDeviceLabel] = useState<string | null>(null)
  const detectionFloorRef = useRef<number | null>(null)
  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    const list = await navigator.mediaDevices.enumerateDevices()
    setDevices(list.filter(device => device.kind === 'audioinput'))
  }, [])
  const [isListening, setIsListening] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [inputLevel, setInputLevel] = useState(0)
  const [inputPeak, setInputPeak] = useState(0)
  const peakHoldRef = useRef({ value: 0, until: 0 })
  const [recentOnsets, setRecentOnsets] = useState<OnsetEvent[]>([])

  const [resources, setResources] = useState<{ audioContext: AudioContext | null; workletNode: AudioWorkletNode | null }>({ audioContext: null, workletNode: null })
  const generationRef = useRef(0)
  const pitchWorkletRef = useRef<AudioWorkletNode | null>(null)
  const silentSinkRef = useRef<GainNode | null>(null)
  const pitchRef = useRef<{ frequency: number | null; at: number }>({ frequency: null, at: 0 })
  const audioContextRef = useRef<AudioContext | null>(null)
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const levelUpdateRef = useRef<number>(0)
  const chromaByOnsetRef = useRef<Map<number, number[]>>(new Map())

  const stopListening = useCallback(() => {
    generationRef.current++
    inputSourceRef.current = null
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
    setInputPeak(0)
    peakHoldRef.current = { value: 0, until: 0 }
  }, [])

  const clearOnsets = useCallback(() => {
    setRecentOnsets([])
    setCalibrationOnsets([])
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
          ...(selectedIdRef.current ? { deviceId: { exact: selectedIdRef.current } } : {}),
          echoCancellation: useSpeakerSafe,
          noiseSuppression: useSpeakerSafe,
          autoGainControl: false,
        },
      })
      if (generation !== generationRef.current) { stream.getTracks().forEach(track => track.stop()); return null }
      mediaStreamRef.current = stream
      const track = stream.getAudioTracks()[0]
      const actualId = track?.getSettings().deviceId ?? ''
      selectedIdRef.current = actualId
      setSelectedDeviceId(actualId)
      setDeviceLabel(track?.label || null)
      try { if (actualId) localStorage.setItem('lmm.microphone.device', actualId) } catch { /* Optional device preference. */ }
      void refreshDevices().catch(() => {})
      track?.addEventListener('ended', () => {
        if (mediaStreamRef.current !== stream) return
        stopListening()
        setError('Microphone disconnected. Select an input to continue.')
      })
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
      await audioContext.audioWorklet.addModule('/audio-worklets/onset-detector-processor.js?v=clap-attack-3')
      if (generation !== generationRef.current) return null

      const source = audioContext.createMediaStreamSource(stream)
      inputSourceRef.current = source
      const workletNode = new AudioWorkletNode(audioContext, 'onset-detector-processor')
      workletNodeRef.current = workletNode
      workletNode.onprocessorerror = () => {
        if (workletNodeRef.current !== workletNode) return
        stopListening()
        setError('Microphone audio processor stopped. Enable the microphone again before retrying.')
      }

      // Send config — use instrument-specific profile when available
      const speakerSafe = audioMode === 'speaker-safe'
      const config: OnsetConfig = instrument
        ? getInstrumentConfig(instrument, noisyRoomMode, speakerSafe)
        : getInstrumentConfig('conga', noisyRoomMode, speakerSafe)
      workletNode.port.postMessage({ type: 'config', config: { ...config, ...(detectionFloorRef.current != null ? { minOnsetEnergy: detectionFloorRef.current, adaptiveThresholdOffset: Math.min(config.adaptiveThresholdOffset, detectionFloorRef.current * .25) } : {}) } })

      // Listen for messages from worklet
      workletNode.port.onmessage = (e) => {
        if (e.data.type === 'onset') {
          const onset: OnsetEvent = {
            timestamp: e.data.timestamp,
            energy: e.data.energy,
            frequency: e.data.frequency ?? null,
          }
          setCalibrationOnsets(prev => [...prev, onset].slice(-500))
          setRecentOnsets((prev) => {
            const next = [...prev, onset]
            // Cap at 500 to prevent unbounded growth
            return next.length > 500 ? next.slice(-500) : next
          })
        } else if (e.data.type === 'onset-level') {
          setCalibrationOnsets(previous => previous.map(hit => hit.timestamp === e.data.timestamp ? { ...hit, peak: e.data.peak, rms: e.data.rms } : hit))
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
          // Inspect every audio block before throttling so brief claps are not lost.
          const peak = e.data.peak ?? 0
          if (peak >= peakHoldRef.current.value || now >= peakHoldRef.current.until) {
            peakHoldRef.current = { value: peak, until: now + 800 }
          }
          if (now - levelUpdateRef.current > 33) {
            levelUpdateRef.current = now
            setInputLevel(e.data.level)
            setInputPeak(peakHoldRef.current.value)
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
    setCalibrationOnsets([])
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
  }, [noisyRoomMode, instrument, audioMode, stopListening, refreshDevices])

  const setDetectionFloor = useCallback((value: number | null, sampling = false) => {
    detectionFloorRef.current = value
    const base = getInstrumentConfig(instrument ?? 'conga', noisyRoomMode, audioMode === 'speaker-safe')
    workletNodeRef.current?.port.postMessage({ type: 'config', config: { minOnsetEnergy: sampling ? .0001 : value ?? base.minOnsetEnergy, adaptiveThresholdOffset: sampling ? .0001 : value != null ? Math.min(base.adaptiveThresholdOffset, value * .25) : base.adaptiveThresholdOffset, refractoryPeriodMs: sampling ? 300 : base.refractoryPeriodMs } })
  }, [instrument, noisyRoomMode, audioMode])

  const selectDevice = useCallback(async (id: string) => {
    stopListening()
    selectedIdRef.current = id
    setSelectedDeviceId(id)
    detectionFloorRef.current = null
    await startListening()
  }, [stopListening, startListening])

  useEffect(() => {
    const media = navigator.mediaDevices
    if (!media?.enumerateDevices) return
    let live = true
    void media.enumerateDevices().then(list => {
      if (!live) return
      setDevices(list.filter(d => d.kind === 'audioinput'))
      const saved = localStorage.getItem('lmm.microphone.device')
      if (!mediaStreamRef.current && saved && list.some(d => d.deviceId === saved)) {
        selectedIdRef.current = saved
        setSelectedDeviceId(saved)
      }
    }).catch(() => {})
    const changed = () => { void refreshDevices().catch(() => {}) }
    media.addEventListener?.('devicechange', changed)
    return () => { live = false; media.removeEventListener?.('devicechange', changed) }
  }, [refreshDevices])

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
  const getLiveAudioInput = useCallback(() => {
    const context = audioContextRef.current, stream = mediaStreamRef.current
    return context && context.state !== 'closed' && stream?.active && inputSourceRef.current ? { context, stream, source: inputSourceRef.current } : null
  }, [])
  const getWorkletNode = useCallback(() => workletNodeRef.current, [])

  return {
    isListening,
    hasPermission,
    error,
    inputLevel,
    inputPeak,
    devices, selectedDeviceId, deviceLabel, selectDevice, setDetectionFloor,
    recentOnsets, calibrationOnsets,
    audioContext: resources.audioContext,
    workletNode: resources.workletNode,
    getFrequency,
    getWorkletNode,
    getLiveAudioInput,
    chromaByOnsetRef,
    startListening,
    stopListening,
    clearOnsets,
  }
}
