import { AdminText } from '@/components/admin/admin-text'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Lock, Unlock } from 'lucide-react'

export default async function LessonsPage() {
  const supabase = await createClient()

  const { data: lessons } = await supabase
    .from('lessons')
    .select(`
      *,
      course:courses(title, musical_style:musical_styles(name)),
      exercises(id)
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2"><AdminText text={"Lessons"} /></h1>
          <p className="text-muted-foreground"> <AdminText text={"Manage all lessons across courses"} /> </p>
        </div>
        <Button asChild>
          <Link href="/admin/lessons/new">
            <Plus className="w-4 h-4 mr-2" /> <AdminText text={"Add Lesson"} /> </Link>
        </Button>
      </div>

      {lessons && lessons.length > 0 ? (
        <div className="grid gap-4">
          {lessons.map((lesson: any) => (
            <Card key={lesson.id}>
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {lesson.is_free ? (
                      <Unlock className="w-4 h-4 text-green-600" />
                    ) : (
                      <Lock className="w-4 h-4 text-orange-600" />
                    )}
                    <h3 className="text-lg font-semibold">{lesson.title}</h3>
                    {lesson.is_free && <Badge variant="secondary"><AdminText text={"Free"} /></Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {lesson.course.title} • {lesson.course.musical_style?.name ?? 'Fundamentals'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {lesson.duration_minutes ? `${lesson.duration_minutes} min` : 'No duration'} •
                    {' '}{lesson.exercises?.length || 0} <AdminText text={"exercises"} /> </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/lessons/${lesson.id}`}><AdminText text={"Edit"} /></Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle><AdminText text={"No Lessons"} /></CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4"> <AdminText text={"Create lessons to fill your courses with content."} /> </p>
            <Button asChild>
              <Link href="/admin/lessons/new"><AdminText text={"Add Lesson"} /></Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
