import Link from 'next/link'

export type Crumb = { label: string; href?: string }

/** Sub-page hero: breadcrumbs, a giant display title, a lede and an optional extra slot, over soft stage beams. */
export function PageHead({ crumbs, title, lede, children, crumbsLabel = 'Breadcrumb' }: { crumbs: Crumb[]; title: React.ReactNode; lede?: React.ReactNode; children?: React.ReactNode; crumbsLabel?: string }) {
  return (
    <header className="phead">
      <div className="lights" aria-hidden="true"><div className="beam b1" /><div className="beam b2" /></div>
      <div className="wrap phead-in">
        <div>
          <nav className="crumbs" aria-label={crumbsLabel}>
            {crumbs.map((c, i) => (
              <span key={i} style={{ display: 'contents' }}>
                {i > 0 && <span aria-hidden="true">/</span>}
                {c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
              </span>
            ))}
          </nav>
          <h1 className="ptitle">{title}</h1>
        </div>
        <div style={{ display: 'grid', gap: 20 }}>
          {lede && <p className="lede">{lede}</p>}
          {children}
        </div>
      </div>
    </header>
  )
}

/** "Headline *accent.*" — the serif-italic gradient second phrase used by every title. */
export function Accent({ children }: { children: React.ReactNode }) {
  return <span className="serif grad-text">{children}</span>
}
