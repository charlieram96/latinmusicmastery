'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

type AudioMode = 'headphones' | 'speaker-safe'

/**
 * A backing track placed on the exercise's own clock.
 *
 * Until migration 040 every track was assumed equal-length and pre-synced, and
 * all of them started at the identical timestamp. They are now clips: each has
 * a start relative to the engine's t0 and may be trimmed at both ends.
 */
export interface PlacedBackingTrack {
  id: string
  audioUrl: string
  /**
   * Seconds from the engine's t0 (measure 1, beat 1, after the count-in).
   * MAY BE NEGATIVE: a track can begin before beat one, in which case playback
   * starts part-way into its buffer.
   */
  startSeconds: number
  trimInSeconds: number
  /** null = play to the end of the file. */
  trimOutSeconds: number | null
}

interface UseBackingTrackOptions {
  /** Placed tracks. Preferred over audioUrls. */
  tracks?: PlacedBackingTrack[]
  /** @deprecated Legacy URL list; treated as unplaced, untrimmed tracks at t0. */
  audioUrls?: string[]
  audioMode?: AudioMode
  /** Length of one loop iteration, so clips repeat with a looping exercise. */
  loopDurationSeconds?: number
  loopCount?: number
}

interface UseBackingTrackResult {
  isLoading: boolean
  isLoaded: boolean
  error: string | null
  startPlayback: (audioContext: AudioContext, startTime: number) => void
  stopPlayback: () => void
}

const unplaced = (audioUrl: string, index: number): PlacedBackingTrack => ({
  id: `url-${index}`,
  audioUrl,
  startSeconds: 0,
  trimInSeconds: 0,
  trimOutSeconds: null,
})

export function useBackingTrack({
  tracks,
  audioUrls,
  audioMode,
  loopDurationSeconds,
  loopCount = 1,
}: UseBackingTrackOptions): UseBackingTrackResult {
  const [isLoading, setIsLoading] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const audioBuffersRef = useRef<Map<string, AudioBuffer>>(new Map())
  const sourceNodesRef = useRef<AudioBufferSourceNode[]>([])
  const gainNodeRef = useRef<GainNode | null>(null)

  const placed: PlacedBackingTrack[] = tracks ?? (audioUrls ?? []).map(unplaced)

  // Placement is read at START time, not decode time, so re-positioning a clip
  // never triggers a re-decode. Only the URL list drives the effect.
  const placedRef = useRef(placed)
  placedRef.current = placed
  const loopRef = useRef({ loopDurationSeconds, loopCount })
  loopRef.current = { loopDurationSeconds, loopCount }

  // Join-key so the effect re-runs only when the actual list changes, not on
  // every parent render producing a fresh array identity.
  const urlsKey = placed.map((t) => t.audioUrl).join('\n')

  // Fetch and decode audio when the URL list changes
  useEffect(() => {
    const urls = urlsKey ? urlsKey.split('\n') : []
    if (urls.length === 0) {
      audioBuffersRef.current = new Map()
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
        // Decode in an OFFLINE context: a live AudioContext created outside a
        // user gesture is counted (and can be refused) by Safari, and we only
        // need the buffers, which outlive the context that produced them.
        const OfflineCtx: typeof OfflineAudioContext =
          window.OfflineAudioContext ??
          (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
            .webkitOfflineAudioContext
        const tempCtx = new OfflineCtx(1, 1, 48000)

        const unique = Array.from(new Set(urls))
        const decoded = await Promise.all(
          unique.map(async (url) => {
            const response = await fetch(url)
            if (!response.ok) throw new Error(`Failed to fetch audio: ${response.status}`)
            const arrayBuffer = await response.arrayBuffer()
            return [url, await tempCtx.decodeAudioData(arrayBuffer)] as const
          })
        )
        if (cancelled) return
        audioBuffersRef.current = new Map(decoded)
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
  }, [urlsKey])

  const stopAllSources = () => {
    for (const source of sourceNodesRef.current) {
      try { source.stop() } catch { /* ignore */ }
      source.disconnect()
    }
    sourceNodesRef.current = []
  }

  const startPlayback = useCallback((audioContext: AudioContext, startTime: number) => {
    if (audioBuffersRef.current.size === 0) return

    stopAllSources()

    // All tracks route through one gain node — reduce volume in speaker-safe
    // mode to minimize bleed into the mic. There is deliberately no per-track
    // gain: placement is authored in the studio, loudness is not.
    const gainNode = audioContext.createGain()
    gainNode.gain.value = audioMode === 'speaker-safe' ? 0.5 : 1.0
    gainNode.connect(audioContext.destination)
    gainNodeRef.current = gainNode

    const { loopDurationSeconds: loopLength, loopCount: loops } = loopRef.current
    const iterations = loopLength && loops && loops > 1 ? loops : 1

    const sources: AudioBufferSourceNode[] = []
    for (const track of placedRef.current) {
      const buffer = audioBuffersRef.current.get(track.audioUrl)
      if (!buffer) continue

      const out = Math.min(track.trimOutSeconds ?? buffer.duration, buffer.duration)
      if (!(out > track.trimInSeconds)) continue

      for (let loop = 0; loop < iterations; loop++) {
        const loopOffset = loop * (loopLength ?? 0)
        let when = startTime + loopOffset + track.startSeconds
        let offset = track.trimInSeconds

        // A clip placed before t0 (or scheduled in the past because we started
        // late) begins part-way in rather than being dropped.
        if (when < audioContext.currentTime) {
          offset += audioContext.currentTime - when
          when = audioContext.currentTime
        }
        if (offset >= out) continue

        const source = audioContext.createBufferSource()
        source.buffer = buffer
        source.connect(gainNode)
        // Rate is always 1 in the student engine, so the duration argument is
        // unambiguous here (unlike the studio mixer, which varies rate).
        source.start(when, offset, out - offset)
        source.onended = () => {
          sourceNodesRef.current = sourceNodesRef.current.filter((s) => s !== source)
        }
        sources.push(source)
      }
    }
    sourceNodesRef.current = sources
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
