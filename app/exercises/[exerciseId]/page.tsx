import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { ExerciseQuiz } from '@/components/exercise-quiz'

interface PageProps {
  params: Promise<{
    exerciseId: string
  }>
}

export default async function ExercisePage({ params }: PageProps) {
  const { exerciseId } = await params
  const supabase = await createClient()

  // Get user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get exercise with lesson and course details
  const { data: exercise } = await supabase
    .from('exercises')
    .select(`
      *,
      lesson:lessons(
        id,
        title,
        course_id,
        course:courses(
          id,
          title
        )
      )
    `)
    .eq('id', exerciseId)
    .single()

  if (!exercise) {
    notFound()
  }

  // Get user's previous attempts
  const { data: attempts } = await supabase
    .from('exercise_attempts')
    .select('*')
    .eq('user_id', user.id)
    .eq('exercise_id', exerciseId)
    .order('created_at', { ascending: false })

  const lesson = exercise.lesson
  const course = lesson.course

  // Calculate success rate
  const totalAttempts = attempts?.length || 0
  const correctAttempts = attempts?.filter(a => a.is_correct).length || 0
  const successRate = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm">
              <Link href={`/lessons/${lesson.id}`}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to Lesson
              </Link>
            </Button>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-muted-foreground truncate">
                {course.title} • {lesson.title}
              </div>
              <div className="font-medium truncate">
                {exercise.title}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="space-y-6">
          {/* Exercise Header */}
          <Card>
            <CardHeader>
              <CardTitle>{exercise.title}</CardTitle>
              {exercise.description && (
                <CardDescription>{exercise.description}</CardDescription>
              )}
            </CardHeader>
            {totalAttempts > 0 && (
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Attempts: {totalAttempts}</span>
                  <span>•</span>
                  <span>Success Rate: {successRate}%</span>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Quiz Component */}
          <ExerciseQuiz
            exercise={{
              id: exercise.id,
              question: exercise.question,
              question_type: exercise.question_type,
              options: exercise.options as string[] | null,
              correct_answer: exercise.correct_answer,
              explanation: exercise.explanation,
            }}
            userId={user.id}
          />

          {/* Previous Attempts */}
          {attempts && attempts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Your Attempts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {attempts.slice(0, 5).map((attempt, index) => (
                    <div
                      key={attempt.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        attempt.is_correct ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          {attempt.is_correct ? '✓ Correct' : '✗ Incorrect'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(attempt.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Your answer: {attempt.user_answer}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
