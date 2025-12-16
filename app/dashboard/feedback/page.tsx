import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Video, Upload, Clock, CheckCircle, MessageSquare } from 'lucide-react'

export default async function FeedbackPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user's feedback requests
  const { data: feedbackRequests } = await supabase
    .from('feedback_requests')
    .select(`
      *,
      teachers (
        id,
        name,
        image_url,
        instrument
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Get all teachers for the request form
  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, name, image_url, instrument')
    .order('name')

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>
      case 'in_review':
        return <Badge className="gap-1 bg-primary/20 text-primary"><MessageSquare className="h-3 w-3" /> In Review</Badge>
      case 'completed':
        return <Badge className="gap-1 bg-green-500/20 text-green-500"><CheckCircle className="h-3 w-3" /> Completed</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-heading">Teacher Feedback</h1>
        <p className="text-muted-foreground mt-1">
          Upload a video of your playing and get personalized feedback from our expert teachers
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Request Feedback Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Request Feedback
            </CardTitle>
            <CardDescription>
              Upload a video and select a teacher to review your playing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Select Teacher</label>
                <select className="w-full h-10 px-3 rounded-md bg-secondary border-0 text-sm">
                  <option value="">Choose a teacher...</option>
                  {teachers?.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name} - {teacher.instrument}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Upload Video</label>
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                  <Video className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    MP4, MOV up to 100MB
                  </p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Message (Optional)</label>
                <textarea
                  placeholder="Add any questions or context for the teacher..."
                  className="w-full min-h-[100px] px-3 py-2 rounded-md bg-secondary border-0 text-sm resize-none"
                />
              </div>

              <Button className="w-full" disabled>
                <Upload className="h-4 w-4 mr-2" />
                Submit for Review
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Video upload coming soon
              </p>
            </form>
          </CardContent>
        </Card>

        {/* Feedback History */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold">Your Feedback Requests</h2>

          {!feedbackRequests || feedbackRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Video className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">No feedback requests yet</h3>
                <p className="text-sm text-muted-foreground">
                  Upload a video to get personalized feedback from our teachers
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {feedbackRequests.map((request: any) => (
                <Card key={request.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <Video className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">
                            Feedback from {request.teachers?.name || 'Teacher'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(request.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>

                    {request.message && (
                      <p className="mt-3 text-sm text-muted-foreground">
                        "{request.message}"
                      </p>
                    )}

                    {request.status === 'completed' && request.response_message && (
                      <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <p className="text-sm font-medium text-green-500 mb-1">Teacher Response:</p>
                        <p className="text-sm">{request.response_message}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
