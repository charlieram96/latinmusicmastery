import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  TrendingUp,
  BookOpen,
  CheckCircle,
  Target,
  Flame,
  Calendar,
} from 'lucide-react'

export default async function MyProgressPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get all class item progress for this user
  const { data: itemProgress } = await supabase
    .from('class_item_progress')
    .select(`
      *,
      class_item:class_items(
        id,
        title,
        item_type,
        video_duration_seconds,
        class_id,
        class:classes(
          id,
          title,
          section:course_sections(
            course_id,
            courses(id, title, slug)
          )
        )
      )
    `)
    .eq('user_id', user.id)

  // Get all exercise attempts
  const { data: exerciseAttempts } = await supabase
    .from('exercise_attempts')
    .select('*')
    .eq('user_id', user.id)

  // Calculate stats
  const totalItems = itemProgress?.length || 0
  const completedItems = itemProgress?.filter(p => p.completed).length || 0
  const inProgressItems = totalItems - completedItems

  const totalExercises = exerciseAttempts?.length || 0
  const correctExercises = exerciseAttempts?.filter(e => e.is_correct).length || 0
  const accuracyRate = totalExercises > 0
    ? Math.round((correctExercises / totalExercises) * 100)
    : 0

  // Calculate total learning time from completed video items
  const totalMinutes = itemProgress
    ?.filter(p => p.completed)
    .reduce((sum, p) => {
      const item = p.class_item as any
      return sum + Math.round((item?.video_duration_seconds || 0) / 60)
    }, 0) || 0
  const totalHours = Math.round(totalMinutes / 60)

  // Calculate streak from completed_at dates
  let currentStreak = 0
  if (itemProgress && itemProgress.length > 0) {
    const uniqueDates = new Set<string>()
    itemProgress.forEach((p) => {
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
        expectedDate.setDate(expectedDate.getDate() - currentStreak)
        if (date.toISOString().split('T')[0] === expectedDate.toISOString().split('T')[0]) {
          currentStreak++
        } else {
          break
        }
      }
    }
  }

  // Recent activity
  const recentActivity = itemProgress
    ?.filter(p => p.updated_at)
    .sort((a, b) => new Date(b.updated_at!).getTime() - new Date(a.updated_at!).getTime())
    .slice(0, 5)

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Progress</h1>
        <p className="text-muted-foreground">
          Track your learning journey and achievements
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        {/* Total Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Items
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalItems}</div>
            <p className="text-xs text-muted-foreground">
              {inProgressItems} in progress
            </p>
          </CardContent>
        </Card>

        {/* Completed */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Completed
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedItems}</div>
            <Progress
              value={totalItems > 0 ? (completedItems / totalItems) * 100 : 0}
              className="mt-2 h-1"
            />
          </CardContent>
        </Card>

        {/* Exercise Accuracy */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Accuracy
            </CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{accuracyRate}%</div>
            <p className="text-xs text-muted-foreground">
              {correctExercises}/{totalExercises} correct
            </p>
          </CardContent>
        </Card>

        {/* Current Streak */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Current Streak
            </CardTitle>
            <Flame className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentStreak} days</div>
            <p className="text-xs text-muted-foreground">
              {currentStreak > 0 ? 'Keep it going!' : 'Start your streak today!'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        {/* Learning Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Learning Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Hours</span>
                <span className="font-bold">{totalHours}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Minutes</span>
                <span className="font-bold">{totalMinutes}m</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity && recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.map((activity: any) => {
                  const item = activity.class_item as any
                  const cls = item?.class
                  return (
                    <div key={activity.id} className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium line-clamp-1">
                          {item?.title || cls?.title || 'Class Item'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(activity.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                      {activity.completed && (
                        <Badge variant="secondary" className="ml-2">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Done
                        </Badge>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No recent activity yet. Start learning to see your progress here!
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
