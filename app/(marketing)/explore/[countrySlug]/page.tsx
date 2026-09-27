import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getServerTranslator } from '@/lib/i18n/server'
import { getMarketingCatalog } from '@/lib/marketing/data'
import { PageHead, Accent } from '@/components/marketing/site/PageHead'
import { Reveal } from '@/components/marketing/site/Reveal'
import { Finale } from '@/components/marketing/site/Finale'
import { Poster } from '@/components/marketing/explore/Poster'
import '../../styles/explore.css'

type Params = Promise<{ countrySlug: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { countrySlug } = await params
  const { t, locale } = await getServerTranslator()
  const country = (await getMarketingCatalog(locale)).countries.find(c => c.slug === countrySlug)
  if (!country) return { title: t('marketing.site.explore.meta.title') }
  return {
    title: t('marketing.site.explore.country.meta.title', { country: country.name }),
    description: t('marketing.site.explore.country.meta.description', { country: country.name }),
  }
}

export default async function CountryPage({ params }: { params: Params }) {
  const { countrySlug } = await params
  const { t, locale } = await getServerTranslator()
  const catalog = await getMarketingCatalog(locale)
  const country = catalog.countries.find(c => c.slug === countrySlug)
  if (!country) notFound()

  const k = (key: string, p?: Record<string, string | number>) => t(`marketing.site.explore.country.${key}`, p)
  const courses = catalog.courses.filter(c => c.countrySlug === country.slug)
  const live = country.styles.filter(s => s.live).length

  return (
    <>
      <PageHead
        crumbs={[
          { label: t('marketing.site.common.home'), href: '/' },
          { label: t('marketing.site.explore.crumb'), href: '/explore' },
          { label: country.name },
        ]}
        title={<>{k('title')} <Accent>{country.name}.</Accent></>}
        lede={courses.length ? k('lede', { courses: courses.length, live }) : k('ledeNone', { country: country.name })}
      >
        <div className="ex-ctry" style={{ ['--cc' as string]: country.color }}>
          <div className="ctry-code" aria-hidden="true">{country.code}</div>
          {country.geo && <p className="ctry-geo">{country.geo}</p>}
        </div>
        {country.styles.length > 0 && (
          <ul className="ex-styles" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {country.styles.map(s => (
              <li key={s.slug}>
                {s.live
                  ? <Link className="ex-style" href={`/explore/${country.slug}/${s.slug}`}>{s.name} <small>{k(s.courseCount === 1 ? 'styleCountOne' : 'styleCount', { n: s.courseCount })}</small></Link>
                  : <span className="ex-style soon">{s.name} <small>{t('marketing.site.common.comingSoon')}</small></span>}
              </li>
            ))}
          </ul>
        )}
      </PageHead>

      <section className="sec" style={{ paddingTop: 'clamp(48px,6vw,88px)' }}>
        <div className="wrap">
          <Reveal className="sec-head">
            <div>
              <p className="eyebrow">{k('coursesEyebrow')}</p>
              <h2 className="h2" style={{ marginTop: 18 }}>{k('coursesTitle')} <Accent>{k('coursesAccent')}</Accent></h2>
            </div>
          </Reveal>
          {courses.length
            ? <div className="posters" style={{ paddingTop: 0 }}>{courses.map((c, i) => <Poster key={c.id} course={c} t={t} locale={locale} index={i} />)}</div>
            : <p className="empty">{k('empty', { country: country.name })}</p>}
        </div>
      </section>

      <Finale />
    </>
  )
}
