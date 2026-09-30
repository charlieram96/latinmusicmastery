import type { CatalogCountry } from '@/lib/marketing/catalog'

const CLAVE_DOTS = [1, 0, 1, 1, 0, 1]

/**
 * One row of style names with their country codes, separated by a small
 * clave figure. Pure CSS loop (90s, paused on hover, off under reduced motion).
 * Countries are interleaved so the row doesn't read as one country at a time.
 */
export function Marquee({ countries, label }: { countries: CatalogCountry[]; label: string }) {
  const lists = countries.map(c => c.styles.map(s => ({ name: s.name, code: c.code, key: `${c.slug}/${s.slug}` })))
  const items: { name: string; code: string; key: string }[] = []
  for (let i = 0; lists.some(l => i < l.length); i++) for (const l of lists) if (l[i]) items.push(l[i])
  if (!items.length) return null

  const row = (copy: number) => items.map((it, i) => (
    <span key={`${copy}-${it.key}`} className="mq-item" aria-hidden={copy > 0 || undefined}>
      <span className={i % 2 ? 'o' : ''}>{it.name}</span><sup>{it.code}</sup>
      <span className="cdots" aria-hidden="true">{CLAVE_DOTS.map((x, j) => <i key={j} className={x ? 'x' : ''} />)}</span>
    </span>
  ))

  return (
    <div className="marquee" role="region" aria-label={label}>
      <div className="mq-row">{row(0)}{row(1)}</div>
    </div>
  )
}
