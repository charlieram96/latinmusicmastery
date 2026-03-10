import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  TrendingUp, Users, DollarSign, MessageSquare, Clock, CheckCircle, ArrowRight, Eye,
} from 'lucide-react'
import { getAnalytics } from '@/app/actions/admin'

export default async function AdminAnalyticsPage() {
  const analytics = await getAnalytics()

  const totalUsers = analytics.userGrowth.reduce((sum, m) => sum + m.users, 0)
  const currentMonthUsers = analytics.userGrowth[analytics.userGrowth.length - 1]?.users || 0
  const maxGrowth = Math.max(...analytics.userGrowth.map(m => m.users), 1)
  const avgCompletionRate = analytics.courseCompletionRates.length > 0
    ? Math.round(analytics.courseCompletionRates.reduce((sum, c) => sum + c.rate, 0) / analytics.courseCompletionRates.length)
    : 0

  const statCards = [
    {
      label: 'Total Users (12mo)',
      value: totalUsers,
      sub: `+${currentMonthUsers} this month`,
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Feedback Requests',
      value: analytics.feedbackStats.total,
      sub: `${analytics.feedbackStats.pending} pending`,
      icon: MessageSquare,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
    },
    {
      label: 'Avg Completion Rate',
      value: `${avgCompletionRate}%`,
      sub: 'Across all courses',
      icon: TrendingUp,
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
    },
    {
      label: 'Revenue & Financials',
      value: '→',
      sub: 'View financial data',
      icon: DollarSign,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
      href: '/admin/financials',
    },
  ]

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-1">Analytics</h1>
        <p className="text-muted-foreground">Platform performance and engagement metrics</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((s) => {
          const Icon = s.icon
          const card = (
            <div className="rounded-xl border bg-card p-5 h-full">
              <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${s.bg} mb-3`}>
                <Icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div className="text-3xl font-bold mb-0.5">{s.value}</div>
              <div className="text-sm text-muted-foreground">{s.label}</div>
              {s.sub && <div className="text-xs text-muted-foreground/70 mt-0.5">{s.sub}</div>}
            </div>
          )
          return s.href ? (
            <Link key={s.label} href={s.href} className="hover:opacity-80 transition-opacity">
              {card}
            </Link>
          ) : (
            <div key={s.label}>{card}</div>
          )
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* User Growth Chart */}
        <div className="rounded-xl border bg-card p-6">
          <h2 className="font-bold text-lg mb-1">User Growth</h2>
          <p className="text-sm text-muted-foreground mb-5">New users by month (last 12 months)</p>
          <div className="space-y-3">
            {analytics.userGrowth.map((month) => (
              <div key={month.month} className="flex items-center gap-3">
                <span className="w-16 text-xs text-muted-foreground font-mono">{month.month.slice(5)}</span>
                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${maxGrowth > 0 ? (month.users / maxGrowth) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-8 text-xs font-bold text-right">{month.users}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Course Completion Rates */}
        <div className="rounded-xl border bg-card p-6">
          <h2 className="font-bold text-lg mb-1">Course Completion</h2>
          <p className="text-sm text-muted-foreground mb-5">Average completion rate per course</p>
          {analytics.courseCompletionRates.length > 0 ? (
            <div className="space-y-4">
              {analytics.courseCompletionRates.slice(0, 8).map((course) => (
                <div key={course.courseId}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium truncate pr-3">{course.title}</span>
                    <span className="text-muted-foreground whitespace-nowrap text-xs">
                      {course.rate}% · {course.enrollments} enrolled
                    </span>
                  </div>
                  <div className="bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${course.rate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-8">No course data available</p>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Popular Lessons */}
        <div className="rounded-xl border bg-card p-6">
          <h2 className="font-bold text-lg mb-1">Popular Lessons</h2>
          <p className="text-sm text-muted-foreground mb-5">Most completed lessons</p>
          {analytics.popularLessons.length > 0 ? (
            <div className="space-y-2">
              {analytics.popularLessons.map((lesson, index) => (
                <div
                  key={lesson.lessonId}
                  className="flex items-center gap-3 p-3 rounded-lg border"
                >
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex-shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{lesson.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{lesson.courseTitle}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">{lesson.completions}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-8">No data available</p>
          )}
        </div>

        {/* Feedback Stats */}
        <div className="rounded-xl border bg-card p-6">
          <h2 className="font-bold text-lg mb-1">Feedback Overview</h2>
          <p className="text-sm text-muted-foreground mb-5">Student feedback request status</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl border text-center">
              <div className="text-3xl font-bold mb-1">{analytics.feedbackStats.total}</div>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="p-4 rounded-xl border text-center bg-yellow-500/5">
              <div className="flex items-center justify-center gap-1.5 text-3xl font-bold mb-1 text-yellow-500">
                <Clock className="w-5 h-5" />
                {analytics.feedbackStats.pending}
              </div>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div className="p-4 rounded-xl border text-center bg-blue-500/5">
              <div className="flex items-center justify-center gap-1.5 text-3xl font-bold mb-1 text-blue-500">
                <Eye className="w-5 h-5" />
                {analytics.feedbackStats.inReview}
              </div>
              <p className="text-xs text-muted-foreground">In Review</p>
            </div>
            <div className="p-4 rounded-xl border text-center bg-green-500/5">
              <div className="flex items-center justify-center gap-1.5 text-3xl font-bold mb-1 text-green-500">
                <CheckCircle className="w-5 h-5" />
                {analytics.feedbackStats.completed}
              </div>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </div>
          <Link
            href="/admin/feedback"
            className="flex items-center justify-center gap-1 mt-4 text-xs text-primary hover:underline"
          >
            View all feedback <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}
