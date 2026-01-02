import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Music, BookOpen, User } from 'lucide-react'

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
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {teachersWithCourses.map((teacher: any) => (
            <Card key={teacher.id} className="overflow-hidden group hover:shadow-lg transition-all duration-300 border-0 shadow-md p-0 gap-0">
              {/* Image Section */}
              <div className="relative aspect-[4/3] bg-gradient-to-br from-primary/20 to-primary/5">
                {teacher.image_url ? (
                  <Image
                    src={teacher.image_url}
                    alt={teacher.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-10 h-10 text-primary/40" />
                    </div>
                  </div>
                )}
                {/* Instrument Badge */}
                <div className="absolute top-3 left-3">
                  <Badge className="bg-black/60 hover:bg-black/60 text-white border-0 backdrop-blur-sm">
                    <Music className="w-3 h-3 mr-1" />
                    {teacher.instrument}
                  </Badge>
                </div>
              </div>

              {/* Content Section */}
              <CardContent className="p-4">
                <h3 className="font-semibold text-lg mb-2 truncate">{teacher.name}</h3>

                {/* Specialties */}
                {teacher.specialties && teacher.specialties.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {teacher.specialties.slice(0, 3).map((specialty: string) => (
                      <Badge key={specialty} variant="secondary" className="text-xs font-normal">
                        {specialty}
                      </Badge>
                    ))}
                    {teacher.specialties.length > 3 && (
                      <Badge variant="secondary" className="text-xs font-normal">
                        +{teacher.specialties.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Bio */}
                {teacher.bio && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {teacher.bio}
                  </p>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>{teacher.courseCount} {teacher.courseCount === 1 ? 'course' : 'courses'}</span>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="h-8">
                    <Link href={`/admin/teachers/${teacher.id}`}>Edit</Link>
                  </Button>
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
