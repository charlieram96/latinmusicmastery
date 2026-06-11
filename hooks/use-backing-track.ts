'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

type AudioMode = 'headphones' | 'speaker-safe'

interface UseBackingTrackOptions {
  /** Tracks to play together. All are assumed equal-length and pre-synced —
   *  every source starts at the same AudioContext timestamp. */
  audioUrls?: string[]
  audioMode?: AudioMode
}

interface UseBackingTrackResult {
  isLoading: boolean
  isLoaded: boolean
  error: string | null
  startPlayback: (audioContext: AudioContext, startTime: number) => void
  stopPlayback: () => void
}

export function useBackingTrack({ audioUrls, audioMode }: UseBackingTrackOptions): UseBackingTrackResult {
  const [isLoading, setIsLoading] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const audioBuffersRef = useRef<AudioBuffer[]>([])
  const sourceNodesRef = useRef<AudioBufferSourceNode[]>([])
  const gainNodeRef = useRef<GainNode | null>(null)

  // Join-key so the effect re-runs only when the actual list changes, not on
  // every parent render producing a fresh array identity.
  const urlsKey = (audioUrls ?? []).join('\n')

  // Fetch and decode audio when the URL list changes
  useEffect(() => {
    const urls = urlsKey ? urlsKey.split('\n') : []
    if (urls.length === 0) {
      audioBuffersRef.current = []
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
        // One temporary AudioContext decodes all tracks, then closes.
        const tempCtx = new AudioContext()
        try {
          const decoded = await Promise.all(
            urls.map(async (url) => {
              const response = await fetch(url)
              if (!response.ok) throw new Error(`Failed to fetch audio: ${response.status}`)
              const arrayBuffer = await response.arrayBuffer()
              return tempCtx.decodeAudioData(arrayBuffer)
            })
          )
          if (cancelled) return
          audioBuffersRef.current = decoded
          setIsLoaded(true)
        } finally {
          await tempCtx.close()
        }
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
  }, [urlsKey])

  const stopAllSources = () => {
    for (const source of sourceNodesRef.current) {
      try { source.stop() } catch { /* ignore */ }
      source.disconnect()
    }
    sourceNodesRef.current = []
  }

  const startPlayback = useCallback((audioContext: AudioContext, startTime: number) => {
    if (audioBuffersRef.current.length === 0) return

    stopAllSources()

    // All tracks route through one gain node — reduce volume in speaker-safe
    // mode to minimize bleed into the mic.
    const gainNode = audioContext.createGain()
    gainNode.gain.value = audioMode === 'speaker-safe' ? 0.5 : 1.0
    gainNode.connect(audioContext.destination)
    gainNodeRef.current = gainNode

    sourceNodesRef.current = audioBuffersRef.current.map((buffer) => {
      const source = audioContext.createBufferSource()
      source.buffer = buffer
      source.connect(gainNode)
      // Start at the same timestamp as the metronome — sample-accurate sync.
      source.start(startTime)
      source.onended = () => {
        sourceNodesRef.current = sourceNodesRef.current.filter((s) => s !== source)
      }
      return source
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioMode])

  const stopPlayback = useCallback(() => {
    stopAllSources()
    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect()
      gainNodeRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const source of sourceNodesRef.current) {
        try { source.stop() } catch { /* ignore */ }
        source.disconnect()
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
