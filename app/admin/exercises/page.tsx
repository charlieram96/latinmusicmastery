import { AdminText } from '@/components/admin/admin-text'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus } from 'lucide-react'

export default async function ExercisesPage() {
  const supabase = await createClient()

  const { data: exercises } = await supabase
    .from('exercises')
    .select(`
      *,
      lesson:lessons(title, course:courses(title)),
      attempts:exercise_attempts(id)
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2"><AdminText text={"Exercises"} /></h1>
          <p className="text-muted-foreground"> <AdminText text={"Manage quizzes and exercises"} /> </p>
        </div>
        <Button asChild>
          <Link href="/admin/exercises/new">
            <Plus className="w-4 h-4 mr-2" /> <AdminText text={"Add Exercise"} /> </Link>
        </Button>
      </div>

      {exercises && exercises.length > 0 ? (
        <div className="grid gap-4">
          {exercises.map((exercise: any) => (
            <Card key={exercise.id}>
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold">{exercise.title}</h3>
                    <Badge variant="outline" className="capitalize">
                      {exercise.question_type.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {exercise.lesson.title} • {exercise.lesson.course.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {exercise.attempts?.length || 0} <AdminText text={"attempts"} /> </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/exercises/${exercise.id}`}><AdminText text={"Edit"} /></Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle><AdminText text={"No Exercises"} /></CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4"> <AdminText text={"Create exercises to test your students' knowledge."} /> </p>
            <Button asChild>
              <Link href="/admin/exercises/new"><AdminText text={"Add Exercise"} /></Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
