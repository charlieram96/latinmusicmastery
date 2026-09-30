import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerTranslator } from '@/lib/i18n/server'
import { getMarketingCatalog } from '@/lib/marketing/data'
import { COUNTRY_META } from '@/lib/marketing/catalog'
import { initialInstrument } from '@/lib/marketing/explore-filter'
import { getEnglishStyleNames } from '@/lib/marketing/style-names'
import { Accent } from '@/components/marketing/site/PageHead'
import { StyleAtlas } from '@/components/marketing/site/StyleAtlas'
import { Reveal } from '@/components/marketing/site/Reveal'
import { Finale } from '@/components/marketing/site/Finale'
import { ExploreBrowser } from '@/components/marketing/explore/ExploreBrowser'
import '../styles/explore.css'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator()
  return {
    title: t('marketing.site.explore.meta.title'),
    description: t('marketing.site.explore.meta.description'),
  }
}

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ instrument?: string | string[]; style?: string | string[] }> }) {
  const sp = await searchParams
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const { t, locale } = await getServerTranslator()
  const [catalog, englishStyles] = await Promise.all([getMarketingCatalog(locale), getEnglishStyleNames()])

  // Old contract: /explore?style=<slug> now lives at the style page.
  const styleSlug = one(sp.style)
  if (styleSlug) {
    const country = catalog.countries.find(c => c.styles.some(s => s.slug === styleSlug))
    if (country) redirect(`/explore/${country.slug}/${styleSlug}`)
  }

  const k = (key: string, p?: Record<string, string | number>) => t(`marketing.site.explore.${key}`, p)
  // Group the grid by instrument (stage-plot order), fundamentals first.
  const courses = catalog.instruments.flatMap(i => (i.fundamentals ? [i.fundamentals, ...i.courses] : i.courses))
  // Countries in atlas order (Cuba, Puerto Rico, Dominican Republic, Colombia), unknown ones last.
  const metaOrder = Object.keys(COUNTRY_META)
  const rank = (slug: string) => { const i = metaOrder.indexOf(slug); return i < 0 ? metaOrder.length : i }
  const countries = [...catalog.countries].sort((a, b) => rank(a.slug) - rank(b.slug))
  const pending = countries.filter(c => c.styles.length > 0 && !c.styles.some(s => s.live)).map(c => c.name)
  const pendingList = pending.length ? new Intl.ListFormat(locale, { type: 'conjunction' }).format(pending) : null

  return (
    <>
      <ExploreBrowser
        key={one(sp.instrument) ?? 'all'}
        courses={courses}
        englishStyles={englishStyles}
        instruments={catalog.instruments.map(i => ({ key: i.key, count: i.total }))}
        countries={countries.map(c => ({ slug: c.slug, name: c.name, live: c.styles.some(s => s.live) }))}
        initialInstrument={initialInstrument(one(sp.instrument), catalog.instruments.map(i => i.key))}
        crumbs={[{ label: t('marketing.site.common.home'), href: '/' }, { label: k('crumb') }]}
      />

      <section className="sec" style={{ paddingBlock: 'clamp(72px,8vw,120px)' }}>
        <div className="wrap">
          <Reveal className="sec-head">
            <div>
              <p className="eyebrow">{k('atlasEyebrow')}</p>
              <h2 className="h2" style={{ marginTop: 18 }}>{k('atlasTitle')} <Accent>{k('atlasAccent')}</Accent></h2>
            </div>
            {pendingList && <p className="lede">{k('atlasInProduction', { countries: pendingList })}</p>}
          </Reveal>
          <StyleAtlas
            countries={countries}
            labels={{
              live: t('marketing.site.common.live'),
              soon: t('marketing.site.common.comingSoon'),
              stylesLive: (live, total) => k('stylesLive', { live, total }),
            }}
          />
        </div>
      </section>

      <Finale />
    </>
  )
}
