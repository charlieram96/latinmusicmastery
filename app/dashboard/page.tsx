import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import Link from 'next/link'
import {
  Play,
  BookOpen,
  Award,
  Flame,
  ArrowRight,
  Trophy,
  Users,
  Video,
  Sparkles
} from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  // Fetch user's subscription status
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Fetch user progress with lesson and course details
  const { data: progressData } = await supabase
    .from('user_progress')
    .select(`
      *,
      lesson:lessons(
        id,
        title,
        order_index,
        course:courses(
          id,
          title,
          slug,
          thumbnail_url,
          lessons(id)
        )
      )
    `)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  // Calculate statistics
  const { count: totalLessonsCompleted } = await supabase
    .from('user_progress')
    .select('lesson_id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('completed', true)

  // Get user achievements count
  const { count: achievementsCount } = await supabase
    .from('user_achievements')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // Calculate streak (simplified - count consecutive days)
  const { data: recentActivity } = await supabase
    .from('user_progress')
    .select('updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  let streak = 0
  if (recentActivity && recentActivity.length > 0) {
    const uniqueDates = new Set<string>()
    recentActivity.forEach((activity) => {
      if (activity.updated_at) {
        const date = new Date(activity.updated_at).toISOString().split('T')[0]
        uniqueDates.add(date)
      }
    })
    const sortedDates = Array.from(uniqueDates).sort().reverse()
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    if (sortedDates[0] === today || sortedDates[0] === yesterday) {
      let currentDate = new Date(sortedDates[0])
      for (const dateStr of sortedDates) {
        const date = new Date(dateStr)
        const expectedDate = new Date(currentDate)
        expectedDate.setDate(expectedDate.getDate() - streak)
        if (date.toISOString().split('T')[0] === expectedDate.toISOString().split('T')[0]) {
          streak++
        } else {
          break
        }
      }
    }
  }

  // Get continue learning (most recent incomplete lesson)
  const continueLesson = progressData
    ?.filter((p: any) => !p.completed && p.lesson?.course)
    .slice(0, 1)[0]

  // Get my courses with progress
  const courseProgress = new Map<string, { total: number; completed: number; course: any }>()
  progressData?.forEach((p: any) => {
    if (p.lesson?.course) {
      const courseId = p.lesson.course.id
      if (!courseProgress.has(courseId)) {
        courseProgress.set(courseId, {
          total: p.lesson.course.lessons?.length || 1,
          completed: 0,
          course: p.lesson.course
        })
      }
      if (p.completed) {
        const current = courseProgress.get(courseId)!
        current.completed++
      }
    }
  })
  const myCoursesArray = Array.from(courseProgress.values()).slice(0, 3)

  // Get recommended courses
  const startedCourseIds = Array.from(courseProgress.keys())
  const { data: recommendedCourses } = await supabase
    .from('courses')
    .select(`
      *,
      musical_style:musical_styles(name),
      teacher:teachers(name)
    `)
    .eq('is_published', true)
    .not('id', 'in', `(${startedCourseIds.length > 0 ? startedCourseIds.join(',') : '00000000-0000-0000-0000-000000000000'})`)
    .limit(4)

  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/20 via-primary/10 to-transparent p-6 md:p-8">
        <div className="relative z-10">
          <h1 className="text-2xl md:text-3xl font-bold font-heading mb-2">
            Welcome back, {firstName}!
          </h1>
          <p className="text-muted-foreground mb-4">
            Continue your Latin music journey
          </p>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-lg px-4 py-2">
              <Flame className={`h-5 w-5 ${streak > 0 ? 'text-primary fill-primary' : 'text-muted-foreground'}`} />
              <span className="font-semibold">{streak} day streak</span>
            </div>
            <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-lg px-4 py-2">
              <Trophy className="h-5 w-5 text-primary" />
              <span className="font-semibold">{totalLessonsCompleted || 0} lessons completed</span>
            </div>
            <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-lg px-4 py-2">
              <Award className="h-5 w-5 text-primary" />
              <span className="font-semibold">{achievementsCount || 0} achievements</span>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Link href="/dashboard/courses" className="group">
          <Card className="h-full hover:bg-secondary/50 transition-colors">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <span className="font-medium text-sm">Browse Courses</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/teachers" className="group">
          <Card className="h-full hover:bg-secondary/50 transition-colors">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <span className="font-medium text-sm">Teachers</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/feedback" className="group">
          <Card className="h-full hover:bg-secondary/50 transition-colors">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Video className="h-5 w-5 text-primary" />
              </div>
              <span className="font-medium text-sm">Get Feedback</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/achievements" className="group">
          <Card className="h-full hover:bg-secondary/50 transition-colors">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <span className="font-medium text-sm">Achievements</span>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Continue Learning - Large Card */}
        <div className="lg:col-span-2">
          {continueLesson ? (
            <Card className="overflow-hidden">
              <div className="flex flex-col md:flex-row">
                {continueLesson.lesson.course.thumbnail_url && (
                  <div className="md:w-72 aspect-video md:aspect-auto bg-muted flex-shrink-0">
                    <img
                      src={continueLesson.lesson.course.thumbnail_url}
                      alt={continueLesson.lesson.course.title}
                      className="object-cover w-full h-full"
                    />
                  </div>
                )}
                <div className="flex-1 p-6">
                  <Badge variant="secondary" className="mb-3">Continue Learning</Badge>
                  <h3 className="text-xl font-semibold mb-2">{continueLesson.lesson.course.title}</h3>
                  <p className="text-muted-foreground mb-4">
                    Lesson {(continueLesson.lesson.order_index ?? 0) + 1}: {continueLesson.lesson.title}
                  </p>
                  <Button asChild>
                    <Link href={`/lessons/${continueLesson.lesson_id}`}>
                      <Play className="h-4 w-4 mr-2 fill-current" />
                      Continue Lesson
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-8 text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <BookOpen className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Start Learning</h3>
              <p className="text-muted-foreground mb-4">
                Begin your Latin music journey with our expert-led courses
              </p>
              <Button asChild>
                <Link href="/dashboard/courses">
                  Browse Courses
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </Card>
          )}
        </div>

        {/* My Courses Summary */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">My Courses</CardTitle>
              <Link href="/dashboard/my-courses">
                <Button variant="ghost" size="sm" className="text-xs">
                  View All <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {myCoursesArray.length > 0 ? (
              myCoursesArray.map(({ course, total, completed }) => {
                const progress = Math.round((completed / total) * 100)
                return (
                  <Link key={course.id} href={`/dashboard/course/${course.slug}`} className="block group">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                        {course.thumbnail_url ? (
                          <img src={course.thumbnail_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                            <BookOpen className="h-5 w-5 text-primary" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                          {course.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress value={progress} className="h-1.5 flex-1" />
                          <span className="text-xs text-muted-foreground">{progress}%</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">No courses started yet</p>
                <Button variant="link" size="sm" asChild className="mt-1">
                  <Link href="/dashboard/courses">Start a course</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recommended Courses */}
      {recommendedCourses && recommendedCourses.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recommended For You</h2>
            <Link href="/dashboard/courses">
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recommendedCourses.map((course: any) => (
              <Link key={course.id} href={`/dashboard/course/${course.slug}`} className="group">
                <Card className="overflow-hidden h-full hover:bg-secondary/30 transition-colors">
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    {course.thumbnail_url ? (
                      <img
                        src={course.thumbnail_url}
                        alt={course.title}
                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                        <BookOpen className="h-8 w-8 text-primary/50" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <Badge variant="outline" className="mb-2 text-xs">
                      {course.musical_style?.name || 'Course'}
                    </Badge>
                    <h3 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                      {course.title}
                    </h3>
                    {course.teacher?.name && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {course.teacher.name}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Subscription CTA for free users */}
      {!subscription?.status && (
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-lg mb-1">Unlock All Courses</h3>
              <p className="text-sm text-muted-foreground">
                Get unlimited access to all lessons, teacher feedback, and exclusive content
              </p>
            </div>
            <Button asChild>
              <Link href="/pricing">
                Upgrade Now
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
