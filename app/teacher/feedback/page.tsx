import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MessageSquare, Clock, CheckCircle, Eye } from 'lucide-react'
import { getTeacherFeedbackRequests } from '@/app/actions/teacher'

export default async function TeacherFeedbackPage() {
  const allRequests = await getTeacherFeedbackRequests()

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
            className="flex items-center justify-between p-4 rounded-lg border"
          >
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-medium">
                  {request.profiles?.full_name || 'Anonymous Student'}
                </span>
                {getStatusBadge(request.status)}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {request.message || 'No message provided'}
              </p>
              {request.video_url && (
                <p className="text-xs text-muted-foreground">
                  Video submitted
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2 ml-4">
              <span className="text-sm text-muted-foreground">
                {request.created_at
                  ? new Date(request.created_at).toLocaleDateString()
                  : 'N/A'}
              </span>
              <Button asChild size="sm">
                <Link href={`/teacher/feedback/${request.id}`}>
                  {request.status === 'completed' ? 'View' : 'Respond'}
                </Link>
              </Button>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Feedback Requests</h1>
        <p className="text-muted-foreground">
          Review and respond to student feedback requests
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Requests</CardTitle>
          <CardDescription>
            {allRequests.length} total request{allRequests.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
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
