import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Music } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

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

      return {
        ...teacher,
        courseCount: count || 0
      }
    })
  )

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Teachers</h1>
          <p className="text-muted-foreground">
            Manage all instructors
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/teachers/new">
            <Plus className="w-4 h-4 mr-2" />
            Add Teacher
          </Link>
        </Button>
      </div>

      {teachersWithCourses && teachersWithCourses.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teachersWithCourses.map((teacher: any) => (
            <Card key={teacher.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center">
                  {/* Avatar */}
                  <Avatar className="w-20 h-20 mb-4">
                    {teacher.image_url && (
                      <AvatarImage src={teacher.image_url} alt={teacher.name} />
                    )}
                    <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                      {getInitials(teacher.name)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Name */}
                  <h3 className="text-lg font-semibold mb-1">{teacher.name}</h3>

                  {/* Instrument */}
                  <div className="flex items-center gap-1 text-sm text-primary mb-2">
                    <Music className="w-4 h-4" />
                    <span>{teacher.instrument}</span>
                  </div>

                  {/* Specialties */}
                  {teacher.specialties && teacher.specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3 justify-center">
                      {teacher.specialties.map((specialty: string) => (
                        <Badge key={specialty} variant="secondary" className="text-xs">
                          {specialty}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Bio */}
                  {teacher.bio && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {teacher.bio}
                    </p>
                  )}

                  {/* Course Count */}
                  <p className="text-xs text-muted-foreground mb-4">
                    {teacher.courseCount} {teacher.courseCount === 1 ? 'course' : 'courses'} assigned
                  </p>

                  {/* Actions */}
                  <div className="flex gap-2 w-full">
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <Link href={`/admin/teachers/${teacher.id}`}>Edit</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Teachers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Add your first teacher to start assigning them to courses.
            </p>
            <Button asChild>
              <Link href="/admin/teachers/new">Add Teacher</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
