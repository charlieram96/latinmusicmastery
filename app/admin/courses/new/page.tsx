import { getCourseInstrumentOptions } from '@/lib/courses/instrument-options'
import { getServerLocale } from '@/lib/i18n/server'
import { localizeRow } from '@/lib/i18n/localize'
import { createClient } from '@/lib/supabase/server'
import { NewCourseForm } from '@/components/admin/course-studio/new-course-form'

export default async function NewCoursePage() {
  const [locale, courseInstruments] = await Promise.all([getServerLocale(), getCourseInstrumentOptions()])
  const supabase = await createClient()

  const { data: musicalStyles } = await supabase
    .from('musical_styles')
    .select('id, name, name_es, country:countries(name, name_es)')
    .order('name')

  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, name, instrument')
    .order('name')

  for (const style of musicalStyles ?? []) {
    localizeRow(style, locale, ['name'])
    localizeRow(style.country, locale, ['name'])
  }

  return (
    <NewCourseForm
      courseInstruments={courseInstruments}
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
    />
  )
}
