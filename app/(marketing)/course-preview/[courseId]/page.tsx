import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getServerTranslator } from '@/lib/i18n/server'
import { localizeRow, localizeSectionTree, localizeTeacher, pick, COURSE_FIELDS } from '@/lib/i18n/localize'
import { instrumentLabel } from '@/lib/i18n/instruments'
import { getPricing } from '@/lib/payments/pricing-source'
import { formatCents } from '@/lib/payments/pricing-types'
import { bioExcerpt } from '@/lib/marketing/bio-excerpt'
import { getMarketingCatalog } from '@/lib/marketing/data'
import { COUNTRY_META } from '@/lib/marketing/catalog'
import { yearlySavingPercent } from '@/lib/marketing/pricing-calc'
import { findTeacherByName } from '@/lib/marketing/style-teachers'
import { splitNickname } from '@/lib/marketing/teacher-name'
import { Accent } from '@/components/marketing/site/PageHead'
import { Sleeve } from '@/components/marketing/site/Sleeve'
import { StageClip } from '@/components/marketing/site/StageClip'
import { Finale } from '@/components/marketing/site/Finale'
import { Curriculum, type CurriculumSection } from '@/components/marketing/explore/Curriculum'
import { sleeveSeed } from '@/components/marketing/explore/Poster'
import '../../styles/explore.css'

type Params = Promise<{ courseId: string }>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** One published course with its style and country, or null (memoised per request for metadata + page). */
const getCourse = cache(async (courseId: string) => {
  if (!UUID.test(courseId)) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('courses')
    .select('id, title, title_es, description, description_es, instrument, is_fundamentals, is_published, teacher_id, teacher_name, musical_styles(name, name_es, slug, countries(name, name_es, slug))')
    .eq('id', courseId)
    .maybeSingle()
  return data && data.is_published ? data : null
})

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { courseId } = await params
  const { t, locale } = await getServerTranslator()
  const course = await getCourse(courseId)
  const title = course ? pick(locale, course.title, course.title_es) : null
  const description = course ? pick(locale, course.description, course.description_es) : null
  return {
    title: title ? t('marketing.site.course.meta.title', { title }) : t('marketing.site.course.meta.fallbackTitle'),
    description: description || t('marketing.site.course.meta.fallbackDescription'),
  }
}

const Check = () => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
)

export default async function CoursePreviewPage({ params }: { params: Params }) {
  const { courseId } = await params
  const raw = await getCourse(courseId)
  if (!raw) notFound()
  const { t, locale } = await getServerTranslator()
  const k = (key: string, p?: Record<string, string | number>) => t(`marketing.site.course.${key}`, p)
  const supabase = await createClient()

  const course = { ...raw }
  localizeRow(course as Record<string, unknown>, locale, COURSE_FIELDS)
  const styleRow = raw.musical_styles && !Array.isArray(raw.musical_styles) ? raw.musical_styles : null
  const countryRow = styleRow?.countries && !Array.isArray(styleRow.countries) ? styleRow.countries : null
  const styleName = styleRow ? pick(locale, styleRow.name, styleRow.name_es ?? '') || styleRow.name : null
  const inst = course.instrument ? instrumentLabel(course.instrument, locale) : null

  const [{ data: sectionRows }, catalog, pricing] = await Promise.all([
    supabase
      .from('course_sections')
      .select('id, title, title_es, description, description_es, order_index, classes(id, title, title_es, description, description_es, order_index, is_free)')
      .eq('course_id', raw.id)
      .order('order_index'),
    getMarketingCatalog(locale),
    getPricing(),
  ])
  localizeSectionTree(sectionRows as Record<string, unknown>[] | null, locale)
  const sections: CurriculumSection[] = (sectionRows ?? []).map(s => ({
    id: s.id,
    title: s.title,
    lessons: [...(s.classes ?? [])].sort((a, b) => a.order_index - b.order_index).map(c => ({ id: c.id, title: c.title, free: !!c.is_free })),
  }))
  const lessonCount = sections.reduce((n, s) => n + s.lessons.length, 0)
  const pendingSections = sections.filter(s => s.lessons.length === 0).length

  // Instructor: the linked teacher, else the free-text teacher_name matched to a teacher.
  const teacherId = raw.teacher_id ?? findTeacherByName(catalog.teachers, raw.teacher_name)?.id ?? null
  let teacher: { id: string; name: string; instrument: string | null; image_url: string | null; blurb: string } | null = null
  if (teacherId) {
    const { data: tr } = await supabase.from('teachers').select('id, name, instrument, instrument_es, bio, bio_es, image_url').eq('id', teacherId).maybeSingle()
    if (tr) {
      localizeTeacher(tr as Record<string, unknown>, locale)
      teacher = { id: tr.id, name: tr.name, instrument: tr.instrument, image_url: tr.image_url, blurb: bioExcerpt(tr.bio) }
    }
  }
  const nick = teacher ? splitNickname(teacher.name) : null

  const titleNode = styleName && inst && !course.is_fundamentals
    ? <>{styleName} <Accent>{inst.toLowerCase()}.</Accent></>
    : course.title
  const sleeveTitle = course.is_fundamentals && inst
    ? <>{inst}<br />{t('marketing.site.explore.fundamentals')}</>
    : styleName ? <>{styleName.split(/\s+/).map((w, i) => <span key={i}>{i > 0 && <br />}{w}</span>)}</> : course.title
  const countryCode = countryRow ? COUNTRY_META[countryRow.slug]?.code : undefined

  const prices = { base_monthly: pricing.base_monthly.amount_cents, base_annual: pricing.base_annual.amount_cents, addon_monthly: pricing.addon_monthly.amount_cents }
  const savePct = yearlySavingPercent(prices)

  const crumbs: { label: string; href?: string }[] = [
    { label: t('marketing.site.common.home'), href: '/' },
    { label: t('marketing.site.explore.crumb'), href: '/explore' },
  ]
  if (styleRow && countryRow) crumbs.push({ label: styleName!, href: `/explore/${countryRow.slug}/${styleRow.slug}` })
  crumbs.push({ label: inst ?? course.title })

  return (
    <>
      <header className="phead">
        <div className="lights" aria-hidden="true"><div className="beam b1" /><div className="beam b2" /></div>
        <div className="wrap course-hero" style={{ paddingBlock: 'clamp(40px,6vw,90px) clamp(40px,5vw,72px)' }}>
          <div>
            <nav className="crumbs" aria-label="Breadcrumb">
              {crumbs.map((c, i) => (
                <span key={i} style={{ display: 'contents' }}>
                  {i > 0 && <span aria-hidden="true">/</span>}
                  {c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
                </span>
              ))}
            </nav>
            <h1 className="ptitle">{titleNode}</h1>
            {course.description && <p className="lede" style={{ marginTop: 22 }}>{course.description}</p>}
            <div className="course-meta">
              <span className="pill">{k(sections.length === 1 ? 'sectionsOne' : 'sections', { n: sections.length })}</span>
              <span className="pill">{k(lessonCount === 1 ? 'lessonsOne' : 'lessons', { n: lessonCount })}</span>
              <span className="pill">{k('notation')}</span>
            </div>
            {teacher && (
              <Link className="inst-card" href={`/instructors/${teacher.id}`} style={{ marginTop: 28, maxWidth: 540 }}>
                {teacher.image_url
                  ? <span className="ic-img"><Image src={teacher.image_url} alt="" fill sizes="120px" /></span>
                  : <span className="ph" aria-hidden="true" />}
                <div>
                  <span className="sp-label">{k('maestro')}</span>
                  <b style={{ marginTop: 8 }}>
                    {nick?.nickname ? <>{nick.before} “{nick.nickname}” {nick.after}</> : teacher.name}
                  </b>
                  {(teacher.blurb || teacher.instrument) && <p>{teacher.blurb || teacher.instrument}</p>}
                </div>
              </Link>
            )}
          </div>
          <div className="course-sleeve">
            <Sleeve
              title={sleeveTitle}
              topLeft={inst ?? undefined}
              topRight={course.is_fundamentals ? t('marketing.site.explore.start') : countryCode}
              seed={sleeveSeed(styleRow?.name, course.instrument)}
            />
          </div>
        </div>
      </header>

      <section className="sec" style={{ paddingTop: 'clamp(48px,6vw,88px)' }}>
        <div className="wrap course-body">
          <div style={{ minWidth: 0 }}>
            {sections.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                  <h2 className="h2" style={{ fontSize: 'clamp(36px,4vw,56px)' }}>{k('curriculum')}</h2>
                  <span className="eyebrow">
                    {k(lessonCount === 1 ? 'lessonsOne' : 'lessons', { n: lessonCount })}
                    {pendingSections > 0 && <> · {k(pendingSections === 1 ? 'inProductionCountOne' : 'inProductionCount', { n: pendingSections })}</>}
                  </span>
                </div>
                <Curriculum
                  sections={sections}
                  labels={{
                    lessons: k('lessons'),
                    lessonsOne: k('lessonsOne'),
                    inProduction: k('inProduction'),
                    inProductionBody: k('inProductionBody'),
                    freePreview: k('freePreview'),
                    plan: k('plan'),
                  }}
                />
              </div>
            )}
            <div style={{ marginTop: sections.length ? 56 : 0 }}>
              <p className="eyebrow" style={{ marginBottom: 16 }}>{k('practice')}</p>
              <StageClip />
            </div>
          </div>
          <aside className="enroll">
            <span className="sp-label">{k('enroll.label', { instrument: inst ?? course.title })}</span>
            <div className="price tnum">{formatCents(prices.base_monthly)}<small>{k('enroll.perMonth')}</small></div>
            <ul>
              {styleName && !course.is_fundamentals && <li><Check />{k('enroll.style', { style: styleName })}</li>}
              <li><Check />{k('enroll.playsense')}</li>
              <li><Check />{k('enroll.cancel')}</li>
            </ul>
            <a className="btn btn-hot" href="#join">{k('enroll.cta')}</a>
            <Link className="btn btn-ghost" href="/pricing">{k('enroll.compare')}</Link>
            {savePct > 0 && <small style={{ color: 'var(--humo-2)', fontSize: 13 }}>{k('enroll.yearly', { price: formatCents(prices.base_annual), pct: savePct })}</small>}
          </aside>
        </div>
      </section>

      <Finale />
    </>
  )
}
