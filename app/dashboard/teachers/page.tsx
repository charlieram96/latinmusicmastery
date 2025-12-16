import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Music, GraduationCap, BookOpen } from 'lucide-react'
import { TeacherCard } from '@/components/dashboard/teacher-card'

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
    <>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-heading mb-2">Our Teachers</h1>
        <p className="text-muted-foreground mb-6">
          Learn from world-class musicians with decades of performance and teaching experience
        </p>

        {/* Quick Stats */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2 bg-secondary rounded-lg px-4 py-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            <span className="font-semibold">{totalTeachers} Expert Teachers</span>
          </div>
          <div className="flex items-center gap-2 bg-secondary rounded-lg px-4 py-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="font-semibold">{totalCourses} Courses Available</span>
          </div>
          <div className="flex items-center gap-2 bg-secondary rounded-lg px-4 py-2">
            <Music className="h-5 w-5 text-primary" />
            <span className="font-semibold">{uniqueInstruments} Instruments</span>
          </div>
        </div>
      </div>

      {/* Teachers Grid */}
      {teachersWithCourses.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {teachersWithCourses.map((teacher) => (
            <TeacherCard key={teacher.id} teacher={teacher} />
          ))}
        </div>
      ) : (
        /* Empty State */
        <Card>
          <CardContent className="p-12 text-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Teachers Yet</h3>
            <p className="text-muted-foreground">
              Check back soon for our amazing roster of instructors!
            </p>
          </CardContent>
        </Card>
      )}
    </>
  )
}
