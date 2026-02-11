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
  Music,
  Globe,
  Disc3,
  GraduationCap,
  Lightbulb,
  ListChecks,
  Award,
  Headphones
} from 'lucide-react'
import { EnterCourseModeButton } from '@/components/dashboard/enter-course-mode-button'

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

  // Get modules for this course
  const { data: modules } = await supabase
    .from('course_modules')
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

  // Get user's progress for this course's modules
  const moduleIds = modules?.map(m => m.id) || []
  const { data: progressData } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', user.id)
    .in('module_id', moduleIds)

  // Create a map of module progress
  const progressMap = new Map(
    progressData?.map(p => [p.module_id, p]) || []
  )

  // Calculate course progress
  const totalLessons = modules?.length || 0
  const completedLessons = progressData?.filter(p => p.completed).length || 0
  const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

  // Find next module to continue
  const nextModule = modules?.find(mod => {
    const progress = progressMap.get(mod.id)
    return (mod.is_free || isStudent) && (!progress || !progress.completed)
  }) || modules?.[0]

  const style = course.musical_style
  const country = style?.country
  const teacher = course.teacher

  // Calculate durations (video_duration_seconds -> minutes)
  const totalDuration = modules?.reduce((acc, m) => acc + Math.round((m.video_duration_seconds || 0) / 60), 0) || 0
  const completedDuration = modules
    ?.filter(m => progressMap.get(m.id)?.completed)
    .reduce((acc, m) => acc + Math.round((m.video_duration_seconds || 0) / 60), 0) || 0
  const remainingDuration = totalDuration - completedDuration

  // Difficulty config
  const difficultyConfig = {
    beginner: { label: 'Beginner', color: 'text-green-500', bg: 'bg-green-500/10' },
    intermediate: { label: 'Intermediate', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    advanced: { label: 'Advanced', color: 'text-red-500', bg: 'bg-red-500/10' },
  }
  const difficulty = difficultyConfig[course.difficulty as keyof typeof difficultyConfig] || difficultyConfig.beginner

  // Determine if course has been started
  const hasStarted = progressData && progressData.length > 0

  // Color schemes for badges
  const getStyleColor = () => 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
  const getInstrumentColor = () => 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
  const getCountryColor = () => 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'

  return (
    <>
      {/* Hero Section - extends behind header */}
      <div className="relative -mx-6 -mt-[calc(50px+1.5rem)] mb-8 overflow-hidden">
        {/* Background Image */}
        {course.thumbnail_url && (
          <img
            src={course.thumbnail_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />

        {/* Content */}
        <div className="relative px-6 pt-[calc(50px+2rem)] pb-10 min-h-[420px] flex flex-col justify-end">
          {/* Back Button */}
          <div className="absolute top-[calc(50px+1rem)] left-6">
            <Button size="sm" variant="outline" asChild className="gap-2 bg-background/80 backdrop-blur-sm">
              <Link href="/dashboard/courses">
                <ChevronLeft className="h-4 w-4" />
                Back to Courses
              </Link>
            </Button>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {style && (
              <Badge variant="outline" className={`${getStyleColor()} bg-background/80 backdrop-blur-sm`}>
                <Music className="h-3 w-3 mr-1" />
                {style.name}
              </Badge>
            )}
            {teacher?.instrument && (
              <Badge variant="outline" className={`${getInstrumentColor()} bg-background/80 backdrop-blur-sm`}>
                <Disc3 className="h-3 w-3 mr-1" />
                {teacher.instrument}
              </Badge>
            )}
            {country && (
              <Badge variant="outline" className={`${getCountryColor()} bg-background/80 backdrop-blur-sm`}>
                <Globe className="h-3 w-3 mr-1" />
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

          {/* Title & Description */}
          <h1 className="text-3xl md:text-4xl font-bold font-heading mb-3 max-w-3xl">
            {course.title}
          </h1>
          {course.description && (
            <p className="text-lg text-muted-foreground max-w-2xl mb-6">
              {course.description}
            </p>
          )}

          {/* Teacher Info + CTA Row */}
          <div className="flex flex-wrap items-center justify-between gap-6">
            {/* Teacher Info */}
            {teacher && (
              <div className="flex items-center gap-4">
                <div className="relative">
                  {teacher.image_url ? (
                    <img
                      src={teacher.image_url}
                      alt={teacher.name}
                      className="w-14 h-14 rounded-full object-cover ring-2 ring-background"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center ring-2 ring-background">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Instructor</p>
                  <p className="font-semibold">{teacher.name}</p>
                  {teacher.instrument && (
                    <p className="text-sm text-muted-foreground">{teacher.instrument}</p>
                  )}
                </div>
              </div>
            )}

            {/* Primary CTA Button */}
            {nextModule ? (
              <EnterCourseModeButton
                moduleId={nextModule.id}
                courseId={course.id}
                courseTitle={course.title}
                isNewCourse={!hasStarted}
                size="lg"
                className="shadow-lg"
              >
                <PlayCircle className="h-5 w-5 mr-2" />
                {hasStarted ? 'Continue Course' : 'Begin Course'}
              </EnterCourseModeButton>
            ) : (
              <Button size="lg" disabled className="shadow-lg">
                <Clock className="h-5 w-5 mr-2" />
                Coming Soon
              </Button>
            )}
          </div>
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
          {/* What You'll Learn */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                What You'll Learn
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">Master authentic {style?.name || 'Latin'} rhythms and patterns used by professional musicians</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">Develop proper technique and timing essential for this style</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">Understand the cultural and historical context of the music</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">Learn to play along with backing tracks and full band arrangements</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">Build a repertoire of essential patterns and variations</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">Gain confidence to perform in ensemble and jam sessions</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preview Video */}
          {course.preview_video_url && (
            <Card className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <PlayCircle className="h-5 w-5 text-primary" />
                  Course Preview
                </CardTitle>
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
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ListChecks className="h-5 w-5 text-blue-500" />
                    Course Content
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {totalLessons} lesson{totalLessons !== 1 ? 's' : ''} • {formatDuration(totalDuration)} total length
                  </CardDescription>
                </div>
                {hasStarted && (
                  <Badge variant="secondary" className="gap-1">
                    <Target className="h-3 w-3" />
                    {progressPercentage}% Complete
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground mb-4">
                Each lesson includes interactive notation, video demonstrations, and practice exercises.
                Work through the content at your own pace and track your progress as you master each concept.
              </p>
              <div className="space-y-1 border rounded-lg overflow-hidden">
                {modules?.map((mod, index) => {
                  const progress = progressMap.get(mod.id)
                  const isCompleted = progress?.completed || false
                  const isLocked = !mod.is_free && !isStudent
                  const canAccess = mod.is_free || isStudent
                  const isNext = nextModule?.id === mod.id
                  const durationMin = mod.video_duration_seconds ? Math.round(mod.video_duration_seconds / 60) : null

                  return (
                    <div
                      key={mod.id}
                      className={`flex items-center gap-4 p-4 transition-colors border-b last:border-b-0 ${
                        isCompleted
                          ? 'bg-green-500/5'
                          : isNext
                            ? 'bg-primary/5'
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
                          {mod.title}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {durationMin ? `${durationMin} min` : 'TBD'}
                          {isNext && !isCompleted && (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0 ml-2">Up Next</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {mod.is_free && !isStudent && (
                          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">Free Preview</Badge>
                        )}
                        {canAccess ? (
                          <Button asChild size="sm" variant={isNext ? 'default' : 'ghost'}>
                            <Link href={`/modules/${mod.id}`}>
                              {isCompleted ? 'Review' : isNext ? 'Start' : 'Preview'}
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

          {/* Requirements */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-purple-500" />
                Requirements
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <Headphones className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span className="text-sm">Access to your instrument ({teacher?.instrument || 'as specified in course title'})</span>
                </li>
                <li className="flex items-start gap-3">
                  <Music className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span className="text-sm">Basic familiarity with your instrument (beginners welcome for beginner-level courses)</span>
                </li>
                <li className="flex items-start gap-3">
                  <Target className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span className="text-sm">Dedication to practice regularly and apply what you learn</span>
                </li>
                <li className="flex items-start gap-3">
                  <Disc3 className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span className="text-sm">Optional: Metronome or click track for practice sessions</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* CTA Card */}
          <Card className="sticky top-6 border-2">
            <CardContent className="p-5 space-y-5">
              {/* Main CTA */}
              {nextModule ? (
                <EnterCourseModeButton
                  moduleId={nextModule.id}
                  courseId={course.id}
                  courseTitle={course.title}
                  isNewCourse={!hasStarted}
                  className="w-full"
                  size="lg"
                >
                  <PlayCircle className="h-5 w-5 mr-2" />
                  {hasStarted ? 'Continue Course' : 'Begin Course'}
                </EnterCourseModeButton>
              ) : (
                <Button size="lg" disabled className="w-full">
                  <Clock className="h-5 w-5 mr-2" />
                  Coming Soon
                </Button>
              )}

              {/* Subscription Notice */}
              {!isStudent && (
                <div className="p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
                  <p className="text-sm text-orange-600 dark:text-orange-400 mb-2 font-medium">
                    Subscribe to unlock all lessons
                  </p>
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/dashboard/subscription">View Plans</Link>
                  </Button>
                </div>
              )}

              {/* Course Highlights */}
              <div className="pt-4 border-t space-y-4">
                <h4 className="font-medium text-sm">This course includes:</h4>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-3">
                    <BookOpen className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    <span>{totalLessons} comprehensive lessons</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-orange-500 flex-shrink-0" />
                    <span>{formatDuration(totalDuration)} of content</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Music className="h-4 w-4 text-purple-500 flex-shrink-0" />
                    <span>Interactive sheet music & tabs</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Headphones className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>Practice backing tracks</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Award className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                    <span>Certificate of completion</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <BarChart3 className={`h-4 w-4 ${difficulty.color} flex-shrink-0`} />
                    <span className="capitalize">{course.difficulty || 'All levels'} difficulty</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* About Teacher */}
          {teacher && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  About the Instructor
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-3 mb-3">
                  {teacher.image_url ? (
                    <img
                      src={teacher.image_url}
                      alt={teacher.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold">{teacher.name}</p>
                    {teacher.instrument && (
                      <p className="text-sm text-muted-foreground">{teacher.instrument}</p>
                    )}
                  </div>
                </div>
                {teacher.bio ? (
                  <p className="text-sm text-muted-foreground">
                    {teacher.bio}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Expert instructor specializing in {style?.name || 'Latin music'} with years of professional performance and teaching experience.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Course Tags */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Course Details</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                {style && (
                  <Badge variant="outline" className={getStyleColor()}>
                    <Music className="h-3 w-3 mr-1" />
                    {style.name}
                  </Badge>
                )}
                {teacher?.instrument && (
                  <Badge variant="outline" className={getInstrumentColor()}>
                    <Disc3 className="h-3 w-3 mr-1" />
                    {teacher.instrument}
                  </Badge>
                )}
                {country && (
                  <Badge variant="outline" className={getCountryColor()}>
                    <Globe className="h-3 w-3 mr-1" />
                    {country.name}
                  </Badge>
                )}
                {course.difficulty && (
                  <Badge variant="outline" className={`capitalize ${difficulty.color} ${difficulty.bg}`}>
                    <BarChart3 className="h-3 w-3 mr-1" />
                    {difficulty.label}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
