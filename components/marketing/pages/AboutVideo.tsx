'use client'

import { useRef, useState } from 'react'
import { useInViewVideo } from '@/components/marketing/site/useInViewVideo'

/** The band video beside the mission; plays only while on screen, never under reduced motion. */
export function AboutVideo() {
  const ref = useRef<HTMLVideoElement>(null)
  const [failed, setFailed] = useState(false)
  useInViewVideo(ref)
  return (
    <div className="about-media">
      {!failed && (
        <video ref={ref} src="/videos/hero-video-final.mp4" muted loop playsInline preload="metadata" aria-hidden="true" onError={() => setFailed(true)} />
      )}
    </div>
  )
}
