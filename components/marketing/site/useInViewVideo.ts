'use client'

import { useEffect, type RefObject } from 'react'

/** Play a muted looping video only while it is on screen; never autoplay under reduced motion. */
export function useInViewVideo(ref: RefObject<HTMLVideoElement | null>, threshold = 0.15) {
  useEffect(() => {
    const v = ref.current
    if (!v || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) v.play().catch(() => {}); else v.pause() }), { threshold })
    io.observe(v)
    return () => io.disconnect()
  }, [ref, threshold])
}
