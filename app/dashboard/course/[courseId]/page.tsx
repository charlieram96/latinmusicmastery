import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCourseStructureForStudent } from '@/app/actions/course-student'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
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

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const remaining = mins % 60
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`
}

export default async function CoursePage({ params }: PageProps) {
  const { courseId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Get course with style, country, and teacher
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(courseId)

  let courseQuery = supabase
    .from('courses')
    .select(`
      *,
      musical_style:musical_styles(
        id, name, slug,
        country:countries(id, name, slug)
      ),
      teacher:teachers(id, name, instrument, image_url, bio)
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

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('rank, is_admin')
    .eq('id', user.id)
    .single()

  const isStudent = profile?.rank === 'student' || profile?.is_admin

  // Get course structure with progress
  const structureResult = await getCourseStructureForStudent(course.id)
  const structure = structureResult.data

  const totalItems = structure?.totalItems || 0
  const completedItems = structure?.completedItems || 0
  const progressPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0
  const totalDurationMinutes = Math.round((structure?.totalDurationSeconds || 0) / 60)
  const completedDurationMinutes = Math.round((structure?.completedDurationSeconds || 0) / 60)
  const remainingDuration = totalDurationMinutes - completedDurationMinutes
  const nextClassId = structure?.nextClassId || null
  const sections = structure?.sections || []
  const hasStarted = completedItems > 0

  const style = course.musical_style
  const country = style?.country
  const teacher = course.teacher

  const difficultyConfig = {
    beginner: { label: 'Beginner', color: 'text-green-500', bg: 'bg-green-500/10' },
    intermediate: { label: 'Intermediate', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    advanced: { label: 'Advanced', color: 'text-red-500', bg: 'bg-red-500/10' },
  }
  const difficulty = difficultyConfig[course.difficulty as keyof typeof difficultyConfig] || difficultyConfig.beginner

  const getStyleColor = () => 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
  const getInstrumentColor = () => 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
  const getCountryColor = () => 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'

  const nextClassHref = nextClassId ? `/dashboard/course/${courseId}/class/${nextClassId}` : undefined

  return (
    <>
      {/* Hero Section */}
      <div className="relative -mx-6 -mt-[calc(50px+1.5rem)] mb-8 overflow-hidden">
        {course.thumbnail_url && (
          <img src={course.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />

        <div className="relative px-6 pt-[calc(50px+2rem)] pb-10 min-h-[420px] flex flex-col justify-end">
          <div className="absolute top-[calc(50px+1rem)] left-6">
            <Button size="sm" variant="outline" asChild className="gap-2 bg-background/80 backdrop-blur-sm">
              <Link href="/dashboard/courses">
                <ChevronLeft className="h-4 w-4" />
                Back to Courses
              </Link>
            </Button>
          </div>

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
              <Badge variant="outline" className={`capitalize bg-background/80 backdrop-blur-sm ${difficulty.color} border-current/30`}>
                {difficulty.label}
              </Badge>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-bold font-heading mb-3 max-w-3xl">{course.title}</h1>
          {course.description && (
            <p className="text-lg text-muted-foreground max-w-2xl mb-6">{course.description}</p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-6">
            {teacher && (
              <div className="flex items-center gap-4">
                <div className="relative">
                  {teacher.image_url ? (
                    <img src={teacher.image_url} alt={teacher.name} className="w-14 h-14 rounded-full object-cover ring-2 ring-background" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center ring-2 ring-background">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Instructor</p>
                  <p className="font-semibold">{teacher.name}</p>
                  {teacher.instrument && <p className="text-sm text-muted-foreground">{teacher.instrument}</p>}
                </div>
              </div>
            )}

            {nextClassHref ? (
              <EnterCourseModeButton
                courseId={course.id}
                href={nextClassHref}
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

        <Card className="bg-card/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completedItems}/{totalItems}</p>
              <p className="text-xs text-muted-foreground">Items</p>
            </div>
          </CardContent>
        </Card>

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

      {/* Progress Bar */}
      <Card className="mb-8">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Your Progress</span>
            <span className="text-sm text-muted-foreground">
              {completedItems} of {totalItems} items completed
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

          {/* Course Content - Accordion */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ListChecks className="h-5 w-5 text-blue-500" />
                    Course Content
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {sections.length} section{sections.length !== 1 ? 's' : ''} • {totalItems} item{totalItems !== 1 ? 's' : ''} • {formatDuration(totalDurationMinutes)} total
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
              <Accordion type="multiple" defaultValue={sections.map((s: any) => s.id)} className="w-full">
                {sections.map((section: any) => {
                  const sectionProgress = section.totalItems > 0
                    ? Math.round((section.completedItems / section.totalItems) * 100)
                    : 0

                  return (
                    <AccordionItem key={section.id} value={section.id}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3 text-left flex-1">
                          {/* Progress Ring */}
                          <div className="relative h-8 w-8 flex-shrink-0">
                            <svg className="h-8 w-8 -rotate-90" viewBox="0 0 36 36">
                              <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-muted" strokeWidth="2" />
                              <circle
                                cx="18" cy="18" r="15.5" fill="none"
                                className={sectionProgress === 100 ? 'text-green-500' : 'text-primary'}
                                strokeWidth="2"
                                strokeDasharray={`${sectionProgress} 100`}
                                strokeLinecap="round"
                                stroke="currentColor"
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              {sectionProgress === 100 ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                <span className="text-[10px] font-bold">{sectionProgress}%</span>
                              )}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{section.title}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {section.classes.length} class{section.classes.length !== 1 ? 'es' : ''}
                            </span>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-1 pl-11">
                          {section.classes.map((cls: any) => {
                            const isCompleted = cls.completedItems === cls.totalItems && cls.totalItems > 0
                            const isLocked = !isStudent && !hasStarted
                            const isNext = nextClassId === cls.id

                            return (
                              <div
                                key={cls.id}
                                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                                  isCompleted ? 'bg-green-500/5' : isNext ? 'bg-primary/5' : 'hover:bg-muted/50'
                                }`}
                              >
                                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                                  isCompleted ? 'bg-green-500/20' : isNext ? 'bg-primary/20' : 'bg-muted'
                                }`}>
                                  {isCompleted ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                  ) : isLocked ? (
                                    <Lock className="w-3 h-3 text-muted-foreground" />
                                  ) : (
                                    <span className={`text-xs font-semibold ${isNext ? 'text-primary' : ''}`}>
                                      {cls.totalItems}
                                    </span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className={`font-medium text-sm ${isNext ? 'text-primary' : ''}`}>
                                    {cls.title}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    {cls.totalItems} item{cls.totalItems !== 1 ? 's' : ''}
                                    {cls.completedItems > 0 && ` • ${cls.completedItems} done`}
                                    {isNext && !isCompleted && (
                                      <Badge variant="default" className="text-[10px] px-1.5 py-0 ml-1">Up Next</Badge>
                                    )}
                                  </div>
                                </div>
                                <Button asChild size="sm" variant={isNext ? 'default' : 'ghost'}>
                                  <Link href={`/dashboard/course/${courseId}/class/${cls.id}`}>
                                    {isCompleted ? 'Review' : isNext ? 'Start' : 'View'}
                                  </Link>
                                </Button>
                              </div>
                            )
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )
                })}
              </Accordion>
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
          <Card className="sticky top-6 border-2">
            <CardContent className="p-5 space-y-5">
              {nextClassHref ? (
                <EnterCourseModeButton
                  courseId={course.id}
                  href={nextClassHref}
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

              <div className="pt-4 border-t space-y-4">
                <h4 className="font-medium text-sm">This course includes:</h4>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-3">
                    <BookOpen className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    <span>{totalItems} learning items</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-orange-500 flex-shrink-0" />
                    <span>{formatDuration(totalDurationMinutes)} of content</span>
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
                    <img src={teacher.image_url} alt={teacher.name} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold">{teacher.name}</p>
                    {teacher.instrument && <p className="text-sm text-muted-foreground">{teacher.instrument}</p>}
                  </div>
                </div>
                {teacher.bio ? (
                  <p className="text-sm text-muted-foreground">{teacher.bio}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Expert instructor specializing in {style?.name || 'Latin music'} with years of professional performance and teaching experience.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Course Details</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                {style && (
                  <Badge variant="outline" className={getStyleColor()}>
                    <Music className="h-3 w-3 mr-1" />{style.name}
                  </Badge>
                )}
                {teacher?.instrument && (
                  <Badge variant="outline" className={getInstrumentColor()}>
                    <Disc3 className="h-3 w-3 mr-1" />{teacher.instrument}
                  </Badge>
                )}
                {country && (
                  <Badge variant="outline" className={getCountryColor()}>
                    <Globe className="h-3 w-3 mr-1" />{country.name}
                  </Badge>
                )}
                {course.difficulty && (
                  <Badge variant="outline" className={`capitalize ${difficulty.color} ${difficulty.bg}`}>
                    <BarChart3 className="h-3 w-3 mr-1" />{difficulty.label}
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
