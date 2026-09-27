'use client'

import Image from 'next/image'
import { useEffect, useRef } from 'react'
import { useTranslation } from '@/components/language-provider'
import { playPianoNote } from '@/lib/marketing/groove/audio'

const SRC = '/videos/hero-video-final.mp4'
/** Top to bottom: C, C♯, D, D♯, E. White keys carry a slice of the band video. */
const KEYS = [
  { midi: 60, cls: 'key k1', label: 'c4', white: true },
  { midi: 61, cls: 'bkey b1', label: 'cs4', white: false },
  { midi: 62, cls: 'key k2', label: 'd4', white: true },
  { midi: 63, cls: 'bkey b2', label: 'ds4', white: false },
  { midi: 64, cls: 'key k3', label: 'e4', white: true },
] as const

export type HeroChip = { name: string; imageUrl: string }

/**
 * The band video seen through three white piano keys (with the two black keys
 * between them). Each key shows its slice of one composite frame; the three
 * videos stay in sync with the first. Clicking a key plays its note.
 */
export function HeroKeys({ chip }: { chip: HeroChip | null }) {
  const { t } = useTranslation()
  const visRef = useRef<HTMLDivElement>(null)
  const keysRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const keys = keysRef.current, vis = visRef.current
    if (!keys || !vis) return
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const vids = [...keys.querySelectorAll('video')]
    const whites = [...keys.querySelectorAll<HTMLElement>('.key')]

    const lay = () => {
      const W = keys.offsetWidth, H = keys.offsetHeight
      for (const k of whites) {
        k.style.setProperty('--vx', `${-k.offsetLeft}px`); k.style.setProperty('--vy', `${-k.offsetTop}px`)
        k.style.setProperty('--vw', `${W}px`); k.style.setProperty('--vh', `${H}px`)
      }
    }
    const ro = new ResizeObserver(lay)
    ro.observe(keys); lay()

    const lead = vids[0]
    const sync = () => { for (const v of vids.slice(1)) if (Math.abs(v.currentTime - lead.currentTime) > 0.08) v.currentTime = lead.currentTime }
    lead.addEventListener('timeupdate', sync)
    const hide = (e: Event) => { (e.currentTarget as HTMLVideoElement).style.display = 'none' }
    vids.forEach(v => v.addEventListener('error', hide))

    let io: IntersectionObserver | null = null
    if (!reduce) {
      io = new IntersectionObserver(es => es.forEach(en => vids.forEach(v => { if (en.isIntersecting) v.play().catch(() => {}); else v.pause() })))
      io.observe(keys)
    }

    const move = (e: PointerEvent) => {
      if (reduce || innerWidth < 1100) return
      const r = vis.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5
      keys.style.setProperty('--ry', `${(-8 + x * 10).toFixed(2)}deg`); keys.style.setProperty('--rx', `${(4 - y * 8).toFixed(2)}deg`)
    }
    const leave = () => { keys.style.removeProperty('--ry'); keys.style.removeProperty('--rx') }
    vis.addEventListener('pointermove', move)
    vis.addEventListener('pointerleave', leave)

    return () => {
      ro.disconnect(); io?.disconnect()
      lead.removeEventListener('timeupdate', sync)
      vids.forEach(v => v.removeEventListener('error', hide))
      vis.removeEventListener('pointermove', move); vis.removeEventListener('pointerleave', leave)
    }
  }, [])

  const press = (e: React.MouseEvent<HTMLButtonElement>, midi: number) => {
    const k = e.currentTarget
    k.classList.remove('hit'); void k.offsetWidth; k.classList.add('hit')
    window.setTimeout(() => k.classList.remove('hit'), 450)
    playPianoNote(midi)
  }

  return (
    <div className="hero-visual" ref={visRef}>
      <div className="keys" ref={keysRef} role="group" aria-label={t('marketing.site.home.hero.keysLabel')}>
        <div className="keys-shadow" aria-hidden="true" />
        {KEYS.map(k => (
          <button key={k.midi} type="button" className={k.cls} aria-label={t(`marketing.site.home.hero.key.${k.label}`)} onClick={e => press(e, k.midi)}>
            {k.white && <span className="kv"><video src={SRC} muted loop playsInline preload="auto" aria-hidden="true" /></span>}
          </button>
        ))}
      </div>
      {chip && (
        <div className="glass g1">
          <Image src={chip.imageUrl} alt="" width={34} height={34} />
          <div><b>{chip.name}</b><small>{t('marketing.site.home.hero.chipCaption')}</small></div>
        </div>
      )}
    </div>
  )
}
