'use client'

import { useEffect, useRef } from 'react'
import { useTranslation } from '@/components/language-provider'
import { MaestroCard } from '@/components/marketing/site/MaestroCard'
import type { CatalogTeacher } from '@/lib/marketing/catalog'

/** Prev/next buttons for the rail; they live in the section head, the rail below it. */
export function RailButtons({ railId }: { railId: string }) {
  const { t } = useTranslation()
  const by = (dir: 1 | -1) => {
    const rail = document.getElementById(railId)
    if (!rail) return
    const card = rail.querySelector('.mc')
    const step = card ? card.getBoundingClientRect().width + 16 : 300
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches
    rail.scrollBy({ left: dir * step * 2, behavior: smooth ? 'smooth' : 'auto' })
  }
  return (
    <div className="m-ctrl">
      <button type="button" aria-label={t('marketing.site.home.maestros.prev')} aria-controls={railId} onClick={() => by(-1)}>
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <button type="button" aria-label={t('marketing.site.home.maestros.next')} aria-controls={railId} onClick={() => by(1)}>
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </div>
  )
}

/** Horizontal, snapping rail of maestro cards with mouse drag-to-scroll. A drag never counts as a click. */
export function MaestroRail({ id, teachers, label }: { id: string; teachers: CatalogTeacher[]; label: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const rail = ref.current
    if (!rail) return
    let drag: { x: number; sl: number; moved: boolean } | null = null
    let justDragged = false
    const down = (e: PointerEvent) => { if (e.pointerType === 'mouse' && e.button === 0) { drag = { x: e.clientX, sl: rail.scrollLeft, moved: false }; e.preventDefault() } }
    const move = (e: PointerEvent) => {
      if (!drag) return
      const dx = e.clientX - drag.x
      if (Math.abs(dx) > 4) { drag.moved = true; rail.classList.add('drag') }
      if (drag.moved) rail.scrollLeft = drag.sl - dx
    }
    const up = () => {
      if (!drag) return
      justDragged = drag.moved
      drag = null
      rail.classList.remove('drag')
      window.setTimeout(() => { justDragged = false }, 0)
    }
    const click = (e: MouseEvent) => { if (justDragged) { e.preventDefault(); e.stopPropagation() } }
    rail.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    rail.addEventListener('click', click, true)
    return () => {
      rail.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      rail.removeEventListener('click', click, true)
    }
  }, [])

  return (
    <div className="m-rail" id={id} ref={ref} role="region" aria-label={label} style={{ maxWidth: 'none' }}>
      {teachers.map(tc => <MaestroCard key={tc.id} teacher={tc} href={`/instructors/${tc.id}`} />)}
    </div>
  )
}
