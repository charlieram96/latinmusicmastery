import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import Link from 'next/link'
import { Play, BookOpen } from 'lucide-react'

export default async function MyCoursesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user's progress on lessons
  const { data: userProgress } = await supabase
    .from('user_progress')
    .select(`
      *,
      lesson:lessons(
        *,
        course:courses(
          *,
          musical_style:musical_styles(
            name,
            country:countries(name)
          )
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
        lessons: [],
        totalLessons: 0,
        completedLessons: 0,
        lastAccessed: progress.updated_at,
      })
    }

    const courseData = coursesMap.get(course.id)
    courseData.totalLessons++
    if (progress.completed) {
      courseData.completedLessons++
    }

    // Update last accessed time
    if (new Date(progress.updated_at) > new Date(courseData.lastAccessed)) {
      courseData.lastAccessed = progress.updated_at
    }
  })

  const enrolledCourses = Array.from(coursesMap.values())
    .sort((a, b) => new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime())

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Courses</h1>
        <p className="text-muted-foreground">
          Continue your learning journey
        </p>
      </div>

      {/* Courses Grid */}
      {enrolledCourses.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {enrolledCourses.map((course: any) => {
            const progressPercent = course.totalLessons > 0
              ? Math.round((course.completedLessons / course.totalLessons) * 100)
              : 0

            return (
              <Card key={course.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2">{course.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {course.musical_style.name} • {course.musical_style.country.name}
                      </p>
                    </div>
                    <Badge variant={progressPercent === 100 ? 'default' : 'secondary'}>
                      {progressPercent}% Complete
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Progress Bar */}
                  <div className="mb-4">
                    <Progress value={progressPercent} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-2">
                      {course.completedLessons} of {course.totalLessons} lessons completed
                    </p>
                  </div>

                  {/* Course Description */}
                  {course.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {course.description}
                    </p>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button asChild className="flex-1">
                      <Link href={`/course/${course.id}`}>
                        <Play className="w-4 h-4 mr-2" />
                        {progressPercent > 0 ? 'Continue' : 'Start'}
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href={`/course/${course.id}`}>
                        <BookOpen className="w-4 h-4 mr-2" />
                        View
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        /* Empty State */
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No Courses Yet</h3>
            <p className="text-muted-foreground mb-6">
              Start your Latin music journey by enrolling in a course
            </p>
            <Button asChild>
              <Link href="/courses">Browse Courses</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  )
}
