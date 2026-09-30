'use client'

import { useMemo, useState } from 'react'
import { useTranslation } from '@/components/language-provider'
import { PageHead, Accent, type Crumb } from '@/components/marketing/site/PageHead'
import type { CatalogCourse } from '@/lib/marketing/catalog'
import { filterCourses, type ExploreFilter } from '@/lib/marketing/explore-filter'
import { instrumentLabel } from '@/lib/i18n/instruments'
import { Poster } from './Poster'

export type ExploreInstrument = { key: string; count: number }
export type ExploreCountry = { slug: string; name: string; live: boolean }

/**
 * The explore hero, its search field, the sticky instrument/country chips and
 * the poster grid, all filtering the catalog in the browser. The instrument
 * chip is mirrored to `?instrument=` so the view can be shared.
 */
export function ExploreBrowser({ courses, englishStyles, instruments, countries, initialInstrument, crumbs }: {
  courses: CatalogCourse[]
  /** slug → English style name, for sleeve seeds. */
  englishStyles: Record<string, string>
  instruments: ExploreInstrument[]
  countries: ExploreCountry[]
  initialInstrument: string
  crumbs: Crumb[]
}) {
  const { t, locale } = useTranslation()
  const k = (key: string, p?: Record<string, string | number>) => t(`marketing.site.explore.${key}`, p)
  const [f, setF] = useState<ExploreFilter>({ instrument: initialInstrument, country: 'all', q: '' })
  const label = (key: string) => instrumentLabel(key, locale)
  const list = useMemo(() => filterCourses(courses, f, key => instrumentLabel(key, locale)), [courses, f, locale])

  const pickInstrument = (key: string) => {
    setF(prev => ({ ...prev, instrument: key }))
    try {
      const url = new URL(window.location.href)
      if (key === 'all') url.searchParams.delete('instrument')
      else url.searchParams.set('instrument', key)
      window.history.replaceState(window.history.state, '', url)
    } catch { /* URL sync is a convenience */ }
  }

  return (
    <>
      <PageHead crumbsLabel={t('marketing.common.breadcrumb')}
        crumbs={crumbs}
        title={<>{k('title')} <Accent>{k('titleAccent')}</Accent></>}
        lede={k('lede', { courses: courses.length, instruments: instruments.length })}
      >
        <div className="field ex-search">
          <label htmlFor="exq" className="sr-only">{k('searchLabel')}</label>
          <input id="exq" type="search" placeholder={k('searchPlaceholder')} value={f.q} onChange={e => setF(prev => ({ ...prev, q: e.target.value }))} />
        </div>
      </PageHead>

      <div className="toolbar">
        <div className="wrap" style={{ display: 'grid', gap: 12, width: '100%' }}>
          <div className="filters" role="group" aria-label={k('instrumentsLabel')}>
            <button type="button" className="fchip" aria-pressed={f.instrument === 'all'} onClick={() => pickInstrument('all')}>
              {k('allInstruments')} <small>{courses.length}</small>
            </button>
            {instruments.map(i => (
              <button key={i.key} type="button" className="fchip" aria-pressed={f.instrument === i.key} onClick={() => pickInstrument(i.key)}>
                {label(i.key)} <small>{i.count}</small>
              </button>
            ))}
          </div>
          <div className="filters" role="group" aria-label={k('countriesLabel')}>
            <button type="button" className="fchip" aria-pressed={f.country === 'all'} onClick={() => setF(prev => ({ ...prev, country: 'all' }))}>{k('allCountries')}</button>
            {countries.map(c => (
              <button key={c.slug} type="button" className="fchip" aria-pressed={f.country === c.slug} disabled={!c.live}
                onClick={() => setF(prev => ({ ...prev, country: c.slug }))}>
                {c.name}{!c.live && <small>{k('soon')}</small>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="wrap">
        <p className="eyebrow" style={{ paddingTop: 26 }} aria-live="polite">
          <b>{list.length}</b> {t(list.length === 1 ? 'marketing.site.common.coursesOne' : 'marketing.site.common.courses')}
        </p>
        {list.length
          ? <div className="posters">{list.map((c, i) => <Poster key={c.id} course={c} t={t} locale={locale} englishStyle={c.styleSlug ? englishStyles[c.styleSlug] ?? null : null} index={i} />)}</div>
          : <p className="empty">{k('empty')}</p>}
      </div>
    </>
  )
}
