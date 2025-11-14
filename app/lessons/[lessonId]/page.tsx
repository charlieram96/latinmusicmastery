import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight, CheckCircle2, PlayCircle, Lock } from 'lucide-react'
import { LessonCompleteButton } from '@/components/lesson-complete-button'

interface PageProps {
  params: Promise<{
    lessonId: string
  }>
}

export default async function LessonPage({ params }: PageProps) {
  const { lessonId } = await params
  const supabase = await createClient()

  // Get user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get lesson with course details
  const { data: lesson } = await supabase
    .from('lessons')
    .select(`
      *,
      course:courses(
        id,
        title,
        musical_style:musical_styles(
          id,
          name,
          slug,
          country:countries(
            id,
            name,
            slug
          )
        )
      )
    `)
    .eq('id', lessonId)
    .single()

  if (!lesson) {
    notFound()
  }

  // Get user profile to check rank
  const { data: profile } = await supabase
    .from('profiles')
    .select('rank, is_admin')
    .eq('id', user.id)
    .single()

  const isStudent = profile?.rank === 'student' || profile?.is_admin

  // Check if user has access
  if (!lesson.is_free && !isStudent) {
    redirect(`/course/${lesson.course_id}`)
  }

  // Get all lessons in this course for navigation
  const { data: courseLessons } = await supabase
    .from('lessons')
    .select('id, title, order_index, is_free')
    .eq('course_id', lesson.course_id)
    .order('order_index')

  // Get user progress for all lessons in this course
  const lessonIds = courseLessons?.map(l => l.id) || []
  const { data: progressData } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', user.id)
    .in('lesson_id', lessonIds)

  const progressMap = new Map(
    progressData?.map(p => [p.lesson_id, p]) || []
  )

  // Get current lesson progress
  const currentProgress = progressMap.get(lessonId)

  // Find previous and next lessons
  const currentIndex = courseLessons?.findIndex(l => l.id === lessonId) || 0
  const previousLesson = currentIndex > 0 ? courseLessons?.[currentIndex - 1] : null
  const nextLesson = currentIndex < (courseLessons?.length || 0) - 1 ? courseLessons?.[currentIndex + 1] : null

  // Check if next lesson is accessible
  const canAccessNext = nextLesson && (nextLesson.is_free || isStudent)

  // Get exercises for this lesson
  const { data: exercises } = await supabase
    .from('exercises')
    .select('id, title')
    .eq('lesson_id', lessonId)
    .order('order_index')

  const course = lesson.course
  const style = course.musical_style
  const country = style.country

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <Button asChild variant="ghost" size="sm">
                <Link href={`/course/${course.id}`}>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back to Course
                </Link>
              </Button>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-muted-foreground truncate">
                  {course.title}
                </div>
                <div className="font-medium truncate">
                  {lesson.title}
                </div>
              </div>
            </div>
            {!currentProgress?.completed && (
              <LessonCompleteButton lessonId={lessonId} userId={user.id} />
            )}
            {currentProgress?.completed && (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="w-4 h-4" />
                Completed
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Soundslice Embed */}
            {lesson.soundslice_embed_url && (
              <Card>
                <CardContent className="p-0">
                  <div className="aspect-video bg-black rounded-lg overflow-hidden">
                    <iframe
                      src={lesson.soundslice_embed_url}
                      className="w-full h-full"
                      allow="autoplay; fullscreen"
                      allowFullScreen
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Lesson Description */}
            {lesson.description && (
              <Card>
                <CardHeader>
                  <CardTitle>About This Lesson</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {lesson.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Exercises */}
            {exercises && exercises.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Practice Exercises</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {exercises.map((exercise) => (
                      <div key={exercise.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                        <span className="font-medium">{exercise.title}</span>
                        <Button asChild size="sm">
                          <Link href={`/exercises/${exercise.id}`}>
                            Start Exercise
                          </Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between gap-4">
              {previousLesson ? (
                <Button asChild variant="outline" className="flex-1">
                  <Link href={`/lessons/${previousLesson.id}`}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Previous Lesson
                  </Link>
                </Button>
              ) : (
                <div className="flex-1" />
              )}

              {nextLesson && (
                <>
                  {canAccessNext ? (
                    <Button asChild className="flex-1">
                      <Link href={`/lessons/${nextLesson.id}`}>
                        Next Lesson
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Link>
                    </Button>
                  ) : (
                    <Button disabled className="flex-1">
                      <Lock className="w-4 h-4 mr-2" />
                      Next Lesson (Locked)
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Sidebar - Course Lessons */}
          <div className="lg:col-span-1">
            <Card className="sticky top-20">
              <CardHeader>
                <CardTitle>Course Lessons</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 max-h-[600px] overflow-y-auto">
                  {courseLessons?.map((courseLesson, index) => {
                    const progress = progressMap.get(courseLesson.id)
                    const isCompleted = progress?.completed || false
                    const isCurrent = courseLesson.id === lessonId
                    const isLocked = !courseLesson.is_free && !isStudent

                    return (
                      <Link
                        key={courseLesson.id}
                        href={isLocked ? '#' : `/lessons/${courseLesson.id}`}
                        className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                          isCurrent
                            ? 'bg-primary text-primary-foreground'
                            : isLocked
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:bg-muted'
                        }`}
                        onClick={(e) => isLocked && e.preventDefault()}
                      >
                        <div className="flex-shrink-0">
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : isLocked ? (
                            <Lock className="w-4 h-4" />
                          ) : (
                            <PlayCircle className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium truncate ${isCurrent ? '' : ''}`}>
                            {index + 1}. {courseLesson.title}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
