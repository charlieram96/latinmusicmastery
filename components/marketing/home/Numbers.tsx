'use client'

import { useEffect, useRef } from 'react'
import { useTranslation } from '@/components/language-provider'
import type { Catalog } from '@/lib/marketing/catalog'

const CELLS = ['courses', 'maestros', 'instruments', 'styles', 'countries'] as const

/** Five live counts from the catalog; they count up once on first view (not under reduced motion). */
export function Numbers({ counts }: { counts: Catalog['counts'] }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const nums = [...el.querySelectorAll<HTMLElement>('[data-count]')]
    const rafs: number[] = []
    const io = new IntersectionObserver(es => {
      if (!es.some(en => en.isIntersecting)) return
      io.disconnect()
      nums.forEach((b, i) => {
        const to = Number(b.dataset.count), t0 = performance.now() + i * 90
        const step = (now: number) => {
          const k = Math.max(0, Math.min(1, (now - t0) / 1300)), e = 1 - Math.pow(1 - k, 3)
          b.textContent = String(Math.round(to * e))
          if (k < 1) rafs[i] = requestAnimationFrame(step)
        }
        rafs[i] = requestAnimationFrame(step)
      })
    }, { threshold: 0.4 })
    io.observe(el)
    return () => { io.disconnect(); rafs.forEach(cancelAnimationFrame) }
  }, [])

  return (
    <div className="wrap">
      <div className="numbers" ref={ref}>
        {CELLS.map(c => (
          <div key={c} className="num">
            <b className="tnum" data-count={counts[c]}>{counts[c]}</b>
            <span>{t(`marketing.site.home.numbers.${c}`)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
