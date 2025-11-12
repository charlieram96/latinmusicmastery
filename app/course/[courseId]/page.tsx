import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Lock, PlayCircle } from 'lucide-react'

interface PageProps {
  params: Promise<{
    courseId: string
  }>
}

export default async function CoursePage({ params }: PageProps) {
  const { courseId } = await params
  const supabase = await createClient()

  // Get user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get course with style and country
  const { data: course } = await supabase
    .from('courses')
    .select(`
      *,
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
    `)
    .eq('id', courseId)
    .eq('is_published', true)
    .single()

  if (!course) {
    notFound()
  }

  // Get lessons for this course
  const { data: lessons } = await supabase
    .from('lessons')
    .select('*')
    .eq('course_id', courseId)
    .order('order_index')

  // Get user's subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const hasActiveSubscription = subscription?.status === 'active'

  // Get user's progress for this course's lessons
  const lessonIds = lessons?.map(l => l.id) || []
  const { data: progressData } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', user.id)
    .in('lesson_id', lessonIds)

  // Create a map of lesson progress
  const progressMap = new Map(
    progressData?.map(p => [p.lesson_id, p]) || []
  )

  // Calculate course progress
  const totalLessons = lessons?.length || 0
  const completedLessons = progressData?.filter(p => p.completed).length || 0
  const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

  // Find next lesson to start
  const nextLesson = lessons?.find(lesson =>
    lesson.is_free || hasActiveSubscription
  )

  const style = course.musical_style
  const country = style.country

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-6 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-primary">Home</Link>
        {' / '}
        <Link href={`/courses/${country.slug}/${style.slug}`} className="hover:text-primary">
          {style.name}
        </Link>
        {' / '}
        <span className="text-foreground">{course.title}</span>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {/* Course Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">{style.name}</Badge>
              <Badge variant="secondary">{country.name}</Badge>
            </div>
            <h1 className="text-4xl font-bold mb-4">{course.title}</h1>
            {course.description && (
              <p className="text-lg text-muted-foreground">{course.description}</p>
            )}
          </div>

          {/* Progress Bar */}
          {progressData && progressData.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Your Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{completedLessons} of {totalLessons} lessons completed</span>
                    <span className="font-medium">{progressPercentage}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Preview Video */}
          {course.preview_video_url && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Course Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                  <iframe
                    src={course.preview_video_url}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Course Content */}
          <Card>
            <CardHeader>
              <CardTitle>Course Content</CardTitle>
              <CardDescription>
                {totalLessons} lesson{totalLessons !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lessons?.map((lesson, index) => {
                  const progress = progressMap.get(lesson.id)
                  const isCompleted = progress?.completed || false
                  const isLocked = !lesson.is_free && !hasActiveSubscription
                  const canAccess = lesson.is_free || hasActiveSubscription

                  return (
                    <div
                      key={lesson.id}
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        isCompleted ? 'bg-green-50 border-green-200' : 'hover:bg-muted/50'
                      } ${isLocked ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex-shrink-0">
                          {isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : isLocked ? (
                            <Lock className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <PlayCircle className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">
                            {index + 1}. {lesson.title}
                          </div>
                          {lesson.duration_minutes && (
                            <div className="text-sm text-muted-foreground">
                              {lesson.duration_minutes} min
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {lesson.is_free && (
                            <Badge variant="secondary" className="text-xs">Free</Badge>
                          )}
                          {canAccess ? (
                            <Button asChild size="sm" variant={isCompleted ? 'outline' : 'default'}>
                              <Link href={`/lessons/${lesson.id}`}>
                                {isCompleted ? 'Review' : progress ? 'Continue' : 'Start'}
                              </Link>
                            </Button>
                          ) : (
                            <Button size="sm" disabled>
                              Locked
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          {/* CTA Card */}
          <Card className="mb-6 sticky top-4">
            <CardHeader>
              {course.thumbnail_url && (
                <div className="aspect-video bg-muted rounded-lg overflow-hidden mb-4">
                  <img
                    src={course.thumbnail_url}
                    alt={course.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {!hasActiveSubscription && (
                <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <p className="text-sm text-orange-900 mb-2">
                    Subscribe to unlock all lessons
                  </p>
                  <Button asChild className="w-full">
                    <Link href="/pricing">View Plans</Link>
                  </Button>
                </div>
              )}
              {nextLesson && (
                <Button asChild className="w-full" size="lg">
                  <Link href={`/lessons/${nextLesson.id}`}>
                    {progressData && progressData.length > 0 ? 'Continue Course' : 'Start Course'}
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Teacher Card */}
          {course.teacher_name && (
            <Card>
              <CardHeader>
                <CardTitle>Instructor</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-4">
                  {course.teacher_image_url && (
                    <img
                      src={course.teacher_image_url}
                      alt={course.teacher_name}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold">{course.teacher_name}</h3>
                    {course.teacher_bio && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {course.teacher_bio}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
