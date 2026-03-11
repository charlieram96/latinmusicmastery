'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

type AudioMode = 'headphones' | 'speaker-safe'

interface UseBackingTrackOptions {
  audioUrl?: string
  audioMode?: AudioMode
}

interface UseBackingTrackResult {
  isLoading: boolean
  isLoaded: boolean
  error: string | null
  startPlayback: (audioContext: AudioContext, startTime: number) => void
  stopPlayback: () => void
}

export function useBackingTrack({ audioUrl, audioMode }: UseBackingTrackOptions): UseBackingTrackResult {
  const [isLoading, setIsLoading] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const audioBufferRef = useRef<AudioBuffer | null>(null)
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)

  // Fetch and decode audio when URL changes
  useEffect(() => {
    if (!audioUrl) {
      audioBufferRef.current = null
      setIsLoaded(false)
      setError(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setIsLoaded(false)
    setError(null)

    const load = async () => {
      try {
        const response = await fetch(audioUrl)
        if (!response.ok) throw new Error(`Failed to fetch audio: ${response.status}`)
        const arrayBuffer = await response.arrayBuffer()

        if (cancelled) return

        // Create a temporary AudioContext for decoding
        const tempCtx = new AudioContext()
        const decoded = await tempCtx.decodeAudioData(arrayBuffer)
        await tempCtx.close()

        if (cancelled) return

        audioBufferRef.current = decoded
        setIsLoaded(true)
      } catch (err) {
        if (!cancelled) {
          console.error('Backing track load error:', err)
          setError(err instanceof Error ? err.message : 'Failed to load audio')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [audioUrl])

  const startPlayback = useCallback((audioContext: AudioContext, startTime: number) => {
    if (!audioBufferRef.current) return

    // Stop any existing playback
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop() } catch { /* ignore */ }
      sourceNodeRef.current.disconnect()
    }

    const source = audioContext.createBufferSource()
    source.buffer = audioBufferRef.current

    // Route through gain node — reduce volume in speaker-safe mode to minimize bleed
    const gainNode = audioContext.createGain()
    gainNode.gain.value = audioMode === 'speaker-safe' ? 0.5 : 1.0
    source.connect(gainNode)
    gainNode.connect(audioContext.destination)
    gainNodeRef.current = gainNode

    // Start at the same timestamp as the metronome
    source.start(startTime)
    sourceNodeRef.current = source

    // Cleanup on end
    source.onended = () => {
      sourceNodeRef.current = null
    }
  }, [])

  const stopPlayback = useCallback(() => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop() } catch { /* ignore */ }
      sourceNodeRef.current.disconnect()
      sourceNodeRef.current = null
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect()
      gainNodeRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop() } catch { /* ignore */ }
        sourceNodeRef.current.disconnect()
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect()
      }
    }
  }, [])

  return {
    isLoading,
    isLoaded,
    error,
    startPlayback,
    stopPlayback,
  }
}
