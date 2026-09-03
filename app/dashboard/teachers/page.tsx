import { createClient } from '@/lib/supabase/server'
import { getServerLocale } from '@/lib/i18n/server'
import { localizeCourse, localizeTeachers } from '@/lib/i18n/localize'
import { TeachersView } from './teachers-view'

export default async function TeachersPage() {
  const supabase = await createClient()

  // Fetch all teachers with their courses
  const { data: teachers } = await supabase
    .from('teachers')
    .select(`
      *,
      courses(
        id,
        title,
        title_es,
        slug,
        thumbnail_url,
        is_published,
        musical_style:musical_styles(name, name_es)
      )
    `)
    .order('name')

  const locale = await getServerLocale()
  // `select('*')` includes bio_es / instrument_es, so the overlay applies here.
  localizeTeachers(teachers as Record<string, unknown>[] | null, locale)

  // Filter to only published courses
  const teachersWithCourses = (teachers || []).map(teacher => ({
    ...teacher,
    courses: (teacher.courses || [])
      .filter((c: any) => c.is_published)
      .map((c: any) => localizeCourse(c, locale))
  }))

  // Get total stats
  const totalTeachers = teachersWithCourses.length
  const totalCourses = teachersWithCourses.reduce((acc, t) => acc + t.courses.length, 0)
  const uniqueInstruments = [...new Set(teachersWithCourses.map(t => t.instrument))].length

  return (
    <TeachersView
      teachersWithCourses={teachersWithCourses}
      totalTeachers={totalTeachers}
      totalCourses={totalCourses}
      uniqueInstruments={uniqueInstruments}
    />
  )
}
