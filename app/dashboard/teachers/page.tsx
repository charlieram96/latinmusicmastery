import { createClient } from '@/lib/supabase/server'
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
        slug,
        thumbnail_url,
        is_published,
        musical_style:musical_styles(name)
      )
    `)
    .order('name')

  // Filter to only published courses
  const teachersWithCourses = (teachers || []).map(teacher => ({
    ...teacher,
    courses: (teacher.courses || []).filter((c: any) => c.is_published)
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
