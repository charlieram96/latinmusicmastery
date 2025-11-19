import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus } from 'lucide-react'

export default async function CoursesPage() {
  const supabase = await createClient()

  const { data: courses } = await supabase
    .from('courses')
    .select(`
      *,
      musical_style:musical_styles(name, country:countries(name)),
      teacher:teachers(id, name, instrument),
      lessons(id)
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Courses</h1>
          <p className="text-muted-foreground">
            Manage all courses
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/courses/new">
            <Plus className="w-4 h-4 mr-2" />
            Add Course
          </Link>
        </Button>
      </div>

      {courses && courses.length > 0 ? (
        <div className="grid gap-4">
          {courses.map((course: any) => (
            <Card key={course.id}>
              <CardContent className="flex items-start gap-4 p-6">
                {course.thumbnail_url && (
                  <img
                    src={course.thumbnail_url}
                    alt={course.title}
                    className="w-32 h-20 object-cover rounded"
                  />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold">{course.title}</h3>
                    {course.is_published ? (
                      <Badge>Published</Badge>
                    ) : (
                      <Badge variant="secondary">Draft</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {course.musical_style.name} • {course.musical_style.country.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {course.lessons?.length || 0} lessons • by {course.teacher?.name || course.teacher_name}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/courses/${course.id}`}>Edit</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Courses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Create your first course to start building content.
            </p>
            <Button asChild>
              <Link href="/admin/courses/new">Add Course</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
