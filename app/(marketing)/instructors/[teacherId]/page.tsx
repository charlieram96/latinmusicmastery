import '../../styles/instructors.css'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getServerTranslator } from '@/lib/i18n/server'
import type { Locale } from '@/lib/i18n'
import { instrumentLabel } from '@/lib/i18n/instruments'
import { pick } from '@/lib/i18n/localize'
import { COUNTRY_META } from '@/lib/marketing/catalog'
import { splitNickname } from '@/lib/marketing/teacher-name'
import { displayName, presentTeacher } from '@/lib/marketing/present-teacher'
import { isUuid, mergeTeacherCourses } from '@/lib/marketing/teacher-courses'
import { Accent } from '@/components/marketing/site/PageHead'
import { Sleeve } from '@/components/marketing/site/Sleeve'
import { Finale } from '@/components/marketing/site/Finale'
import { BioProse } from '@/components/marketing/instructors/BioProse'

type Params = { params: Promise<{ teacherId: string }> }

const loadTeacher = cache(async (id: string, locale: Locale) => {
  if (!isUuid(id)) return null
  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from('teachers')
    .select('id, name, instrument, instrument_es, bio, bio_es, image_url, specialties')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!row) return null
  const instrument = locale === 'es'
    ? (row.instrument_es || (row.instrument ? instrumentLabel(row.instrument, locale) : ''))
    : (row.instrument ?? '')
  return {
    ...presentTeacher({ name: row.name, imageUrl: row.image_url, specialties: row.specialties ?? [] }),
    id: row.id,
    instrument,
    bio: pick(locale, row.bio, row.bio_es) as unknown,
  }
})

const COURSE_COLS = 'id, title, title_es, description, description_es, instrument, is_fundamentals, order_index, musical_styles(name, name_es, countries(slug))'

async function loadCourses(teacherId: string, teacherName: string) {
  const supabase = await createClient()
  const [byId, byName] = await Promise.all([
    supabase.from('courses').select(COURSE_COLS).eq('is_published', true).eq('teacher_id', teacherId),
    supabase.from('courses').select(COURSE_COLS).eq('is_published', true).eq('teacher_name', teacherName),
  ])
  if (byId.error) throw byId.error
  if (byName.error) throw byName.error
  const courses = mergeTeacherCourses(byId.data, byName.data)
  const counts = new Map<string, { sections: number; lessons: number }>()
  if (courses.length > 0) {
    const { data: sections, error } = await supabase.from('course_sections').select('course_id, classes(id)').in('course_id', courses.map(c => c.id))
    if (error) throw error
    for (const s of sections ?? []) {
      const c = counts.get(s.course_id) ?? { sections: 0, lessons: 0 }
      c.sections++
      c.lessons += Array.isArray(s.classes) ? s.classes.length : 0
      counts.set(s.course_id, c)
    }
  }
  return courses.map(c => ({ ...c, ...(counts.get(c.id) ?? { sections: 0, lessons: 0 }) }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { teacherId } = await params
  const { t, locale } = await getServerTranslator()
  const teacher = await loadTeacher(teacherId, locale)
  if (!teacher) return {}
  const vars = { name: displayName(teacher.name), instrument: teacher.instrument }
  return {
    title: t('marketing.site.profile.metaTitle', vars),
    description: t('marketing.site.profile.metaDescription', vars),
  }
}

export default async function TeacherProfilePage({ params }: Params) {
  const { teacherId } = await params
  const { t, locale } = await getServerTranslator()
  const teacher = await loadTeacher(teacherId, locale)
  if (!teacher) notFound()
  const courses = await loadCourses(teacher.id, teacher.name)
  const k = (key: string, vars?: Record<string, string | number>) => t(`marketing.site.profile.${key}`, vars)

  const { before, nickname, after } = splitNickname(teacher.name)
  const shownName = displayName(teacher.name)
  const callName = nickname ?? before.split(/\s+/)[0]
  const lessons = (n: number) => (n === 1 ? k('lessonsOne') : k('lessons', { count: n }))
  const sections = (n: number) => (n === 1 ? k('sectionsOne') : k('sections', { count: n }))

  return (
    <>
      <div className="wrap profile tprof">
        <figure className="portrait" style={{ margin: 0 }}>
          <div className="tprof-photo">
            <Image src={teacher.imageUrl} alt={k('portraitAlt', { name: shownName })} fill priority sizes="(max-width: 1100px) min(520px, 100vw), 40vw" />
          </div>
          {teacher.instrument && <figcaption>{teacher.instrument}</figcaption>}
        </figure>
        <div className="tprof-main">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/instructors">{t('marketing.site.instructors.crumb')}</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{shownName}</span>
          </nav>
          <h1 className="ptitle tprof-name">
            {before}{nickname && <> <Accent>“{nickname}”</Accent></>}{after && <> {after}</>}
          </h1>
          {teacher.instrument && <p className="tprof-inst">{teacher.instrument}</p>}
          {teacher.specialties.length > 0 && (
            <ul className="played-with tprof-tags" aria-label={k('specialties')}>
              {teacher.specialties.map(s => <li key={s} className="chip">{s}</li>)}
            </ul>
          )}
          <div className="prose tprof-bio"><BioProse doc={teacher.bio} /></div>

          <h2 className="eyebrow tprof-eyebrow">{k('courses')}</h2>
          {courses.length > 0 ? (
            <ul className="tprof-courses">
              {courses.map(c => {
                const inst = c.instrument ? instrumentLabel(c.instrument, locale) : ''
                const style = Array.isArray(c.musical_styles) ? c.musical_styles[0] : c.musical_styles
                const country = style ? (Array.isArray(style.countries) ? style.countries[0] : style.countries) : null
                const styleName = style ? pick(locale, style.name, style.name_es) : null
                const title = pick(locale, c.title, c.title_es)
                const description = pick(locale, c.description, c.description_es)
                const meta = [c.lessons > 0 && lessons(c.lessons), c.sections > 0 && sections(c.sections)].filter(Boolean).join(' · ')
                return (
                  <li key={c.id}>
                    <Link className="inst-card" href={`/course-preview/${c.id}`}>
                      <div className="tprof-sleeve" aria-hidden="true">
                        <Sleeve
                          title={c.is_fundamentals ? `${inst} ${k('basics')}` : (styleName ?? title)}
                          topLeft={inst || undefined}
                          topRight={c.is_fundamentals ? k('start') : (country ? COUNTRY_META[country.slug]?.code : undefined)}
                          seed={`${style?.name ?? c.title}${c.instrument ?? ''}`}
                        />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        {meta && <span className="sp-label">{meta}</span>}
                        <b style={{ marginTop: meta ? 8 : 0 }}>{title}</b>
                        {description && <p>{description}</p>}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="tprof-none">{k('noCourses', { name: callName })}</p>
          )}
        </div>
      </div>
      <Finale title={k('finaleTitle')} accent={`${callName}.`} lede={k('finaleLede')} />
    </>
  )
}
