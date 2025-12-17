'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Clock, CheckCircle, Eye, Video, User, Send, Loader2 } from 'lucide-react'
import { getFeedbackRequest, submitFeedbackResponse, markFeedbackInReview } from '@/app/actions/teacher'

interface FeedbackDetailPageProps {
  params: Promise<{ id: string }>
}

export default function FeedbackDetailPage({ params }: FeedbackDetailPageProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [request, setRequest] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [responseMessage, setResponseMessage] = useState('')
  const [responseVideoUrl, setResponseVideoUrl] = useState('')

  useEffect(() => {
    async function loadRequest() {
      const { id } = await params
      const data = await getFeedbackRequest(id)
      setRequest(data)
      setLoading(false)
    }
    loadRequest()
  }, [params])

  const handleMarkInReview = async () => {
    if (!request) return
    startTransition(async () => {
      try {
        await markFeedbackInReview(request.id)
        const { id } = await params
        const updatedRequest = await getFeedbackRequest(id)
        setRequest(updatedRequest)
      } catch (error) {
        console.error('Failed to mark as in review:', error)
      }
    })
  }

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!request || !responseMessage.trim()) return

    const formData = new FormData()
    formData.append('response_message', responseMessage)
    formData.append('response_video_url', responseVideoUrl)

    startTransition(async () => {
      try {
        await submitFeedbackResponse(request.id, formData)
        router.push('/teacher/feedback')
      } catch (error) {
        console.error('Failed to submit response:', error)
      }
    })
  }

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

  if (loading) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Feedback request not found</p>
          <Button asChild>
            <Link href="/teacher/feedback">Back to Feedback</Link>
          </Button>
        </div>
      </div>
    )
  }

  const isCompleted = request.status === 'completed'

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link href="/teacher/feedback">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Feedback
          </Link>
        </Button>
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">Feedback Request</h1>
          {getStatusBadge(request.status)}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Student Request */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Student Request
            </CardTitle>
            <CardDescription>
              Submitted on {request.created_at ? new Date(request.created_at).toLocaleDateString() : 'N/A'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Student</Label>
              <p className="font-medium">{request.profiles?.full_name || 'Anonymous Student'}</p>
              <p className="text-sm text-muted-foreground">{request.profiles?.email}</p>
            </div>

            <div>
              <Label className="text-muted-foreground">Message</Label>
              <p className="mt-1 p-3 bg-muted rounded-lg">
                {request.message || 'No message provided'}
              </p>
            </div>

            {request.video_url && (
              <div>
                <Label className="text-muted-foreground">Video Submission</Label>
                <div className="mt-2">
                  <a
                    href={request.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <Video className="w-4 h-4" />
                    Watch Video
                  </a>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Response Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              {isCompleted ? 'Your Response' : 'Submit Response'}
            </CardTitle>
            <CardDescription>
              {isCompleted
                ? `Responded on ${request.updated_at ? new Date(request.updated_at).toLocaleDateString() : 'N/A'}`
                : 'Provide feedback to help the student improve'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isCompleted ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Your Feedback</Label>
                  <p className="mt-1 p-3 bg-muted rounded-lg">
                    {request.response_message || 'No response message'}
                  </p>
                </div>
                {request.response_video_url && (
                  <div>
                    <Label className="text-muted-foreground">Response Video</Label>
                    <div className="mt-2">
                      <a
                        href={request.response_video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors"
                      >
                        <Video className="w-4 h-4" />
                        View Response Video
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmitResponse} className="space-y-4">
                {request.status === 'pending' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleMarkInReview}
                    disabled={isPending}
                    className="w-full"
                  >
                    {isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Eye className="w-4 h-4 mr-2" />
                    )}
                    Mark as In Review
                  </Button>
                )}

                <div>
                  <Label htmlFor="response_message">Your Feedback *</Label>
                  <Textarea
                    id="response_message"
                    value={responseMessage}
                    onChange={(e) => setResponseMessage(e.target.value)}
                    placeholder="Provide detailed feedback to help the student improve..."
                    rows={6}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="response_video_url">Response Video URL (optional)</Label>
                  <Input
                    id="response_video_url"
                    type="url"
                    value={responseVideoUrl}
                    onChange={(e) => setResponseVideoUrl(e.target.value)}
                    placeholder="https://..."
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Add a link to a video response for more detailed feedback
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={isPending || !responseMessage.trim()}
                  className="w-full"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Submit Response
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
