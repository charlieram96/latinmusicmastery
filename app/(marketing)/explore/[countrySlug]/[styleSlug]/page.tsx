import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getServerTranslator } from '@/lib/i18n/server'
import { pick } from '@/lib/i18n/localize'
import type { Locale } from '@/lib/i18n'
import { getMarketingCatalog } from '@/lib/marketing/data'
import { INSTRUMENT_ORDER } from '@/lib/marketing/catalog'
import { sortCourses } from '@/lib/marketing/explore-filter'
import { getEnglishStyleNames } from '@/lib/marketing/style-names'
import { teachersForStyle } from '@/lib/marketing/style-teachers'
import { claveForStyle } from '@/lib/marketing/style-clave'
import { splitTitleAccent } from '@/lib/marketing/title-accent'
import { PageHead, Accent } from '@/components/marketing/site/PageHead'
import { Reveal } from '@/components/marketing/site/Reveal'
import { Finale } from '@/components/marketing/site/Finale'
import { MaestroCard } from '@/components/marketing/site/MaestroCard'
import { Poster } from '@/components/marketing/explore/Poster'
import { ClaveCard } from '@/components/marketing/explore/ClaveCard'
import '../../../styles/explore.css'

type Params = Promise<{ countrySlug: string; styleSlug: string }>

/** Styles whose story paragraphs were written and checked for the site (spec §3). */
const WRITTEN_STORIES: Record<string, string[]> = { 'son-cubano': ['p1', 'p2', 'p3'] }

async function load(countrySlug: string, styleSlug: string, locale: Locale) {
  const catalog = await getMarketingCatalog(locale)
  const country = catalog.countries.find(c => c.slug === countrySlug)
  const style = country?.styles.find(s => s.slug === styleSlug)
  if (!country || !style) return null
  return { catalog, country, style }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { countrySlug, styleSlug } = await params
  const { t, locale } = await getServerTranslator()
  const found = await load(countrySlug, styleSlug, locale)
  if (!found) return { title: t('marketing.site.explore.meta.title') }
  const p = { style: found.style.name, country: found.country.name }
  return {
    title: t('marketing.site.style.meta.title', p),
    description: t('marketing.site.style.meta.description', p),
  }
}

/** Render `**bold**` runs in a locale string as <strong>. */
function Rich({ text }: { text: string }) {
  return <>{text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))}</>
}

export default async function StylePage({ params }: { params: Params }) {
  const { countrySlug, styleSlug } = await params
  const { t, locale } = await getServerTranslator()
  const found = await load(countrySlug, styleSlug, locale)
  if (!found) notFound()
  const { catalog, country, style } = found
  const englishStyles = await getEnglishStyleNames()

  const supabase = await createClient()
  const { data: row } = await supabase
    .from('musical_styles')
    .select('name, name_es, description, description_es, countries!inner(slug)')
    .eq('slug', styleSlug)
    .eq('countries.slug', countrySlug)
    .maybeSingle()

  const k = (key: string, p?: Record<string, string | number>) => t(`marketing.site.style.${key}`, p)
  const courses = sortCourses(catalog.courses.filter(c => c.styleSlug === style.slug), [], INSTRUMENT_ORDER)
  const clave = claveForStyle(style.slug)

  // Specialties are free text in either language, so match the English and Spanish names.
  const names = [row?.name, row?.name_es, style.name].filter((n): n is string => !!n)
  const maestros = catalog.teachers.filter(tc => tc.imageUrl && names.some(n => teachersForStyle([tc], n).length > 0))

  const written = WRITTEN_STORIES[style.slug]
  const description = row ? pick(locale, row.description, row.description_es) : null
  const story = written
    ? written.map(p => k(`story.${style.slug}.${p}`))
    : (description ?? '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
  const title = splitTitleAccent(style.name)
  const count = k(courses.length === 1 ? 'courseCountOne' : 'courseCount', { n: courses.length })

  return (
    <>
      <PageHead
        crumbs={[
          { label: t('marketing.site.common.home'), href: '/' },
          { label: t('marketing.site.explore.crumb'), href: '/explore' },
          { label: country.name, href: `/explore/${country.slug}` },
          { label: style.name },
        ]}
        title={<>{title.lead}{title.lead && ' '}<Accent>{title.accent.toLowerCase()}.</Accent></>}
      >
        <div className="course-meta" style={{ marginTop: 0 }}>
          <span className="pill">{country.name}{country.geo ? ` · ${country.geo.split(' · ')[0]}` : ''}</span>
          {clave && <span className="pill">{k(clave.key === 'son32' ? 'claveSon' : 'claveRumba')}</span>}
          <span className="pill">{count}</span>
        </div>
      </PageHead>

      <section className="sec">
        <div className={`wrap style-intro${clave ? '' : ' solo'}`}>
          <Reveal className="prose">
            <p className="eyebrow" style={{ marginBottom: 18 }}>{k('storyEyebrow')}</p>
            {story.length
              ? story.map((p, i) => <p key={i}><Rich text={p} /></p>)
              : <p>{k('storyFallback', { style: style.name })}</p>}
          </Reveal>
          {clave && <Reveal><ClaveCard clave={clave.key} hits={clave.hits} t={t} /></Reveal>}
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <Reveal className="sec-head">
            <div>
              <p className="eyebrow">{count}</p>
              <h2 className="h2" style={{ marginTop: 18 }}>{k('coursesTitle', { style: style.name })} <Accent>{k('coursesAccent')}</Accent></h2>
            </div>
            {courses.length > 0 && <p className="lede">{k('coursesLede', { style: style.name })}</p>}
          </Reveal>
          {courses.length
            ? <div className="posters" style={{ paddingTop: 0 }}>{courses.map((c, i) => <Poster key={c.id} course={c} t={t} locale={locale} englishStyle={c.styleSlug ? englishStyles[c.styleSlug] ?? null : null} index={i} />)}</div>
            : <p className="empty">{k('coursesEmpty', { style: style.name })}</p>}
        </div>
      </section>

      {maestros.length > 0 && (
        <section className="sec" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <Reveal className="sec-head">
              <div>
                <p className="eyebrow">{k('maestrosEyebrow')}</p>
                <h2 className="h2" style={{ marginTop: 18 }}>{k('maestrosTitle', { style: style.name })} <Accent>{k('maestrosAccent')}</Accent></h2>
              </div>
            </Reveal>
            <div className="igrid" style={{ paddingTop: 0 }}>
              {maestros.map(m => <MaestroCard key={m.id} teacher={m} href={`/instructors/${m.id}`} sizes="(max-width: 640px) 50vw, 300px" />)}
            </div>
          </div>
        </section>
      )}

      {clave
        ? <Finale title={k('finaleTitle')} accent={k('finaleAccent')} lede={k('finaleLede', { style: style.name })} />
        : <Finale lede={k('finaleLede', { style: style.name })} />}
    </>
  )
}
