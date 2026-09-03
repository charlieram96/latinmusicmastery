'use client'

// Shared caption state for both video players (LessonVideoPlayer and
// PlaysenseStudioPlayer). The players render <track kind="subtitles"> children
// themselves; this hook drives which TextTrack is showing.
//
// Modes are set imperatively (never via the <track default> attribute) so the
// browser's own auto-selection can't fight the UI. Tracks attach to
// video.textTracks asynchronously, so the effect re-applies on `addtrack`.

import { useCallback, useEffect, useState, type RefObject } from 'react'
import type { SubtitleLang, SubtitleTrackDef } from '@/lib/subtitles/srt-to-vtt'

const STORAGE_KEY = 'lesson-subtitle-pref'

export type ActiveSubtitleLang = SubtitleLang | 'off'

function readStoredPref(): ActiveSubtitleLang | null {
  if (typeof window === 'undefined') return null
  // Any non-empty code is a candidate; the caller checks it against the tracks
  // actually present, so a language this lesson lacks simply falls through.
  const v = window.localStorage.getItem(STORAGE_KEY)
  return v ? v : null
}

export function useSubtitleTracks(
  videoRef: RefObject<HTMLVideoElement | null>,
  tracks: SubtitleTrackDef[],
  defaultLang?: SubtitleLang
): { activeLang: ActiveSubtitleLang; setActiveLang: (lang: ActiveSubtitleLang) => void } {
  // Callers typically build the tracks array inline, so key effects on its
  // content, not its identity.
  const tracksKey = tracks.map((t) => `${t.lang}:${t.src}`).join('|')

  const [activeLang, setActiveLangState] = useState<ActiveSubtitleLang>(() =>
    defaultLang && tracks.some((t) => t.lang === defaultLang) ? defaultLang : 'off'
  )

  // Apply the persisted preference after mount (not in the initializer — SSR
  // has no localStorage and a divergent initial state would break hydration).
  useEffect(() => {
    const stored = readStoredPref()
    if (stored === null) return
    if (stored === 'off' || tracks.some((t) => t.lang === stored)) {
      setActiveLangState(stored)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setActiveLang = useCallback((lang: ActiveSubtitleLang) => {
    setActiveLangState(lang)
    try {
      window.localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      /* private mode */
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || tracks.length === 0) return

    const apply = () => {
      for (let i = 0; i < video.textTracks.length; i++) {
        const track = video.textTracks[i]
        if (track.kind !== 'subtitles') continue
        track.mode = track.language === activeLang ? 'showing' : 'disabled'
      }
    }
    apply()

    // Tracks attach asynchronously (and React remounts reset modes).
    video.textTracks.addEventListener('addtrack', apply)

    // Nudge cues up so they clear the overlay control bar. Cues may not be
    // parsed yet when the track first shows, so listen for each <track>'s load.
    const trackEls = Array.from(video.querySelectorAll('track'))
    const liftCues = (e: Event) => {
      const t = (e.target as HTMLTrackElement).track
      if (!t?.cues) return
      for (let i = 0; i < t.cues.length; i++) {
        const cue = t.cues[i] as VTTCue
        if (cue.line === 'auto') cue.line = -3
      }
    }
    trackEls.forEach((el) => {
      el.addEventListener('load', liftCues)
      if (el.track?.cues?.length) liftCues({ target: el } as unknown as Event)
    })

    return () => {
      video.textTracks.removeEventListener('addtrack', apply)
      trackEls.forEach((el) => el.removeEventListener('load', liftCues))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef, tracksKey, activeLang])

  return { activeLang, setActiveLang }
}
