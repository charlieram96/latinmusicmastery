import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import Link from 'next/link'
import {
  Play,
  BookOpen,
  Clock,
  CheckCircle2,
  ArrowRight,
  GraduationCap
} from 'lucide-react'
import { MyCoursesFilters } from '@/components/dashboard/my-courses-filters'

interface PageProps {
  searchParams: Promise<{
    filter?: 'all' | 'in-progress' | 'completed'
    sort?: 'recent' | 'progress' | 'alphabetical'
  }>
}

export default async function MyCoursesPage({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user's progress on lessons with course lesson counts
  const { data: userProgress } = await supabase
    .from('user_progress')
    .select(`
      *,
      lesson:lessons(
        *,
        course:courses(
          *,
          lessons(id),
          musical_style:musical_styles(
            name,
            country:countries(name)
          ),
          teacher:teachers(name, image_url)
        )
      )
    `)
    .eq('user_id', user.id)

  // Group lessons by course
  const coursesMap = new Map()

  userProgress?.forEach((progress: any) => {
    const course = progress.lesson.course
    if (!coursesMap.has(course.id)) {
      coursesMap.set(course.id, {
        ...course,
        totalLessons: course.lessons?.length || 0,
        completedLessons: 0,
        lastAccessed: progress.updated_at,
        nextLessonId: null,
      })
    }

    const courseData = coursesMap.get(course.id)
    if (progress.completed) {
      courseData.completedLessons++
    } else if (!courseData.nextLessonId) {
      courseData.nextLessonId = progress.lesson_id
    }

    // Update last accessed time
    if (new Date(progress.updated_at) > new Date(courseData.lastAccessed)) {
      courseData.lastAccessed = progress.updated_at
    }
  })

  let enrolledCourses = Array.from(coursesMap.values())

  // Apply filter
  const filter = params.filter || 'all'
  if (filter === 'in-progress') {
    enrolledCourses = enrolledCourses.filter(c =>
      c.completedLessons > 0 && c.completedLessons < c.totalLessons
    )
  } else if (filter === 'completed') {
    enrolledCourses = enrolledCourses.filter(c =>
      c.completedLessons === c.totalLessons && c.totalLessons > 0
    )
  }

  // Apply sort
  const sort = params.sort || 'recent'
  if (sort === 'recent') {
    enrolledCourses.sort((a, b) =>
      new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime()
    )
  } else if (sort === 'progress') {
    enrolledCourses.sort((a, b) => {
      const progressA = a.totalLessons > 0 ? a.completedLessons / a.totalLessons : 0
      const progressB = b.totalLessons > 0 ? b.completedLessons / b.totalLessons : 0
      return progressB - progressA
    })
  } else if (sort === 'alphabetical') {
    enrolledCourses.sort((a, b) => a.title.localeCompare(b.title))
  }

  // Get counts for filter badges
  const allCourses = Array.from(coursesMap.values())
  const counts = {
    all: allCourses.length,
    inProgress: allCourses.filter(c => c.completedLessons > 0 && c.completedLessons < c.totalLessons).length,
    completed: allCourses.filter(c => c.completedLessons === c.totalLessons && c.totalLessons > 0).length,
  }

  const getProgressRingColor = (percent: number) => {
    if (percent === 100) return 'text-green-500'
    if (percent >= 50) return 'text-primary'
    return 'text-muted-foreground'
  }

  return (
    <>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold font-heading mb-2">My Courses</h1>
        <p className="text-muted-foreground">
          Track your progress and continue learning
        </p>
      </div>

      {/* Filters & Sort */}
      <MyCoursesFilters counts={counts} />

      {/* Courses */}
      {enrolledCourses.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {enrolledCourses.map((course: any) => {
            const progressPercent = course.totalLessons > 0
              ? Math.round((course.completedLessons / course.totalLessons) * 100)
              : 0
            const isCompleted = progressPercent === 100

            return (
              <Link key={course.id} href={`/dashboard/course/${course.slug || course.id}`} className="group">
                <Card className="overflow-hidden h-full hover:bg-secondary/30 transition-colors">
                  {/* Thumbnail with Progress Ring Overlay */}
                  <div className="relative aspect-video bg-muted">
                    {course.thumbnail_url ? (
                      <img
                        src={course.thumbnail_url}
                        alt={course.title}
                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                        <BookOpen className="h-10 w-10 text-primary/50" />
                      </div>
                    )}

                    {/* Progress Ring */}
                    <div className="absolute bottom-3 right-3 bg-background/90 backdrop-blur-sm rounded-full p-1">
                      <div className="relative h-12 w-12">
                        <svg className="h-12 w-12 -rotate-90" viewBox="0 0 36 36">
                          <circle
                            cx="18"
                            cy="18"
                            r="15.5"
                            fill="none"
                            className="stroke-muted"
                            strokeWidth="2"
                          />
                          <circle
                            cx="18"
                            cy="18"
                            r="15.5"
                            fill="none"
                            className={`${getProgressRingColor(progressPercent)} transition-all duration-500`}
                            strokeWidth="2"
                            strokeDasharray={`${progressPercent} 100`}
                            strokeLinecap="round"
                            stroke="currentColor"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          {isCompleted ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <span className="text-xs font-bold">{progressPercent}%</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="absolute top-3 left-3">
                      {isCompleted ? (
                        <Badge className="bg-green-500/90 text-white gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Completed
                        </Badge>
                      ) : progressPercent > 0 ? (
                        <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm gap-1">
                          <Clock className="h-3 w-3" />
                          In Progress
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm">
                          Not Started
                        </Badge>
                      )}
                    </div>
                  </div>

                  <CardContent className="p-4">
                    {/* Style & Country */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <Badge variant="outline" className="text-xs">
                        {course.musical_style?.name}
                      </Badge>
                      <span>{course.musical_style?.country?.name}</span>
                    </div>

                    {/* Title */}
                    <h3 className="font-semibold mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                      {course.title}
                    </h3>

                    {/* Progress Bar */}
                    <div className="mb-3">
                      <Progress value={progressPercent} className="h-1.5" />
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {course.completedLessons} of {course.totalLessons} lessons completed
                      </p>
                    </div>

                    {/* Teacher & Continue Button */}
                    <div className="flex items-center justify-between">
                      {course.teacher && (
                        <div className="flex items-center gap-2">
                          {course.teacher.image_url ? (
                            <img
                              src={course.teacher.image_url}
                              alt={course.teacher.name}
                              className="h-6 w-6 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                              <GraduationCap className="h-3 w-3 text-primary" />
                            </div>
                          )}
                          <span className="text-xs text-muted-foreground">{course.teacher.name}</span>
                        </div>
                      )}
                      <Button size="sm" variant="ghost" className="gap-1 text-xs h-7">
                        {isCompleted ? 'Review' : 'Continue'}
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      ) : (
        /* Empty State */
        <Card className="mt-8">
          <CardContent className="p-12 text-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {filter === 'completed'
                ? 'No Completed Courses Yet'
                : filter === 'in-progress'
                  ? 'No Courses In Progress'
                  : 'No Courses Yet'}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {filter === 'completed'
                ? 'Complete your first course to see it here. Keep learning!'
                : filter === 'in-progress'
                  ? 'Start a course to track your progress here.'
                  : 'Start your Latin music journey by enrolling in a course'}
            </p>
            <Button asChild>
              <Link href="/dashboard/courses">
                Browse Courses
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  )
}
