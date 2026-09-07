'use client'

import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Video, Upload, Clock, CheckCircle, MessageSquare } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'

interface FeedbackViewProps {
  feedbackRequests: any[] | null
  teachers: any[] | null
}

export function FeedbackView({ feedbackRequests, teachers }: FeedbackViewProps) {
  const { t, locale } = useTranslation()

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" /> {t('dashboard.pages.feedback.status.pending')}
          </Badge>
        )
      case 'in_review':
        return (
          <Badge className="gap-1 bg-primary/20 text-primary">
            <MessageSquare className="h-3 w-3" /> {t('dashboard.pages.feedback.status.inReview')}
          </Badge>
        )
      case 'completed':
        return (
          <Badge className="gap-1 bg-success/[0.14] text-success">
            <CheckCircle className="h-3 w-3" /> {t('dashboard.pages.feedback.status.completed')}
          </Badge>
        )
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <>
      <PageHeader
        title={t('dashboard.pages.feedback.title')}
        description={t('dashboard.pages.feedback.subtitle')}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Request Feedback Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              {t('dashboard.pages.feedback.request.title')}
            </CardTitle>
            <CardDescription>
              {t('dashboard.pages.feedback.request.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">{t('dashboard.pages.feedback.request.selectTeacher')}</label>
                <select className="w-full h-10 px-3 rounded-md bg-secondary border-0 text-sm">
                  <option value="">{t('dashboard.pages.feedback.request.chooseTeacher')}</option>
                  {teachers?.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name} - {teacher.instrument}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">{t('dashboard.pages.feedback.request.uploadVideo')}</label>
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                  <Video className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {t('dashboard.pages.feedback.request.uploadPrompt')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('dashboard.pages.feedback.request.uploadFormats')}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">{t('dashboard.pages.feedback.request.messageLabel')}</label>
                <textarea
                  placeholder={t('dashboard.pages.feedback.request.messagePlaceholder')}
                  className="w-full min-h-[100px] px-3 py-2 rounded-md bg-secondary border-0 text-sm resize-none"
                />
              </div>

              <Button className="w-full" disabled>
                <Upload className="h-4 w-4 mr-2" />
                {t('dashboard.pages.feedback.request.submit')}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                {t('dashboard.pages.feedback.request.comingSoon')}
              </p>
            </form>
          </CardContent>
        </Card>

        {/* Feedback History */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold">{t('dashboard.pages.feedback.history.title')}</h2>

          {!feedbackRequests || feedbackRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Video className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">{t('dashboard.pages.feedback.history.emptyTitle')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('dashboard.pages.feedback.history.emptySubtitle')}
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
                            {t('dashboard.pages.feedback.history.fromTeacher', {
                              name: request.teachers?.name || t('dashboard.pages.feedback.history.teacherFallback'),
                            })}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(request.created_at).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>

                    {request.message && (
                      <p className="mt-3 text-sm text-muted-foreground">
                        &quot;{request.message}&quot;
                      </p>
                    )}

                    {request.status === 'completed' && request.response_message && (
                      <div className="mt-4 p-3 rounded-lg bg-success/10 border border-success/20">
                        <p className="text-sm font-medium text-success mb-1">
                          {t('dashboard.pages.feedback.history.teacherResponse')}
                        </p>
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
