import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Music, Mail } from 'lucide-react'

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default async function TeachersPage() {
  const supabase = await createClient()

  // Fetch all teachers
  const { data: teachers } = await supabase
    .from('teachers')
    .select('*')
    .order('name')

  // Get course count for each teacher
  const teachersWithCourses = await Promise.all(
    (teachers || []).map(async (teacher) => {
      const { count } = await supabase
        .from('courses')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', teacher.id)
        .eq('is_published', true)

      return {
        ...teacher,
        courseCount: count || 0
      }
    })
  )

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-3">Our Teachers</h1>
        <p className="text-lg text-muted-foreground">
          Learn from world-class musicians with decades of performance and teaching experience
        </p>
      </div>

      {/* Teachers Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {teachersWithCourses.map((teacher) => (
          <Card key={teacher.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center">
                {/* Avatar */}
                <Avatar className="w-24 h-24 mb-4 ring-2 ring-primary/10">
                  {teacher.image_url && (
                    <AvatarImage src={teacher.image_url} alt={teacher.name} />
                  )}
                  <AvatarFallback className="bg-primary/10 text-primary text-2xl font-semibold">
                    {getInitials(teacher.name)}
                  </AvatarFallback>
                </Avatar>

                {/* Name */}
                <h3 className="text-xl font-bold mb-2">{teacher.name}</h3>

                {/* Primary Instrument */}
                <div className="flex items-center gap-2 text-primary mb-3">
                  <Music className="w-4 h-4" />
                  <span className="font-medium">{teacher.instrument}</span>
                </div>

                {/* Specialties */}
                {teacher.specialties && teacher.specialties.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4 justify-center">
                    {teacher.specialties.map((specialty: string) => (
                      <Badge key={specialty} variant="secondary" className="text-xs">
                        {specialty}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Bio */}
                {teacher.bio && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                    {teacher.bio}
                  </p>
                )}

                {/* Course Count */}
                <p className="text-sm font-medium text-muted-foreground mb-4">
                  {teacher.courseCount} {teacher.courseCount === 1 ? 'course' : 'courses'} available
                </p>

                {/* Email (if available) */}
                {teacher.email && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="w-3 h-3" />
                    <span>{teacher.email}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {!teachersWithCourses || teachersWithCourses.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
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
