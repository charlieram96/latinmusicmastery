'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { mpm, MPM_DEFAULTS } from '@/lib/tuner/pitch-engine'
import { PitchTracker, type TunerFrame } from '@/lib/tuner/pitch-tracker'
import { createTunerStore, EMPTY_SNAPSHOT, type TunerSnapshot, type TunerStore } from '@/lib/tuner/tuner-store'
import { SENSITIVITY_PRESETS, type Sensitivity } from '@/lib/tuner/sensitivity'
import { courseTargetMidi } from '@/lib/tuner/instruments'

export type EngineStatus = 'idle' | 'starting' | 'listening' | 'error'
export type EngineErrorKind = 'denied' | 'notfound' | 'busy' | 'unsupported' | 'unknown'

export interface AudioDevice {
  id: string
  label: string
}

export interface TunerEngineOptions {
  a4: number
  holdMs: number
  tolCents: number
  sensitivity: Sensitivity
  /** Manually selected course (its notes), or null for nearest-semitone mode. */
  targetCourse: number[] | null
  /** Called for every non-null frame (the page watches `justLocked`). */
  onFrame?: (frame: TunerFrame) => void
}

const WORKLET_URL = '/audio-worklets/pitch-detector-processor.js'
const WORKLET_NAME = 'pitch-detector-processor'
const FALLBACK_INTERVAL_MS = 33
const HIDDEN_STOP_MS = 60_000
const CLIP_PEAK = 0.98

type AudioContextCtor = typeof AudioContext

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  return window.AudioContext || (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext || null
}

function errorKindFor(err: unknown): EngineErrorKind {
  const name = (err as { name?: string } | null)?.name
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'notfound'
  if (name === 'NotReadableError' || name === 'AbortError') return 'busy'
  return 'unknown'
}

/**
 * Microphone → (AudioWorklet | AnalyserNode fallback) → PitchTracker → store.
 * Per-frame values live in the returned `store`; React state only changes on
 * status/device transitions.
 */
export function useTunerEngine(opts: TunerEngineOptions) {
  const store = useMemo(() => createTunerStore(), [])
  const tracker = useMemo(() => new PitchTracker(), [])
  const optsRef = useRef(opts)
  useEffect(() => {
    optsRef.current = opts
  }, [opts])

  const [status, setStatus] = useState<EngineStatus>('idle')
  const [errorKind, setErrorKind] = useState<EngineErrorKind | null>(null)
  const [devices, setDevices] = useState<AudioDevice[]>([])
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [deviceLabel, setDeviceLabel] = useState('')

  const ctxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const nodesRef = useRef<AudioNode[]>([])
  const workletRef = useRef<AudioWorkletNode | null>(null)
  const rafRef = useRef(0)
  const levelRef = useRef(0)
  const listeningRef = useRef(false)
  const hiddenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const getAudioContext = useCallback((): AudioContext => {
    const Ctor = getAudioContextCtor()
    if (!Ctor) throw new Error('unsupported')
    if (!ctxRef.current || ctxRef.current.state === 'closed') ctxRef.current = new Ctor()
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume().catch(() => {})
    return ctxRef.current
  }, [])

  const handleBlock = useCallback(
    (hz: number | null, clarity: number, rms: number, peak: number) => {
      const o = optsRef.current
      levelRef.current = levelRef.current * 0.5 + Math.min(1, rms * 9) * 0.5
      const frame = tracker.push(hz != null ? { hz, clarity } : null, performance.now(), o.a4, {
        holdMs: o.holdMs,
        tolCents: o.tolCents,
        targetMidi: o.targetCourse ? courseTargetMidi(o.targetCourse, hz, o.a4) : null,
      })
      store.set({ frame, level: levelRef.current, clip: peak > CLIP_PEAK })
      if (frame && o.onFrame) o.onFrame(frame)
    },
    [store, tracker]
  )

  const teardownGraph = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
    if (workletRef.current) {
      workletRef.current.port.onmessage = null
      workletRef.current = null
    }
    nodesRef.current.forEach((n) => {
      try {
        n.disconnect()
      } catch {
        /* already disconnected */
      }
    })
    nodesRef.current = []
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    listeningRef.current = false
    levelRef.current = 0
  }, [])

  const stop = useCallback(() => {
    teardownGraph()
    if (ctxRef.current && ctxRef.current.state !== 'closed') ctxRef.current.close().catch(() => {})
    ctxRef.current = null
    tracker.reset()
    store.reset()
    setStatus('idle')
  }, [store, teardownGraph, tracker])

  const startFallback = useCallback(
    (ctx: AudioContext, input: AudioNode) => {
      const analyser = ctx.createAnalyser()
      analyser.fftSize = MPM_DEFAULTS.bufferSize
      input.connect(analyser)
      nodesRef.current.push(analyser)
      const buf = new Float32Array(analyser.fftSize)
      let last = 0
      const tick = (t: number) => {
        rafRef.current = requestAnimationFrame(tick)
        if (t - last < FALLBACK_INTERVAL_MS) return
        last = t
        analyser.getFloatTimeDomainData(buf)
        let sum = 0
        let peak = 0
        for (let i = 0; i < buf.length; i++) {
          const v = buf[i]
          sum += v * v
          const a = v < 0 ? -v : v
          if (a > peak) peak = a
        }
        const rms = Math.sqrt(sum / buf.length)
        const gate = SENSITIVITY_PRESETS[optsRef.current.sensitivity]
        let hz: number | null = null
        let clarity = 0
        if (rms >= gate.rms) {
          const r = mpm(buf, ctx.sampleRate, MPM_DEFAULTS.minHz, MPM_DEFAULTS.maxHz, MPM_DEFAULTS.kMax)
          if (r) {
            clarity = r.clarity
            if (r.clarity >= gate.clarity) hz = r.hz
          }
        }
        handleBlock(hz, clarity, rms, peak)
      }
      rafRef.current = requestAnimationFrame(tick)
    },
    [handleBlock]
  )

  const start = useCallback(
    async (requestedDeviceId?: string) => {
      setErrorKind(null)
      setStatus('starting')
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || !getAudioContextCtor()) {
        setErrorKind('unsupported')
        setStatus('error')
        return
      }
      teardownGraph()
      try {
        const audio: MediaTrackConstraints = {
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
        if (requestedDeviceId) audio.deviceId = { exact: requestedDeviceId }
        const stream = await navigator.mediaDevices.getUserMedia({ audio })
        streamRef.current = stream

        const ctx = getAudioContext()
        await ctx.resume()
        const source = ctx.createMediaStreamSource(stream)
        const highpass = ctx.createBiquadFilter()
        highpass.type = 'highpass'
        highpass.frequency.value = 25
        source.connect(highpass)
        nodesRef.current.push(source, highpass)

        try {
          await ctx.audioWorklet.addModule(WORKLET_URL)
          const node = new AudioWorkletNode(ctx, WORKLET_NAME, { numberOfOutputs: 0 })
          node.port.postMessage({ type: 'config', ...SENSITIVITY_PRESETS[optsRef.current.sensitivity] })
          node.port.onmessage = (e: MessageEvent<{ hz: number | null; clarity: number; rms: number; peak: number }>) => {
            const d = e.data
            handleBlock(d.hz, d.clarity, d.rms, d.peak)
          }
          highpass.connect(node)
          nodesRef.current.push(node)
          workletRef.current = node
        } catch (err) {
          console.warn('[tuner] AudioWorklet unavailable, using AnalyserNode fallback', err)
          startFallback(ctx, highpass)
        }

        const track = stream.getAudioTracks()[0]
        const current = track?.getSettings().deviceId ?? requestedDeviceId ?? null
        setDeviceLabel(track?.label ?? '')
        setDeviceId(current)
        try {
          const all = await navigator.mediaDevices.enumerateDevices()
          setDevices(
            all
              .filter((d) => d.kind === 'audioinput')
              .map((d, i) => ({ id: d.deviceId, label: d.label || `Microphone ${i + 1}` }))
          )
        } catch {
          /* device list is optional */
        }

        listeningRef.current = true
        setStatus('listening')
      } catch (err) {
        teardownGraph()
        setErrorKind(errorKindFor(err))
        setStatus('error')
      }
    },
    [getAudioContext, handleBlock, startFallback, teardownGraph]
  )

  const setDevice = useCallback(
    (id: string) => {
      setDeviceId(id)
      if (listeningRef.current) {
        teardownGraph()
        void start(id)
      }
    },
    [start, teardownGraph]
  )

  const resetTracker = useCallback(() => {
    tracker.reset()
    const s = store.getSnapshot()
    if (s.frame) store.set({ ...s, frame: null })
  }, [store, tracker])

  // Keep the worklet's gates in sync with the sensitivity setting.
  useEffect(() => {
    workletRef.current?.port.postMessage({ type: 'config', ...SENSITIVITY_PRESETS[opts.sensitivity] })
  }, [opts.sensitivity])

  // Stop the mic if the tab stays hidden for a while.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        if (listeningRef.current && !hiddenTimerRef.current) {
          hiddenTimerRef.current = setTimeout(() => {
            hiddenTimerRef.current = null
            if (listeningRef.current) stop()
          }, HIDDEN_STOP_MS)
        }
      } else if (hiddenTimerRef.current) {
        clearTimeout(hiddenTimerRef.current)
        hiddenTimerRef.current = null
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [stop])

  // Release everything on unmount.
  useEffect(() => {
    return () => {
      if (hiddenTimerRef.current) clearTimeout(hiddenTimerRef.current)
      teardownGraph()
      if (ctxRef.current && ctxRef.current.state !== 'closed') ctxRef.current.close().catch(() => {})
      ctxRef.current = null
    }
  }, [teardownGraph])

  return {
    status,
    errorKind,
    devices,
    deviceId,
    deviceLabel,
    start,
    stop,
    setDevice,
    resetTracker,
    store,
    getAudioContext,
  }
}

/** Subscribe a component to the engine's per-frame snapshot. */
export function useTunerFrame(store: TunerStore): TunerSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => EMPTY_SNAPSHOT)
}
