'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { CatalogTeacher } from '@/lib/marketing/catalog'

const reduce = () => typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Portrait card: grayscale photo that warms to colour on hover, a light that
 * follows the pointer, a slight tilt, and specialty tags revealed on hover/focus.
 */
export function MaestroCard({ teacher, href, sizes = '300px' }: { teacher: CatalogTeacher; href?: string; sizes?: string }) {
  const move = (e: React.PointerEvent<HTMLElement>) => {
    const c = e.currentTarget, r = c.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height
    c.style.setProperty('--mx', `${x * 100}%`); c.style.setProperty('--my', `${y * 100}%`)
    if (!reduce()) { c.style.setProperty('--ry', `${((x - .5) * 6).toFixed(2)}deg`); c.style.setProperty('--rx', `${((.5 - y) * 4).toFixed(2)}deg`) }
  }
  const leave = (e: React.PointerEvent<HTMLElement>) => { e.currentTarget.style.setProperty('--ry', '0deg'); e.currentTarget.style.setProperty('--rx', '0deg') }
  const body = (
    <>
      {teacher.imageUrl && <Image src={teacher.imageUrl} alt="" fill sizes={sizes} draggable={false} />}
      <div className="mc-body">
        <p className="mc-inst">{teacher.instrument}</p>
        <h3 className="mc-name">{teacher.name}</h3>
        {teacher.specialties.length > 0 && <div className="mc-tags">{teacher.specialties.map(s => <span key={s}>{s}</span>)}</div>}
      </div>
    </>
  )
  return href
    ? <Link href={href} className="mc" onPointerMove={move} onPointerLeave={leave} draggable={false}>{body}</Link>
    : <article className="mc" tabIndex={0} onPointerMove={move} onPointerLeave={leave}>{body}</article>
}
