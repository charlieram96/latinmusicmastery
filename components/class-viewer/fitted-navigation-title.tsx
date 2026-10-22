'use client'

import { useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

/** Keep navigation rows uniform; fit the full authored title into their text box. */
export function FittedNavigationTitle({ text, className }: { text: string; className?: string }) {
  const box = useRef<HTMLSpanElement>(null)
  const label = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const container = box.current
    const content = label.current
    if (!container || !content) return
    let disposed = false
    const fit = () => {
      if (disposed || !container.clientWidth) return
      for (let size = 13; size >= 8; size -= 0.25) {
        content.style.setProperty('--navigation-font', `${size}px`)
        if (content.getBoundingClientRect().height <= container.clientHeight && content.scrollWidth <= container.clientWidth) break
      }
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(container)
    document.fonts.ready.then(fit)
    return () => { disposed = true; observer.disconnect() }
  }, [text])
  return <span ref={box} title={text} className={cn('lmm-fitted-title', className)}>
    <span ref={label} className="lmm-fitted-title-text">{text}</span>
  </span>
}
