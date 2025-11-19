import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

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
        course:courses(
          id,
          title,
          thumbnail_url,
          musical_style:musical_styles(
            name,
            country:countries(name, slug)
          )
        )
      )
    `)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(5)

  // Calculate user statistics
  const { count: totalStarted } = await supabase
    .from('user_progress')
    .select('lesson_id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const { count: totalCompleted } = await supabase
    .from('user_progress')
    .select('lesson_id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('completed', true)

  // Get recommended courses (published courses the user hasn't started)
  const startedCourseIds = progressData?.map((p: any) => p.lesson?.course?.id).filter(Boolean) || []

  const { data: recommendedCourses } = await supabase
    .from('courses')
    .select(`
      *,
      musical_style:musical_styles(
        name,
        country:countries(name, slug)
      )
    `)
    .eq('is_published', true)
    .not('id', 'in', `(${startedCourseIds.length > 0 ? startedCourseIds.join(',') : '00000000-0000-0000-0000-000000000000'})`)
    .limit(6)

  // Get continue learning courses (unique courses from progress)
  const continueLearning = progressData
    ?.filter((p: any) => !p.completed && p.lesson?.course)
    .reduce((acc: any[], curr: any) => {
      const courseId = curr.lesson.course.id
      if (!acc.find((item: any) => item.course.id === courseId)) {
        acc.push(curr)
      }
      return acc
    }, [])
    .slice(0, 3) || []

  return (
    <>
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Welcome back!</h1>
        <p className="text-muted-foreground">Continue your Latin music journey</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lessons Started</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStarted || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lessons Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCompleted || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {subscription?.status === 'active' ? (
                <Badge variant="default">Active</Badge>
              ) : (
                <Badge variant="secondary">Free</Badge>
              )}
              {!subscription && (
                <Link href="/pricing">
                  <Button variant="link" size="sm" className="h-auto p-0">
                    Upgrade
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Continue Learning */}
      {continueLearning.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Continue Learning</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {continueLearning.map((progress: any) => {
              const course = progress.lesson.course
              const style = course.musical_style
              return (
                <Card key={progress.id} className="overflow-hidden">
                  {course.thumbnail_url && (
                    <div className="aspect-video bg-muted relative">
                      <img
                        src={course.thumbnail_url}
                        alt={course.title}
                        className="object-cover w-full h-full"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <div className="mb-2">
                      <Badge variant="outline">{style.name}</Badge>
                    </div>
                    <CardTitle className="line-clamp-1">{course.title}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      Continue from: {progress.lesson.title}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild className="w-full">
                      <Link href={`/lessons/${progress.lesson_id}`}>
                        Continue
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Recommended Courses */}
      {recommendedCourses && recommendedCourses.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Recommended Courses</h2>
            <Link href="/courses">
              <Button variant="ghost">View All</Button>
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {recommendedCourses.map((course: any) => {
              const style = course.musical_style
              return (
                <Card key={course.id} className="overflow-hidden">
                  {course.thumbnail_url && (
                    <div className="aspect-video bg-muted relative">
                      <img
                        src={course.thumbnail_url}
                        alt={course.title}
                        className="object-cover w-full h-full"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <div className="mb-2">
                      <Badge variant="outline">{style.name}</Badge>
                    </div>
                    <CardTitle className="line-clamp-1">{course.title}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {course.description || `Learn ${style.name} from ${style.country.name}`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild variant="outline" className="w-full">
                      <Link href={`/course/${course.id}`}>
                        View Course
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {continueLearning.length === 0 && (!recommendedCourses || recommendedCourses.length === 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Start Your Journey</CardTitle>
            <CardDescription>
              You haven't started any courses yet. Browse our collection to begin learning!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/courses">Browse Courses</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  )
}
