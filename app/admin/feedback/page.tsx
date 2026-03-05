import Link from 'next/link'
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
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 hover:bg-yellow-500/10"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>
      case 'in_review':
        return <Badge variant="default"><Eye className="w-3 h-3 mr-1" /> In Review</Badge>
      case 'completed':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/10"><CheckCircle className="w-3 h-3 mr-1" /> Completed</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const FeedbackList = ({ requests }: { requests: any[] }) => {
    if (requests.length === 0) {
      return (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No feedback requests in this category</p>
        </div>
      )
    }

    return (
      <div className="divide-y">
        {requests.map((request: any) => (
          <div key={request.id} className="flex items-start justify-between px-6 py-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {getStatusBadge(request.status)}
                <span className="text-xs text-muted-foreground">
                  {request.created_at ? new Date(request.created_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2 mb-2">
                <div className="flex items-center gap-1.5 text-sm">
                  <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium truncate">{request.profiles?.full_name || 'Anonymous'}</span>
                  {request.profiles?.email && (
                    <span className="text-muted-foreground text-xs truncate">({request.profiles.email})</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <GraduationCap className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium">{request.teachers?.name || 'Unassigned'}</span>
                  {request.teachers?.instrument && (
                    <span className="text-muted-foreground text-xs">({request.teachers.instrument})</span>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {request.message || 'No message provided'}
              </p>
            </div>
            {request.profiles && (
              <Button asChild size="sm" variant="outline" className="ml-4 flex-shrink-0">
                <Link href={`/admin/users/${request.profiles.id}`}>View User</Link>
              </Button>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tight mb-1">Feedback</h1>
        <p className="text-muted-foreground">Overview of all student feedback requests</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total', value: allRequests.length, color: '' },
          { label: 'Pending', value: pendingRequests.length, color: 'text-yellow-500' },
          { label: 'In Review', value: inReviewRequests.length, color: 'text-blue-500' },
          { label: 'Completed', value: completedRequests.length, color: 'text-green-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border bg-card p-5">
            <div className={`text-3xl font-bold mb-0.5 ${color}`}>{value}</div>
            <div className="text-sm text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      {/* Feedback Tabs */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          <h2 className="font-bold">All Feedback Requests</h2>
        </div>
        <Tabs defaultValue="all" className="w-full">
          <div className="px-6 pt-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All ({allRequests.length})</TabsTrigger>
              <TabsTrigger value="pending" className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />Pending ({pendingRequests.length})
              </TabsTrigger>
              <TabsTrigger value="in_review" className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />In Review ({inReviewRequests.length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" />Done ({completedRequests.length})
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="all" className="mt-0">
            <FeedbackList requests={allRequests} />
          </TabsContent>
          <TabsContent value="pending" className="mt-0">
            <FeedbackList requests={pendingRequests} />
          </TabsContent>
          <TabsContent value="in_review" className="mt-0">
            <FeedbackList requests={inReviewRequests} />
          </TabsContent>
          <TabsContent value="completed" className="mt-0">
            <FeedbackList requests={completedRequests} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
