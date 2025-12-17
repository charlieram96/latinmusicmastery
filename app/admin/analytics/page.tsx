import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  BookOpen,
  MessageSquare,
  Clock,
  CheckCircle
} from 'lucide-react'
import { getAnalytics } from '@/app/actions/admin'

export default async function AdminAnalyticsPage() {
  const analytics = await getAnalytics()

  // Calculate totals
  const totalRevenue = analytics.monthlyRevenue.reduce((sum, m) => sum + m.revenue, 0)
  const totalUsers = analytics.userGrowth.reduce((sum, m) => sum + m.users, 0)
  const currentMonthRevenue = analytics.monthlyRevenue[analytics.monthlyRevenue.length - 1]?.revenue || 0
  const currentMonthUsers = analytics.userGrowth[analytics.userGrowth.length - 1]?.users || 0

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Analytics</h1>
        <p className="text-muted-foreground">
          Platform performance and engagement metrics
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              ${currentMonthRevenue} this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">New Users</CardTitle>
            <Users className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              +{currentMonthUsers} this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Feedback Requests</CardTitle>
            <MessageSquare className="w-4 h-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.feedbackStats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.feedbackStats.pending} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.courseCompletionRates.length > 0
                ? Math.round(
                    analytics.courseCompletionRates.reduce((sum, c) => sum + c.rate, 0) /
                      analytics.courseCompletionRates.length
                  )
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Average across courses
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        {/* Monthly Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Monthly Revenue
            </CardTitle>
            <CardDescription>Revenue over the last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.monthlyRevenue.slice(-6).map((month) => (
                <div key={month.month} className="flex items-center gap-4">
                  <span className="w-20 text-sm text-muted-foreground">{month.month}</span>
                  <div className="flex-1">
                    <Progress
                      value={totalRevenue > 0 ? (month.revenue / totalRevenue) * 100 : 0}
                      className="h-2"
                    />
                  </div>
                  <span className="w-16 text-sm font-medium text-right">${month.revenue}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* User Growth Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              User Growth
            </CardTitle>
            <CardDescription>New users over the last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.userGrowth.slice(-6).map((month) => (
                <div key={month.month} className="flex items-center gap-4">
                  <span className="w-20 text-sm text-muted-foreground">{month.month}</span>
                  <div className="flex-1">
                    <Progress
                      value={totalUsers > 0 ? (month.users / totalUsers) * 100 : 0}
                      className="h-2"
                    />
                  </div>
                  <span className="w-16 text-sm font-medium text-right">{month.users}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        {/* Course Completion Rates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Course Completion Rates
            </CardTitle>
            <CardDescription>Average completion by course</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.courseCompletionRates.length > 0 ? (
              <div className="space-y-4">
                {analytics.courseCompletionRates.slice(0, 8).map((course) => (
                  <div key={course.courseId} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium truncate pr-4">{course.title}</span>
                      <span className="text-muted-foreground">
                        {course.rate}% ({course.enrollments} enrolled)
                      </span>
                    </div>
                    <Progress value={course.rate} className="h-2" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No course data available</p>
            )}
          </CardContent>
        </Card>

        {/* Popular Lessons */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Popular Lessons
            </CardTitle>
            <CardDescription>Most completed lessons</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.popularLessons.length > 0 ? (
              <div className="space-y-3">
                {analytics.popularLessons.map((lesson, index) => (
                  <div
                    key={lesson.lessonId}
                    className="flex items-center gap-4 p-3 rounded-lg border"
                  >
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{lesson.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{lesson.courseTitle}</p>
                    </div>
                    <Badge variant="secondary">{lesson.completions} completions</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No lesson data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Feedback Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Feedback Overview
          </CardTitle>
          <CardDescription>Student feedback request status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="p-4 rounded-lg border text-center">
              <div className="text-3xl font-bold mb-1">{analytics.feedbackStats.total}</div>
              <p className="text-sm text-muted-foreground">Total Requests</p>
            </div>
            <div className="p-4 rounded-lg border text-center">
              <div className="flex items-center justify-center gap-2 text-3xl font-bold mb-1 text-yellow-500">
                <Clock className="w-6 h-6" />
                {analytics.feedbackStats.pending}
              </div>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
            <div className="p-4 rounded-lg border text-center">
              <div className="flex items-center justify-center gap-2 text-3xl font-bold mb-1 text-blue-500">
                <MessageSquare className="w-6 h-6" />
                {analytics.feedbackStats.inReview}
              </div>
              <p className="text-sm text-muted-foreground">In Review</p>
            </div>
            <div className="p-4 rounded-lg border text-center">
              <div className="flex items-center justify-center gap-2 text-3xl font-bold mb-1 text-green-500">
                <CheckCircle className="w-6 h-6" />
                {analytics.feedbackStats.completed}
              </div>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
