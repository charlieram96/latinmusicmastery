'use client'

import { useEffect, useRef } from 'react'

/**
 * Adds `.in` on first view. The resting state (see `.mkt.js-on .rv:not(.in)`)
 * is only applied once JS is running, so server HTML is always fully visible.
 */
export function Reveal({ as: Tag = 'div', className = '', children, ...rest }: { as?: 'div' | 'section' | 'ul' | 'article'; className?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLElement>) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.closest('.mkt')?.classList.add('js-on')
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { el.classList.add('in'); io.disconnect() } }), { rootMargin: '0px 0px -8% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const Comp = Tag as React.ElementType
  return <Comp ref={ref} className={`rv ${className}`} {...rest}>{children}</Comp>
}
