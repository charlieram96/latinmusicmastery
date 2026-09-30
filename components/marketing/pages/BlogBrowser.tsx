'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useTranslation } from '@/components/language-provider'
import { PostCover } from './PostCover'
import type { PostCard } from '@/lib/marketing/pages/blog'

const B = 'marketing.site.blog'

/** Category chips + the feature card (newest post, "All" only) + the grid. */
export function BlogBrowser({ posts, categories }: { posts: PostCard[]; categories: { key: string; label: string }[] }) {
  const { t } = useTranslation()
  const [cat, setCat] = useState<string | null>(null)
  const [feature, ...rest] = posts
  const grid = cat === null ? rest : posts.filter(p => p.category === cat)
  const short = (p: PostCard) => t(`${B}.minShort`, { n: p.minutes })

  return (
    <>
      <div className="toolbar">
        <div className="wrap filters" role="group" aria-label={t(`${B}.filterLabel`)} style={{ width: '100%' }}>
          <button type="button" className="fchip" aria-pressed={cat === null} onClick={() => setCat(null)}>{t(`${B}.all`)}</button>
          {categories.map(c => (
            <button key={c.key} type="button" className="fchip" aria-pressed={cat === c.key} onClick={() => setCat(c.key)}>{c.label}</button>
          ))}
        </div>
      </div>
      <div className="wrap">
        {cat === null && feature && (
          <article className="blog-feature">
            <Link href={`/blog/${feature.slug}`} tabIndex={-1} aria-hidden="true" className="blog-cover-link">
              <PostCover post={feature} sizes="(max-width: 900px) 100vw, 55vw" priority minLabel={short(feature)} className="pcover-feature" />
            </Link>
            <div>
              <span className="pcat">{[feature.categoryLabel, t(`${B}.minRead`, { n: feature.minutes })].filter(Boolean).join(' · ')}</span>
              <h2>{feature.title}</h2>
              {feature.excerpt && <p>{feature.excerpt}</p>}
              <Link className="btn btn-ghost" href={`/blog/${feature.slug}`} style={{ marginTop: 22 }}>{t(`${B}.read`)}</Link>
            </div>
          </article>
        )}
        {grid.length > 0 ? (
          <div className="bgrid" aria-live="polite">
            {grid.map((p, i) => (
              <Link key={`${cat}-${p.id}`} href={`/blog/${p.slug}`} className="post" style={{ animation: `chipIn .6s ${i * 60}ms var(--ease-out) both` }}>
                <PostCover post={p} sizes="(max-width: 640px) 100vw, (max-width: 900px) 50vw, 33vw" minLabel={short(p)} />
                <span className="pcat">{[p.categoryLabel, p.date].filter(Boolean).join(' · ')}</span>
                <h3>{p.title}</h3>
                {p.excerpt && <p>{p.excerpt}</p>}
              </Link>
            ))}
          </div>
        ) : (
          cat !== null && <p className="empty" aria-live="polite">{t(`${B}.noneInCategory`)}</p>
        )}
      </div>
    </>
  )
}
