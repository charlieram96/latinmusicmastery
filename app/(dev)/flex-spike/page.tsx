'use client'
// THROWAWAY spike for spec §7. It plays a local video through a synthetic flex
// map by changing playbackRate per 2-second segment, trims drift with a small
// rate correction instead of seeking, and reports the worst drift. Delete it
// once the spec records the result.
import { useEffect, useRef, useState } from 'react'

const RATES = [1, 1.04, 0.96, 1.02, 0.97]
const SEG = 2 // seconds of timeline per segment

function expectedMediaTime(elapsed: number, start: number): number {
  let media = start
  for (let i = 0, t = 0; t < elapsed; i++, t += SEG) media += Math.min(SEG, elapsed - t) * RATES[i % RATES.length]
  return media
}

export default function FlexSpike() {
  const video = useRef<HTMLVideoElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [worst, setWorst] = useState(0)
  const [seeks, setSeeks] = useState(0)

  useEffect(() => {
    const v = video.current
    if (!v || !src) return
    ;(v as HTMLVideoElement & { preservesPitch: boolean }).preservesPitch = true
    let raf = 0, t0 = 0, media0 = 0
    const onPlay = () => { t0 = performance.now(); media0 = v.currentTime; setWorst(0) }
    const onSeeking = () => setSeeks(n => n + 1)
    const tick = () => {
      if (!v.paused && t0) {
        const elapsed = (performance.now() - t0) / 1000
        const want = expectedMediaTime(elapsed, media0)
        const drift = v.currentTime - want
        const segRate = RATES[Math.floor(elapsed / SEG) % RATES.length]
        const trim = Math.max(-0.03, Math.min(0.03, -drift * 0.5))
        const rate = segRate * (1 + trim)
        if (Math.abs(v.playbackRate - rate) > 0.001) v.playbackRate = rate
        setWorst(w => Math.max(w, Math.abs(drift)))
      }
      raf = requestAnimationFrame(tick)
    }
    v.addEventListener('play', onPlay)
    v.addEventListener('seeking', onSeeking)
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); v.removeEventListener('play', onPlay); v.removeEventListener('seeking', onSeeking) }
  }, [src])

  return (
    <main style={{ padding: 16, display: 'grid', gap: 12, maxWidth: 720 }}>
      <h1>Flex video spike</h1>
      <input type="file" accept="video/*" onChange={e => { const f = e.target.files?.[0]; if (f) setSrc(URL.createObjectURL(f)) }} />
      {src && <video ref={video} src={src} controls playsInline style={{ width: '100%' }} />}
      <p>Worst drift: <b>{Math.round(worst * 1000)} ms</b> · seeks during play: <b>{seeks}</b></p>
      <p style={{ fontSize: 12, opacity: 0.7 }}>{typeof navigator !== 'undefined' ? navigator.userAgent : ''}</p>
      <p style={{ fontSize: 12 }}>Pass: worst drift under 60 ms, no seeks after pressing play, no audible clicks or pitch change when the rate switches every 2 s.</p>
    </main>
  )
}
