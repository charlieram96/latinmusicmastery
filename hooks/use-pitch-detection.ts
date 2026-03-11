'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

const NOTE_NAMES = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#']

interface PitchDetectionOptions {
  referencePitch?: number
}

interface PitchDetectionResult {
  frequency: number | null
  note: string | null
  octave: number | null
  cents: number | null
  isListening: boolean
  hasPermission: boolean | null
  error: string | null
  getFrequency: () => number | null
  startListening: () => Promise<void>
  stopListening: () => void
}

function autoCorrelate(buffer: Float32Array, sampleRate: number): number {
  // RMS silence gate
  let rms = 0
  for (let i = 0; i < buffer.length; i++) {
    rms += buffer[i] * buffer[i]
  }
  rms = Math.sqrt(rms / buffer.length)
  if (rms < 0.01) return -1

  // Autocorrelation
  const minLag = Math.floor(sampleRate / 1500) // ~1500 Hz
  const maxLag = Math.floor(sampleRate / 27)   // ~27 Hz
  const correlations = new Float32Array(maxLag + 1)

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0
    let sumSq1 = 0
    let sumSq2 = 0
    for (let i = 0; i < buffer.length - lag; i++) {
      sum += buffer[i] * buffer[i + lag]
      sumSq1 += buffer[i] * buffer[i]
      sumSq2 += buffer[i + lag] * buffer[i + lag]
    }
    const denom = Math.sqrt(sumSq1 * sumSq2)
    correlations[lag] = denom > 0 ? sum / denom : 0
  }

  // Find first peak above 0.9 confidence
  let bestLag = -1
  let bestCorr = 0.9

  for (let lag = minLag; lag <= maxLag; lag++) {
    if (correlations[lag] > bestCorr) {
      // Check it's a local peak
      if (
        (lag === minLag || correlations[lag] > correlations[lag - 1]) &&
        (lag === maxLag || correlations[lag] >= correlations[lag + 1])
      ) {
        bestCorr = correlations[lag]
        bestLag = lag
        break // Take first peak above threshold
      }
    }
  }

  if (bestLag === -1) return -1

  // Parabolic interpolation for sub-sample accuracy
  const prev = correlations[bestLag - 1] ?? correlations[bestLag]
  const curr = correlations[bestLag]
  const next = correlations[bestLag + 1] ?? correlations[bestLag]
  const shift = (prev - next) / (2 * (prev - 2 * curr + next))
  const truePeak = bestLag + (isFinite(shift) ? shift : 0)

  return sampleRate / truePeak
}

export function usePitchDetection(
  options: PitchDetectionOptions = {}
): PitchDetectionResult {
  const { referencePitch = 440 } = options

  const [frequency, setFrequency] = useState<number | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [octave, setOctave] = useState<number | null>(null)
  const [cents, setCents] = useState<number | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const smoothedFreqRef = useRef<number | null>(null)
  const lastUpdateRef = useRef<number>(0)
  const referencePitchRef = useRef(referencePitch)

  // Keep reference pitch ref in sync
  useEffect(() => {
    referencePitchRef.current = referencePitch
  }, [referencePitch])

  const mapFrequencyToNote = useCallback((freq: number, refPitch: number) => {
    const semitones = 12 * Math.log2(freq / refPitch)
    const roundedSemitones = Math.round(semitones)
    const centsOff = Math.round((semitones - roundedSemitones) * 100)

    // Use MIDI-based calculation for accurate note/octave mapping
    const midiNumber = 69 + 12 * Math.log2(freq / refPitch)
    const roundedMidi = Math.round(midiNumber)
    const midiNoteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    const midiNoteIndex = ((roundedMidi % 12) + 12) % 12
    const oct = Math.floor((roundedMidi - 12) / 12)

    return {
      note: midiNoteNames[midiNoteIndex],
      octave: oct,
      cents: Math.max(-50, Math.min(50, centsOff)),
    }
  }, [])

  const detect = useCallback(() => {
    if (!analyserRef.current || !audioContextRef.current) return

    const analyser = analyserRef.current
    const sampleRate = audioContextRef.current.sampleRate
    const buffer = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(buffer)

    const detectedFreq = autoCorrelate(buffer, sampleRate)

    const now = performance.now()
    // Throttle updates to ~30fps
    if (now - lastUpdateRef.current < 33) {
      rafIdRef.current = requestAnimationFrame(detect)
      return
    }
    lastUpdateRef.current = now

    if (detectedFreq > 0) {
      // Exponential smoothing
      const smoothingFactor = 0.3
      const smoothed =
        smoothedFreqRef.current !== null
          ? smoothedFreqRef.current * (1 - smoothingFactor) + detectedFreq * smoothingFactor
          : detectedFreq
      smoothedFreqRef.current = smoothed

      const { note: n, octave: o, cents: c } = mapFrequencyToNote(
        smoothed,
        referencePitchRef.current
      )

      setFrequency(Math.round(smoothed * 10) / 10)
      setNote(n)
      setOctave(o)
      setCents(c)
    } else {
      smoothedFreqRef.current = null
      setFrequency(null)
      setNote(null)
      setOctave(null)
      setCents(null)
    }

    rafIdRef.current = requestAnimationFrame(detect)
  }, [mapFrequencyToNote])

  const stopListening = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    analyserRef.current = null
    smoothedFreqRef.current = null
    setIsListening(false)
    setFrequency(null)
    setNote(null)
    setOctave(null)
    setCents(null)
  }, [])

  const startListening = useCallback(async () => {
    setError(null)

    // Check for AudioContext support (Safari compat)
    const AudioContextClass =
      typeof window !== 'undefined'
        ? window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        : null
    if (!AudioContextClass) {
      setError('Web Audio API is not supported in this browser.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      setHasPermission(true)

      // Create AudioContext inside user gesture handler (Safari compat)
      const audioContext = new AudioContextClass()
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 4096
      source.connect(analyser)
      analyserRef.current = analyser

      setIsListening(true)
      rafIdRef.current = requestAnimationFrame(detect)
    } catch (err: unknown) {
      const domErr = err as DOMException
      if (domErr.name === 'NotAllowedError') {
        setHasPermission(false)
        setError('Microphone permission was denied. Please allow access to use the tuner.')
      } else if (domErr.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.')
      } else {
        setError('Could not access the microphone. Please try again.')
      }
      stopListening()
    }
  }, [detect, stopListening])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
      }
    }
  }, [])

  const getFrequency = useCallback(() => smoothedFreqRef.current, [])

  return {
    frequency,
    note,
    octave,
    cents,
    isListening,
    hasPermission,
    error,
    getFrequency,
    startListening,
    stopListening,
  }
}
