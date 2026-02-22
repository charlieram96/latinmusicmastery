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

  // Get user's course enrollments with new hierarchy
  const { data: enrollments } = await supabase
    .from('course_enrollments')
    .select(`
      *,
      course:courses(
        *,
        course_sections(
          id,
          classes(
            id,
            items:class_items(id)
          )
        ),
        musical_style:musical_styles(
          name,
          country:countries(name)
        ),
        teacher:teachers(name, image_url)
      )
    `)
    .eq('user_id', user.id)

  // Collect all item IDs across all enrolled courses
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

  // Get progress for all items in one query
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

  // Build enriched courses array
  let enrolledCourses = (enrollments || []).map((enrollment: any) => {
    const course = enrollment.course
    if (!course) return null

    const itemIds = courseItemMap.get(course.id) || []
    const totalItems = itemIds.length
    const completedCount = itemIds.filter(id => completedItemIds.has(id)).length

    return {
      ...course,
      totalLessons: totalItems,
      completedLessons: completedCount,
      lastAccessed: enrollment.last_accessed_at || enrollment.enrolled_at,
      enrolledAt: enrollment.enrolled_at,
    }
  }).filter(Boolean) as any[]

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

  // Get counts for filter badges (from unfiltered data)
  const allCourses = (enrollments || []).map((e: any) => {
    const course = e.course
    if (!course) return null
    const itemIds = courseItemMap.get(course.id) || []
    return {
      totalLessons: itemIds.length,
      completedLessons: itemIds.filter(id => completedItemIds.has(id)).length,
    }
  }).filter(Boolean) as any[]

  const counts = {
    all: allCourses.length,
    inProgress: allCourses.filter(c => c.completedLessons > 0 && c.completedLessons < c.totalLessons).length,
    completed: allCourses.filter(c => c.completedLessons === c.totalLessons && c.totalLessons > 0).length,
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
                <Card className="overflow-hidden h-full transition-colors p-0 gap-0">
                  {/* Thumbnail */}
                  <div className="aspect-video bg-muted overflow-hidden">
                    {course.thumbnail_url ? (
                      <img
                        src={course.thumbnail_url}
                        alt={course.title}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                        <BookOpen className="h-10 w-10 text-primary/50" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4 flex flex-col flex-1">
                    {/* Style & Country */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <Badge variant="outline" className="text-xs">
                        {course.musical_style?.name}
                      </Badge>
                      <span>{course.musical_style?.country?.name}</span>
                    </div>

                    {/* Title */}
                    <h3 className="font-semibold text-base mb-3 line-clamp-2 group-hover:text-primary transition-colors">
                      {course.title}
                    </h3>

                    {/* Teacher */}
                    {course.teacher && (
                      <div className="flex items-center gap-2 mb-4">
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
                        <span className="text-sm text-muted-foreground">{course.teacher.name}</span>
                      </div>
                    )}

                    {/* Progress Bar */}
                    <div className="mt-auto">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                        <span>{course.completedLessons} of {course.totalLessons} items</span>
                        <span className="font-medium">{progressPercent}%</span>
                      </div>
                      <Progress value={progressPercent} className="h-2" />
                    </div>

                    {/* Action Button */}
                    <Button
                      className="w-full mt-4 gap-2"
                      variant={isCompleted ? 'outline' : 'default'}
                    >
                      {isCompleted ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          Review Course
                        </>
                      ) : progressPercent > 0 ? (
                        <>
                          <Play className="h-4 w-4" />
                          Continue Learning
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          Begin Course
                        </>
                      )}
                    </Button>
                  </div>
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
