import Link from 'next/link'
import type { CatalogCountry } from '@/lib/marketing/catalog'

/** Four country columns: huge outlined code, geo line, and each style marked live or coming soon. */
export function StyleAtlas({ countries, labels }: { countries: CatalogCountry[]; labels: { live: string; soon: string; stylesLive: (live: number, total: number) => string } }) {
  return (
    <div className="atlas">
      {countries.map(c => {
        const live = c.styles.filter(s => s.live).length
        return (
          <article key={c.slug} className="ctry" style={{ ['--cc' as string]: c.color }}>
            <div className="ctry-code" aria-hidden="true">{c.code}</div>
            <h3 className="ctry-name"><Link href={`/explore/${c.slug}`} style={{ textDecoration: 'none' }}>{c.name}</Link></h3>
            <p className="ctry-geo">{c.geo}</p>
            <ul className="styles">
              {c.styles.map(s => (
                <li key={s.slug} className={s.live ? 'live' : 'soon'}>
                  {s.live ? <Link href={`/explore/${c.slug}/${s.slug}`} style={{ textDecoration: 'none' }}>{s.name}</Link> : s.name}
                  <span>{s.live ? `● ${labels.live}` : labels.soon}</span>
                </li>
              ))}
            </ul>
            <p className="ctry-geo" style={{ marginTop: 14 }}>{labels.stylesLive(live, c.styles.length)}</p>
          </article>
        )
      })}
    </div>
  )
}
