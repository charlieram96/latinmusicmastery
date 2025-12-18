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
import { StartLearningCard } from '@/components/dashboard/start-learning-card'

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

  // Get all courses for the carousel (when no course started)
  const { data: allCourses } = await supabase
    .from('courses')
    .select(`
      id,
      title,
      slug,
      thumbnail_url,
      difficulty,
      musical_style:musical_styles(name),
      teacher:teachers(name)
    `)
    .eq('is_published', true)
    .limit(12)

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
          <Card className="h-full relative overflow-hidden border-0 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent hover:from-blue-500/20 hover:via-blue-500/10 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10 hover:-translate-y-1">
            <div
              className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity duration-300 bg-cover bg-center"
              style={{ backgroundImage: "url('https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&q=80')" }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/70 to-background/40" />
            <CardContent className="p-5 flex items-center gap-4 relative">
              <div className="h-12 w-12 rounded-xl bg-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <BookOpen className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <span className="font-semibold text-sm">Browse Courses</span>
                <p className="text-xs text-muted-foreground">Explore all courses</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/teachers" className="group">
          <Card className="h-full relative overflow-hidden border-0 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent hover:from-purple-500/20 hover:via-purple-500/10 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10 hover:-translate-y-1">
            <div
              className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity duration-300 bg-cover bg-center"
              style={{ backgroundImage: "url('https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=400&q=80')" }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/70 to-background/40" />
            <CardContent className="p-5 flex items-center gap-4 relative">
              <div className="h-12 w-12 rounded-xl bg-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Users className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <span className="font-semibold text-sm">Teachers</span>
                <p className="text-xs text-muted-foreground">Meet our experts</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/feedback" className="group">
          <Card className="h-full relative overflow-hidden border-0 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent hover:from-amber-500/20 hover:via-amber-500/10 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/10 hover:-translate-y-1">
            <div
              className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity duration-300 bg-cover bg-center"
              style={{ backgroundImage: "url('https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=400&q=80')" }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/70 to-background/40" />
            <CardContent className="p-5 flex items-center gap-4 relative">
              <div className="h-12 w-12 rounded-xl bg-amber-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Video className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <span className="font-semibold text-sm">Get Feedback</span>
                <p className="text-xs text-muted-foreground">From real teachers</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/achievements" className="group">
          <Card className="h-full relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent hover:from-emerald-500/20 hover:via-emerald-500/10 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/10 hover:-translate-y-1">
            <div
              className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity duration-300 bg-cover bg-center"
              style={{ backgroundImage: "url('https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?w=400&q=80')" }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/70 to-background/40" />
            <CardContent className="p-5 flex items-center gap-4 relative">
              <div className="h-12 w-12 rounded-xl bg-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Sparkles className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <span className="font-semibold text-sm">Achievements</span>
                <p className="text-xs text-muted-foreground">Track your progress</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Continue Learning - Large Card */}
        <div className="lg:col-span-2">
          {continueLesson ? (
            <Card className="overflow-hidden relative group border-0 bg-gradient-to-br from-card via-card to-primary/5">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="flex flex-col md:flex-row relative">
                {continueLesson.lesson.course.thumbnail_url && (
                  <div className="md:w-80 aspect-video md:aspect-auto bg-muted flex-shrink-0 relative overflow-hidden">
                    <img
                      src={continueLesson.lesson.course.thumbnail_url}
                      alt={continueLesson.lesson.course.title}
                      className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-card/50 md:block hidden" />
                  </div>
                )}
                <div className="flex-1 p-6 flex flex-col justify-center">
                  <Badge className="mb-3 w-fit bg-primary/20 text-primary border-0">
                    <Play className="h-3 w-3 mr-1 fill-current" />
                    Continue Learning
                  </Badge>
                  <h3 className="text-xl font-semibold mb-2">{continueLesson.lesson.course.title}</h3>
                  <p className="text-muted-foreground mb-5">
                    Lesson {(continueLesson.lesson.order_index ?? 0) + 1}: {continueLesson.lesson.title}
                  </p>
                  <Button asChild size="lg" className="w-fit">
                    <Link href={`/lessons/${continueLesson.lesson_id}`}>
                      <Play className="h-4 w-4 mr-2 fill-current" />
                      Continue Lesson
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <StartLearningCard courses={allCourses || []} />
          )}
        </div>

        {/* My Courses Summary */}
        <Card className="relative overflow-hidden border-0 bg-gradient-to-b from-card to-muted/30 h-[380px]">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
          <CardHeader className="pb-3 relative">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BookOpen className="h-4 w-4 text-primary" />
                </div>
                My Courses
              </CardTitle>
              <Link href="/dashboard/my-courses">
                <Button variant="ghost" size="sm" className="text-xs">
                  View All <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 relative">
            {myCoursesArray.length > 0 ? (
              myCoursesArray.map(({ course, total, completed }) => {
                const progress = Math.round((completed / total) * 100)
                return (
                  <Link key={course.id} href={`/dashboard/course/${course.slug}`} className="block group">
                    <div className="flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-muted/50 transition-colors">
                      <div className="h-14 w-14 rounded-xl bg-muted overflow-hidden flex-shrink-0">
                        {course.thumbnail_url ? (
                          <img src={course.thumbnail_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                            <BookOpen className="h-6 w-6 text-primary" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                          {course.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Progress value={progress} className="h-2 flex-1" />
                          <span className="text-xs font-medium text-muted-foreground">{progress}%</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })
            ) : (
              <div className="text-center py-6">
                <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="h-6 w-6 text-muted-foreground" />
                </div>
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
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-orange-500" />
              </div>
              <h2 className="text-xl font-semibold">Recommended For You</h2>
            </div>
            <Link href="/dashboard/courses">
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recommendedCourses.map((course: any) => (
              <Link key={course.id} href={`/dashboard/course/${course.slug}`} className="group">
                <Card className="overflow-hidden h-full border-0 bg-gradient-to-b from-card to-muted/20 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1 p-0 gap-0">
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    {course.thumbnail_url ? (
                      <img
                        src={course.thumbnail_url}
                        alt={course.title}
                        className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                        <BookOpen className="h-8 w-8 text-primary/50" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                  <div className="p-4">
                    <Badge variant="outline" className="mb-2 text-xs bg-primary/5 border-primary/20 text-primary">
                      {course.musical_style?.name || 'Course'}
                    </Badge>
                    <h3 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                      {course.title}
                    </h3>
                    {course.teacher?.name && (
                      <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {course.teacher.name}
                      </p>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Subscription CTA for free users */}
      {!subscription?.status && (
        <Card className="relative overflow-hidden border-0 bg-gradient-to-r from-primary/20 via-primary/10 to-purple-500/10">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
          <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative">
            <div className="flex items-center gap-5">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-xl mb-1">Unlock All Courses</h3>
                <p className="text-muted-foreground">
                  Get unlimited access to all lessons, teacher feedback, and exclusive content
                </p>
              </div>
            </div>
            <Button asChild size="lg" className="flex-shrink-0">
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
