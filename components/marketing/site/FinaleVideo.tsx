'use client'

import { useRef, useState } from 'react'
import { useInViewVideo } from './useInViewVideo'

export function FinaleVideo() {
  const ref = useRef<HTMLVideoElement>(null)
  const [failed, setFailed] = useState(false)
  useInViewVideo(ref)
  if (failed) return null
  return <video ref={ref} src="/videos/hero-video-final.mp4" muted loop playsInline preload="metadata" aria-hidden="true" onError={() => setFailed(true)} />
}
