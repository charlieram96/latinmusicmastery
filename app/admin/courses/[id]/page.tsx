import { getCourseInstrumentOptions } from '@/lib/courses/instrument-options'
import { getServerLocale } from '@/lib/i18n/server'
import { localizeRow } from '@/lib/i18n/localize'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { CourseStudio } from '@/components/admin/course-studio/course-studio'
import { getCourseStructure } from '@/app/actions/course-builder'

interface CourseEditPageProps {
  params: Promise<{
    id: string
  }>
  /** `?class=<classId>&item=<itemId>` opens that lesson (and item) on load. */
  searchParams: Promise<{
    class?: string | string[]
    item?: string | string[]
  }>
}

function firstParam(value: string | string[] | undefined): string | null {
  const v = Array.isArray(value) ? value[0] : value
  return v ? v : null
}

export default async function CourseEditPage({ params, searchParams }: CourseEditPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const initialSelection = { classId: firstParam(query.class), itemId: firstParam(query.item) }
  const [locale, courseInstruments] = await Promise.all([getServerLocale(), getCourseInstrumentOptions()])
  const supabase = await createClient()

  // Independent reads run together so entering any course takes one batch.
  const [{ data: course, error: courseError }, { data: musicalStyles }, { data: teachers }, structure] = await Promise.all([
    supabase.from('courses').select('id, title, title_es, slug, description, description_es, musical_style_id, teacher_id, is_published, thumbnail_url, instrument, is_fundamentals, difficulty, is_master_class').eq('id', id).single(),
    supabase.from('musical_styles').select('id, name, name_es, country:countries(name, name_es)').order('name'),
    supabase.from('teachers').select('id, name, instrument').order('name'),
    getCourseStructure(id),
  ])
  if (courseError && courseError.code !== 'PGRST116') throw new Error(courseError.message)
  if (!course) notFound()
  if (structure.error) throw new Error(structure.error)
  const sections = structure.data

  for (const style of musicalStyles ?? []) {
    localizeRow(style, locale, ['name'])
    localizeRow(style.country, locale, ['name'])
  }

  return (
    <CourseStudio
      courseInstruments={courseInstruments}
      course={{
        id: course.id,
        title: course.title,
        title_es: course.title_es,
        slug: course.slug,
        description: course.description,
        description_es: course.description_es,
        musical_style_id: course.musical_style_id,
        teacher_id: course.teacher_id,
        is_published: course.is_published ?? false,
        thumbnail_url: course.thumbnail_url,
        instrument: course.instrument,
        is_fundamentals: course.is_fundamentals ?? false,
        difficulty: course.difficulty,
        is_master_class: course.is_master_class ?? false,
      }}
      musicalStyles={(musicalStyles || []).map((style: any) => ({
        id: style.id,
        name: style.name,
        country: style.country,
      }))}
      teachers={(teachers || []).map((teacher: any) => ({
        id: teacher.id,
        name: teacher.name,
        instrument: teacher.instrument,
      }))}
      initialSections={(sections || []) as any}
      initialSelection={initialSelection}
    />
  )
}
