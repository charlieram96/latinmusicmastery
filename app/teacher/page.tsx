import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Clock, CheckCircle, MessageSquare, ArrowRight } from 'lucide-react'
import { getTeacherStats, getTeacherFeedbackRequests } from '@/app/actions/teacher'

export default async function TeacherDashboard() {
  const stats = await getTeacherStats()
  const recentRequests = await getTeacherFeedbackRequests()

  // Get only the 5 most recent pending/in_review requests
  const pendingRequests = recentRequests
    .filter((r: any) => r.status === 'pending' || r.status === 'in_review')
    .slice(0, 5)

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Teacher Dashboard</h1>
        <p className="text-muted-foreground">
          Manage your feedback requests and help students improve
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="w-4 h-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pending || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Awaiting your review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Review</CardTitle>
            <MessageSquare className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.inReview || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently working on
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <CheckCircle className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.completedThisMonth || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Completed this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <CheckCircle className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalCompleted || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              All time completed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Feedback Requests */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Pending Feedback</CardTitle>
            <CardDescription>Recent requests awaiting your response</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/teacher/feedback">
              View All
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {pendingRequests.length > 0 ? (
            <div className="space-y-4">
              {pendingRequests.map((request: any) => (
                <Link
                  key={request.id}
                  href={`/teacher/feedback/${request.id}`}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-medium">
                        {request.profiles?.full_name || 'Anonymous Student'}
                      </span>
                      <Badge
                        variant={request.status === 'pending' ? 'secondary' : 'default'}
                      >
                        {request.status === 'pending' ? 'Pending' : 'In Review'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {request.message || 'No message provided'}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground ml-4">
                    {request.created_at
                      ? new Date(request.created_at).toLocaleDateString()
                      : 'N/A'}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No pending feedback requests</p>
              <p className="text-sm">Great job! You're all caught up.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
