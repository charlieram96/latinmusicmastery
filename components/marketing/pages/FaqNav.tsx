'use client'

/** Sticky category links; plain anchors that scroll smoothly unless reduced motion is on. */
export function FaqNav({ label, items }: { label: string; items: { id: string; title: string }[] }) {
  const jump = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    e.preventDefault()
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    history.replaceState(null, '', `#${id}`)
  }
  return (
    <nav className="faq-nav" aria-label={label}>
      {items.map(c => <a key={c.id} href={`#${c.id}`} onClick={e => jump(e, c.id)}>{c.title}</a>)}
    </nav>
  )
}
