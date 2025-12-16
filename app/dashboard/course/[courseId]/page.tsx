import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  CheckCircle2,
  Lock,
  PlayCircle,
  ChevronLeft,
  Clock,
  BookOpen,
  User,
  BarChart3,
  Target,
  Music
} from 'lucide-react'
import { CourseModeActivator } from '@/components/dashboard/course-mode-activator'

interface PageProps {
  params: Promise<{
    courseId: string
  }>
}

// Format duration nicely
function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const remaining = mins % 60
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`
}

export default async function CoursePage({ params }: PageProps) {
  const { courseId } = await params
  const supabase = await createClient()

  // Get user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get course with style, country, and teacher (try by ID first, then by slug)
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(courseId)

  let courseQuery = supabase
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
      ),
      teacher:teachers(
        id,
        name,
        instrument,
        image_url,
        bio
      )
    `)
    .eq('is_published', true)

  if (isUUID) {
    courseQuery = courseQuery.eq('id', courseId)
  } else {
    courseQuery = courseQuery.eq('slug', courseId)
  }

  const { data: course } = await courseQuery.single()

  if (!course) {
    notFound()
  }

  // Get lessons for this course
  const { data: lessons } = await supabase
    .from('lessons')
    .select('*')
    .eq('course_id', course.id)
    .order('order_index')

  // Get user profile to check rank
  const { data: profile } = await supabase
    .from('profiles')
    .select('rank, is_admin')
    .eq('id', user.id)
    .single()

  const isStudent = profile?.rank === 'student' || profile?.is_admin

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

  // Find next lesson to continue
  const nextLesson = lessons?.find(lesson => {
    const progress = progressMap.get(lesson.id)
    return (lesson.is_free || isStudent) && (!progress || !progress.completed)
  }) || lessons?.[0]

  const style = course.musical_style
  const country = style?.country
  const teacher = course.teacher

  // Calculate durations
  const totalDuration = lessons?.reduce((acc, l) => acc + (l.duration_minutes || 0), 0) || 0
  const completedDuration = lessons
    ?.filter(l => progressMap.get(l.id)?.completed)
    .reduce((acc, l) => acc + (l.duration_minutes || 0), 0) || 0
  const remainingDuration = totalDuration - completedDuration

  // Difficulty config
  const difficultyConfig = {
    beginner: { label: 'Beginner', color: 'text-green-500', bg: 'bg-green-500/10' },
    intermediate: { label: 'Intermediate', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    advanced: { label: 'Advanced', color: 'text-red-500', bg: 'bg-red-500/10' },
  }
  const difficulty = difficultyConfig[course.difficulty as keyof typeof difficultyConfig] || difficultyConfig.beginner

  return (
    <>
      <CourseModeActivator />

      {/* Hero Section */}
      <div className="relative -mx-6 -mt-6 mb-8 overflow-hidden">
        {/* Background Image */}
        {course.thumbnail_url && (
          <img
            src={course.thumbnail_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-background/60" />

        {/* Content */}
        <div className="relative px-6 pt-6 pb-10 min-h-[320px] flex flex-col justify-end">
          {/* Back Button */}
          <div className="absolute top-6 right-6">
            <Button size="sm" asChild className="gap-2">
              <Link href="/dashboard/courses">
                <ChevronLeft className="h-4 w-4" />
                Back to Courses
              </Link>
            </Button>
          </div>

          {/* Title & Description */}
          <h1 className="text-3xl md:text-4xl font-bold font-heading mb-3 max-w-3xl">
            {course.title}
          </h1>
          {course.description && (
            <p className="text-lg text-muted-foreground max-w-2xl mb-4">
              {course.description}
            </p>
          )}

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {style && (
              <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                <Music className="h-3 w-3 mr-1" />
                {style.name}
              </Badge>
            )}
            {country && (
              <Badge variant="outline" className="bg-background/80 backdrop-blur-sm border-border/50">
                {country.name}
              </Badge>
            )}
            {course.difficulty && (
              <Badge
                variant="outline"
                className={`capitalize bg-background/80 backdrop-blur-sm ${difficulty.color} border-current/30`}
              >
                {difficulty.label}
              </Badge>
            )}
          </div>

          {/* Teacher Info - Prominent */}
          {teacher && (
            <div className="flex items-center gap-4">
              <div className="relative">
                {teacher.image_url ? (
                  <img
                    src={teacher.image_url}
                    alt={teacher.name}
                    className="w-16 h-16 rounded-full object-cover ring-2 ring-background"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center ring-2 ring-background">
                    <User className="w-7 h-7 text-primary" />
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taught by</p>
                <p className="font-semibold text-lg">{teacher.name}</p>
                {teacher.instrument && (
                  <p className="text-sm text-muted-foreground">{teacher.instrument}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {/* Progress */}
        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${progressPercentage > 0 ? 'bg-primary/20' : 'bg-muted'}`}>
              <Target className={`w-6 h-6 ${progressPercentage > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="text-2xl font-bold">{progressPercentage}%</p>
              <p className="text-xs text-muted-foreground">Complete</p>
            </div>
          </CardContent>
        </Card>

        {/* Lessons */}
        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completedLessons}/{totalLessons}</p>
              <p className="text-xs text-muted-foreground">Lessons</p>
            </div>
          </CardContent>
        </Card>

        {/* Time Remaining */}
        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
              <Clock className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatDuration(remainingDuration)}</p>
              <p className="text-xs text-muted-foreground">Remaining</p>
            </div>
          </CardContent>
        </Card>

        {/* Difficulty */}
        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full ${difficulty.bg} flex items-center justify-center`}>
              <BarChart3 className={`w-6 h-6 ${difficulty.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold capitalize">{course.difficulty || 'All'}</p>
              <p className="text-xs text-muted-foreground">Level</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar - Full Width */}
      <Card className="mb-8">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Your Progress</span>
            <span className="text-sm text-muted-foreground">
              {completedLessons} of {totalLessons} lessons completed
            </span>
          </div>
          <Progress value={progressPercentage} className="h-3" />
          {progressPercentage === 100 && (
            <p className="text-sm text-green-500 mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              Course completed! Great job!
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Preview Video */}
          {course.preview_video_url && (
            <Card className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Course Preview</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
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
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Course Content</CardTitle>
              <CardDescription>
                {totalLessons} lesson{totalLessons !== 1 ? 's' : ''} • {formatDuration(totalDuration)} total
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1">
                {lessons?.map((lesson, index) => {
                  const progress = progressMap.get(lesson.id)
                  const isCompleted = progress?.completed || false
                  const isLocked = !lesson.is_free && !isStudent
                  const canAccess = lesson.is_free || isStudent
                  const isNext = nextLesson?.id === lesson.id

                  return (
                    <div
                      key={lesson.id}
                      className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
                        isCompleted
                          ? 'bg-green-500/10'
                          : isNext
                            ? 'bg-primary/10 ring-1 ring-primary/20'
                            : 'hover:bg-muted/50'
                      } ${isLocked ? 'opacity-60' : ''}`}
                    >
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                        isCompleted ? 'bg-green-500/20' : isNext ? 'bg-primary/20' : 'bg-muted'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : isLocked ? (
                          <Lock className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <span className={`text-sm font-semibold ${isNext ? 'text-primary' : ''}`}>{index + 1}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium text-sm ${isNext ? 'text-primary' : ''}`}>
                          {lesson.title}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {lesson.duration_minutes && (
                            <span>{lesson.duration_minutes} min</span>
                          )}
                          {isNext && !isCompleted && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Up Next</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {lesson.is_free && !isStudent && (
                          <Badge variant="secondary" className="text-xs">Free</Badge>
                        )}
                        {canAccess ? (
                          <Button asChild size="sm" variant={isNext ? 'default' : 'ghost'}>
                            <Link href={`/lessons/${lesson.id}`}>
                              {isCompleted ? 'Review' : isNext ? 'Continue' : 'Start'}
                            </Link>
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" disabled>
                            <Lock className="h-3 w-3 mr-1" />
                            Locked
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* CTA Card */}
          <Card className="sticky top-6">
            <CardContent className="p-5 space-y-4">
              {!isStudent && (
                <div className="p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
                  <p className="text-sm text-orange-500 mb-2 font-medium">
                    Subscribe to unlock all lessons
                  </p>
                  <Button asChild className="w-full">
                    <Link href="/dashboard/subscription">View Plans</Link>
                  </Button>
                </div>
              )}
              {nextLesson && (
                <Button asChild className="w-full" size="lg">
                  <Link href={`/lessons/${nextLesson.id}`}>
                    <PlayCircle className="h-5 w-5 mr-2" />
                    {progressData && progressData.length > 0 ? 'Continue Learning' : 'Start Course'}
                  </Link>
                </Button>
              )}

              {/* Quick Stats in Sidebar */}
              <div className="pt-4 border-t space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Duration</span>
                  <span className="font-medium">{formatDuration(totalDuration)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Lessons</span>
                  <span className="font-medium">{totalLessons}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Level</span>
                  <span className={`font-medium capitalize ${difficulty.color}`}>{course.difficulty || 'All Levels'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* About Teacher */}
          {teacher && teacher.bio && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">About the Instructor</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground">
                  {teacher.bio}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
