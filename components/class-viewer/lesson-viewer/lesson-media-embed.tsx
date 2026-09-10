'use client'

import { useEffect, useRef } from 'react'
import { useLessonActivity } from './lesson-progress-context'

const SOUNDSLICE_ORIGIN = 'https://www.soundslice.com'

export function LessonMediaEmbed({ src, className }: { src: string; className?: string }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const finish = useLessonActivity('media')
  let embedSrc = src
  try {
    const url = new URL(src)
    if (url.origin === SOUNDSLICE_ORIGIN) {
      url.searchParams.set('api', '1')
      embedSrc = url.toString()
    }
  } catch { /* Keep the authored URL if it isn't an absolute Soundslice embed. */ }

  useEffect(() => {
    // Only the expected player window can report the documented audio-end event.
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== SOUNDSLICE_ORIGIN || event.source !== frame.current?.contentWindow) return
      try {
        const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (message?.method === 'ssAudioEnd') finish()
      } catch { /* Unrelated messages are not completion events. */ }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [finish])

  return <iframe ref={frame} src={embedSrc} title="Lesson player" className={className} allow="autoplay; fullscreen" allowFullScreen />
}
