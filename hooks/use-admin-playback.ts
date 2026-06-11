'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useMetronome } from './use-metronome'
import { useBackingTrack } from './use-backing-track'
import type { ExerciseDefinition } from '@/lib/play-sense/types'
import { getExerciseDuration } from '@/lib/play-sense/exercise-utils'

export interface UseAdminPlaybackResult {
  isPlaying: boolean
  playheadProgress: number
  currentBeat: number
  isDownbeat: boolean
  play: (exercise: ExerciseDefinition) => void
  stop: () => void
  loop: boolean
  setLoop: (loop: boolean) => void
  metronomeMuted: boolean
  setMetronomeMuted: (muted: boolean) => void
}

export function useAdminPlayback(exercise: ExerciseDefinition | null): UseAdminPlaybackResult {
  const [isPlaying, setIsPlaying] = useState(false)
  const [playheadProgress, setPlayheadProgress] = useState(0)
  const [loop, setLoop] = useState(false)
  const [metronomeMuted, setMetronomeMuted] = useState(false)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)
  const exerciseStartRef = useRef(0)
  const durationRef = useRef(0)
  const loopRef = useRef(loop)
  loopRef.current = loop
  const playingRef = useRef(false)

  const metronome = useMetronome({
    bpm: exercise?.bpm ?? 100,
    timeSignature: exercise?.timeSignature ?? [4, 4],
    countInBeats: 4,
    silent: metronomeMuted,
  })

  const backingTrack = useBackingTrack({
    audioUrls: exercise?.audioUrl ? [exercise.audioUrl] : [],
  })

  const stopPlayback = useCallback(() => {
    playingRef.current = false
    setIsPlaying(false)
    setPlayheadProgress(0)
    metronome.stopMetronome()
    backingTrack.stopPlayback()
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
  }, [metronome, backingTrack])

  const play = useCallback((ex: ExerciseDefinition) => {
    // Stop any existing playback
    if (playingRef.current) {
      stopPlayback()
    }

    const ctx = new AudioContext()
    audioCtxRef.current = ctx
    const duration = getExerciseDuration(ex)
    durationRef.current = duration

    const exerciseStart = metronome.startMetronome(ctx)
    exerciseStartRef.current = exerciseStart

    if (backingTrack.isLoaded) {
      backingTrack.startPlayback(ctx, exerciseStart)
    }

    playingRef.current = true
    setIsPlaying(true)

    const tick = () => {
      if (!playingRef.current || !audioCtxRef.current) return

      const now = audioCtxRef.current.currentTime
      const elapsed = now - exerciseStartRef.current
      const progress = duration > 0 ? elapsed / duration : 0

      if (progress >= 1) {
        if (loopRef.current) {
          // Restart
          exerciseStartRef.current = now
          setPlayheadProgress(0)
        } else {
          stopPlayback()
          return
        }
      } else {
        setPlayheadProgress(Math.max(0, progress))
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [metronome, backingTrack, stopPlayback])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {})
    }
  }, [])

  // Sync metronome mute
  useEffect(() => {
    metronome.setSilent(metronomeMuted)
  }, [metronomeMuted, metronome])

  return {
    isPlaying,
    playheadProgress,
    currentBeat: metronome.currentBeat,
    isDownbeat: metronome.isDownbeat,
    play,
    stop: stopPlayback,
    loop,
    setLoop,
    metronomeMuted,
    setMetronomeMuted,
  }
}
