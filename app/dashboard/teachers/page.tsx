import { createClient } from '@/lib/supabase/server'
import { getServerLocale } from '@/lib/i18n/server'
import { localizeCourse, localizeTeachers } from '@/lib/i18n/localize'
import { splitInstruments, type TeacherCardData } from '@/lib/dashboard/teachers'
import { TeachersView } from './teachers-view'

interface CourseRow {
  id: string
  title: string
  slug: string
  thumbnail_url: string | null
  is_published: boolean | null
  musical_style: { name: string } | null
}
type TeacherRow = Omit<TeacherCardData, 'courses'> & { courses: CourseRow[] | null }

export default async function TeachersPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('teachers')
    .select(
      `
      *,
      courses(
        id, title, title_es, slug, thumbnail_url, is_published,
        musical_style:musical_styles(name, name_es)
      )
    `
    )
    .order('name')

  const locale = await getServerLocale()
  // `select('*')` includes bio_es / instrument_es, so the overlay applies here.
  localizeTeachers(data as Record<string, unknown>[] | null, locale)

  const teachers: TeacherCardData[] = ((data ?? []) as unknown as TeacherRow[]).map((teacher) => ({
    ...teacher,
    courses: (teacher.courses ?? [])
      .filter((c) => c.is_published)
      .map((c) => localizeCourse(c as unknown as Record<string, unknown>, locale) as unknown as CourseRow),
  }))

  const totalCourses = teachers.reduce((acc, t) => acc + t.courses.length, 0)
  const uniqueInstruments = new Set(teachers.flatMap((t) => splitInstruments(t.instrument))).size

  return (
    <TeachersView
      teachersWithCourses={teachers}
      totalTeachers={teachers.length}
      totalCourses={totalCourses}
      uniqueInstruments={uniqueInstruments}
    />
  )
}
