'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import type { LessonAudioTrack } from '@/lib/audio/lesson-audio'

/** The video remains the master clock, including seeks, loops and speed changes. */
export function useDubbedAudio(videoRef: RefObject<HTMLVideoElement | null>, tracks: readonly LessonAudioTrack[], volume: number, muted: boolean) {
  const [language, setLanguage] = useState('original')
  const [error, setError] = useState(false)
  const track = tracks.find(t => t.lang === language)
  const [audio] = useState(() => typeof window === 'undefined' ? null : new Audio())
  const mutedRef = useRef(muted)
  mutedRef.current = muted

  useEffect(() => {
    const video = videoRef.current
    if (!video || !audio) return
    if (!track) { audio.pause(); video.muted = muted; return }
    let disposed = false
    let starting = false
    const fail = () => {
      if (disposed) return
      audio.pause()
      video.muted = mutedRef.current
      setLanguage('original')
      setError(true)
    }
    const align = () => {
      if (audio.readyState > 0 && Math.abs(audio.currentTime - video.currentTime) > 0.12) audio.currentTime = video.currentTime
      audio.playbackRate = video.playbackRate
    }
    const play = () => {
      align()
      if (video.paused || video.ended || starting || !audio.paused) return
      starting = true
      void audio.play().then(() => {
        starting = false
        if (disposed || video.paused || video.ended) audio.pause()
      }).catch(() => { starting = false; fail() })
    }
    const pause = () => audio.pause()
    audio.src = track.src
    audio.preload = 'auto'
    audio.volume = volume
    audio.muted = muted
    audio.preservesPitch = true
    video.muted = true
    audio.addEventListener('error', fail)
    audio.addEventListener('loadedmetadata', align)
    audio.addEventListener('canplay', play)
    for (const event of ['play', 'playing']) video.addEventListener(event, play)
    for (const event of ['pause', 'ended', 'waiting', 'seeking']) video.addEventListener(event, pause)
    for (const event of ['seeked', 'ratechange', 'timeupdate']) video.addEventListener(event, align)
    video.addEventListener('seeked', play)
    play()
    return () => {
      disposed = true
      audio.pause()
      audio.removeEventListener('error', fail)
      audio.removeEventListener('loadedmetadata', align)
      audio.removeEventListener('canplay', play)
      for (const event of ['play', 'playing']) video.removeEventListener(event, play)
      for (const event of ['pause', 'ended', 'waiting', 'seeking']) video.removeEventListener(event, pause)
      for (const event of ['seeked', 'ratechange', 'timeupdate']) video.removeEventListener(event, align)
      video.removeEventListener('seeked', play)
      video.muted = mutedRef.current
    }
    // Volume changes should not reload or restart a translated track.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio, track?.src, videoRef])

  useEffect(() => {
    if (audio) { audio.volume = volume; audio.muted = muted }
    if (videoRef.current) videoRef.current.muted = !!track || muted
  }, [audio, volume, muted, track, videoRef])

  return { language: track ? language : 'original', setLanguage: (lang: string) => { setError(false); setLanguage(lang) }, error }
}
