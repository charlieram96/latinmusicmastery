import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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
  Sparkles,
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

  // Fetch user's course enrollments with course details
  const { data: enrollments } = await supabase
    .from('course_enrollments')
    .select(`
      *,
      course:courses(
        id,
        title,
        slug,
        thumbnail_url,
        course_sections(
          id,
          classes(
            id,
            items:class_items(id)
          )
        )
      )
    `)
    .eq('user_id', user.id)
    .order('last_accessed_at', { ascending: false })

  // Get all class item IDs from enrolled courses
  const allItemIds: string[] = []
  const courseItemMap = new Map<string, string[]>()

  for (const enrollment of enrollments || []) {
    const course = enrollment.course as any
    if (!course) continue
    const itemIds: string[] = []
    for (const section of course.course_sections || []) {
      for (const cls of section.classes || []) {
        for (const item of cls.items || []) {
          itemIds.push(item.id)
          allItemIds.push(item.id)
        }
      }
    }
    courseItemMap.set(course.id, itemIds)
  }

  // Get all progress for these items
  let progressData: any[] = []
  if (allItemIds.length > 0) {
    const { data } = await supabase
      .from('class_item_progress')
      .select('*')
      .eq('user_id', user.id)
      .in('class_item_id', allItemIds)
    progressData = data || []
  }

  const completedItemIds = new Set(
    progressData.filter(p => p.completed).map(p => p.class_item_id)
  )

  // Calculate total lessons completed
  const totalLessonsCompleted = completedItemIds.size

  // Get user achievements count
  const { count: achievementsCount } = await supabase
    .from('user_achievements')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // Calculate streak from class_item_progress
  let streak = 0
  if (progressData.length > 0) {
    const uniqueDates = new Set<string>()
    progressData.forEach((p) => {
      if (p.completed_at) {
        const date = new Date(p.completed_at).toISOString().split('T')[0]
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

  // Build course progress for "My Courses" section
  const myCoursesArray: { course: any; total: number; completed: number }[] = []
  for (const enrollment of enrollments || []) {
    const course = enrollment.course as any
    if (!course) continue
    const itemIds = courseItemMap.get(course.id) || []
    const completedCount = itemIds.filter(id => completedItemIds.has(id)).length
    myCoursesArray.push({
      course,
      total: itemIds.length,
      completed: completedCount,
    })
  }

  // Find continue learning: most recently accessed course with incomplete items
  let continueData: { courseId: string; courseSlug: string; courseTitle: string; courseThumbnail: string | null; classId: string | null } | null = null

  // Get most recent progress entry to find last class
  if (progressData.length > 0) {
    const sortedProgress = [...progressData]
      .filter(p => !p.completed)
      .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())

    if (sortedProgress.length > 0) {
      // Find which course this item belongs to
      const recentItemId = sortedProgress[0].class_item_id
      for (const enrollment of enrollments || []) {
        const course = enrollment.course as any
        if (!course) continue
        for (const section of course.course_sections || []) {
          for (const cls of section.classes || []) {
            for (const item of cls.items || []) {
              if (item.id === recentItemId) {
                continueData = {
                  courseId: course.id,
                  courseSlug: course.slug,
                  courseTitle: course.title,
                  courseThumbnail: course.thumbnail_url,
                  classId: cls.id,
                }
              }
            }
          }
        }
      }
    }
  }

  // Get recommended courses
  const startedCourseIds = myCoursesArray.map(c => c.course.id)
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
      description,
      thumbnail_url,
      difficulty,
      musical_style:musical_styles(name),
      teacher:teachers(name)
    `)
    .eq('is_published', true)
    .limit(12)

  const coursesInProgress = myCoursesArray.length

  return (
    <div className="space-y-6">
      {/* Hero Row: Continue Learning + Stats */}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Continue Learning Hero */}
        {continueData ? (
          <div className="relative overflow-hidden rounded-xl min-h-[260px] flex items-end">
            {/* Background image */}
            {continueData.courseThumbnail && (
              <img
                src={continueData.courseThumbnail}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />
            {/* Content */}
            <div className="relative z-10 p-6 w-full">
              <Badge className="mb-3 bg-primary/20 text-primary border-0 backdrop-blur-sm">
                <Play className="h-3 w-3 mr-1 fill-current" />
                Continue Learning
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">{continueData.courseTitle}</h2>
              <Button asChild size="lg">
                <Link href={`/dashboard/course/${continueData.courseSlug}/class/${continueData.classId}`}>
                  <Play className="h-4 w-4 mr-2 fill-current" />
                  Resume Lesson
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <StartLearningCard courses={allCourses || []} />
        )}

        {/* Stats Strip */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div className={`p-2 rounded-lg ${streak > 0 ? 'bg-orange-500/15' : 'bg-muted'}`}>
              <Flame className={`h-5 w-5 ${streak > 0 ? 'text-orange-500 fill-orange-500' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="text-2xl font-bold">{streak}</p>
              <p className="text-xs text-muted-foreground">Day Streak</p>
            </div>
          </div>

          <div className="flex items-center gap-3 py-4 border-b border-border">
            <div className="p-2 rounded-lg bg-emerald-500/15">
              <Trophy className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalLessonsCompleted || 0}</p>
              <p className="text-xs text-muted-foreground">Lessons Done</p>
            </div>
          </div>

          <div className="flex items-center gap-3 py-4 border-b border-border">
            <div className="p-2 rounded-lg bg-amber-500/15">
              <Award className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{achievementsCount || 0}</p>
              <p className="text-xs text-muted-foreground">Achievements</p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4">
            <div className="p-2 rounded-lg bg-blue-500/15">
              <BookOpen className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{coursesInProgress}</p>
              <p className="text-xs text-muted-foreground">Active Courses</p>
            </div>
          </div>
        </div>
      </div>

      {/* My Courses Row */}
      {myCoursesArray.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">My Courses</h2>
            <Link href="/dashboard/my-courses">
              <Button variant="ghost" size="sm" className="text-xs">
                View All <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myCoursesArray.slice(0, 3).map(({ course, total, completed }) => {
              const progress = total > 0 ? Math.round((completed / total) * 100) : 0
              return (
                <Link key={course.id} href={`/dashboard/course/${course.slug}`} className="block group">
                  <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-4 hover:bg-secondary/50 transition-colors">
                    <div className="h-16 w-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
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
                      <div className="flex items-center gap-2 mt-2">
                        <Progress value={progress} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground">{progress}%</span>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Recommended Courses */}
      {recommendedCourses && recommendedCourses.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recommended For You</h2>
            <Link href="/dashboard/courses">
              <Button variant="ghost" size="sm" className="text-xs">
                View All <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recommendedCourses.map((course: any) => (
              <Link key={course.id} href={`/dashboard/course/${course.slug}`} className="group block">
                <div className="bg-card border border-border rounded-xl overflow-hidden hover:brightness-110 transition-all">
                  <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                    {course.thumbnail_url ? (
                      <img src={course.thumbnail_url} alt={course.title} className="object-cover w-full h-full" />
                    ) : (
                      <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                        <BookOpen className="h-8 w-8 text-primary/50" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    {course.musical_style?.name && (
                      <Badge variant="outline" className="mb-2 text-xs border-border">
                        {course.musical_style.name}
                      </Badge>
                    )}
                    <h3 className="font-semibold text-sm line-clamp-1">
                      {course.title}
                    </h3>
                    {course.teacher?.name && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {course.teacher.name}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Subscription CTA */}
      {!subscription?.status && (
        <div className="bg-card border border-border rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-l-4 border-l-primary">
          <div>
            <h3 className="font-bold text-lg mb-1">Unlock All Courses</h3>
            <p className="text-muted-foreground text-sm">
              Get unlimited access to all lessons, teacher feedback, and exclusive content.
            </p>
          </div>
          <Button asChild size="lg" className="flex-shrink-0 w-full sm:w-auto">
            <Link href="/pricing">
              Upgrade Now
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}
