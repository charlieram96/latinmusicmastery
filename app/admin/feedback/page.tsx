import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MessageSquare, Clock, CheckCircle, Eye, User, GraduationCap } from 'lucide-react'
import { getAllFeedbackRequests } from '@/app/actions/admin'

export default async function AdminFeedbackPage() {
  const allRequests = await getAllFeedbackRequests()

  const pendingRequests = allRequests.filter((r: any) => r.status === 'pending')
  const inReviewRequests = allRequests.filter((r: any) => r.status === 'in_review')
  const completedRequests = allRequests.filter((r: any) => r.status === 'completed')

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>
      case 'in_review':
        return <Badge variant="default"><Eye className="w-3 h-3 mr-1" /> In Review</Badge>
      case 'completed':
        return <Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle className="w-3 h-3 mr-1" /> Completed</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const FeedbackList = ({ requests }: { requests: any[] }) => {
    if (requests.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No feedback requests in this category</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {requests.map((request: any) => (
          <div
            key={request.id}
            className="flex items-start justify-between p-4 rounded-lg border"
          >
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                {getStatusBadge(request.status)}
              </div>

              <div className="grid gap-2 sm:grid-cols-2 mb-2">
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">
                    {request.profiles?.full_name || 'Anonymous'}
                  </span>
                  <span className="text-muted-foreground">
                    ({request.profiles?.email})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <GraduationCap className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">
                    {request.teachers?.name || 'Unassigned'}
                  </span>
                  {request.teachers?.instrument && (
                    <span className="text-muted-foreground">
                      ({request.teachers.instrument})
                    </span>
                  )}
                </div>
              </div>

              <p className="text-sm text-muted-foreground line-clamp-2">
                {request.message || 'No message provided'}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2 ml-4">
              <span className="text-sm text-muted-foreground">
                {request.created_at
                  ? new Date(request.created_at).toLocaleDateString()
                  : 'N/A'}
              </span>
              {request.profiles && (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/users/${request.profiles.id}`}>
                    View User
                  </Link>
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Feedback Management</h1>
        <p className="text-muted-foreground">
          Overview of all student feedback requests
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{allRequests.length}</div>
            <p className="text-sm text-muted-foreground">Total Requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-500">{pendingRequests.length}</div>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-500">{inReviewRequests.length}</div>
            <p className="text-sm text-muted-foreground">In Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-500">{completedRequests.length}</div>
            <p className="text-sm text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            All Feedback Requests
          </CardTitle>
          <CardDescription>
            View and manage feedback requests across all teachers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="all">
                All ({allRequests.length})
              </TabsTrigger>
              <TabsTrigger value="pending" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Pending ({pendingRequests.length})
              </TabsTrigger>
              <TabsTrigger value="in_review" className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                In Review ({inReviewRequests.length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Completed ({completedRequests.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="all">
              <FeedbackList requests={allRequests} />
            </TabsContent>
            <TabsContent value="pending">
              <FeedbackList requests={pendingRequests} />
            </TabsContent>
            <TabsContent value="in_review">
              <FeedbackList requests={inReviewRequests} />
            </TabsContent>
            <TabsContent value="completed">
              <FeedbackList requests={completedRequests} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
