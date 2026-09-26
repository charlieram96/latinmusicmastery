'use client'

import Link from 'next/link'
import { Play, Video } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SectionHeader } from '@/components/dashboard/section-header'
import { useTranslation } from '@/components/language-provider'
import { timeAgo } from '@/lib/time-ago'
import type { FeedbackSummary } from '@/types/dashboard'
import { initialsFor } from '@/lib/dashboard/initials'

export function FeedbackCard({ feedback }: { feedback: FeedbackSummary }) {
  const { t, locale } = useTranslation()
  const base = 'dashboard.pages.home.feedback'

  if (feedback.kind === 'none') {
    return (
      <section aria-labelledby="home-feedback">
        <SectionHeader id="home-feedback" title={t(`${base}.title`)} href="/dashboard/feedback" linkLabel={t(`${base}.allReviews`)} />
        <div className="flex flex-col items-start gap-4 rounded-xl border border-border bg-card p-5 shadow-card sm:flex-row sm:items-center">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/[0.14] text-primary">
            <Video className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-heading text-base font-bold tracking-tight">{t(`${base}.inviteTitle`)}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t(`${base}.inviteBody`)}</p>
          </div>
          <Button asChild size="sm">
            <Link href="/dashboard/feedback">{t(`${base}.sendClip`)}</Link>
          </Button>
        </div>
      </section>
    )
  }

  const teacher = feedback.teacherName ?? ''
  const when = feedback.createdAt ? timeAgo(feedback.createdAt, locale === 'es' ? 'es' : 'en') : ''

  return (
    <section aria-labelledby="home-feedback">
      <SectionHeader
        id="home-feedback"
        title={t(`${base}.title`)}
        count={feedback.kind === 'completed' ? t(`${base}.newCount`, { count: 1 }) : undefined}
        href="/dashboard/feedback"
        linkLabel={t(`${base}.allReviews`)}
      />
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-card md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            {feedback.teacherImage ? <AvatarImage src={feedback.teacherImage} alt="" /> : null}
            <AvatarFallback>{initialsFor(teacher)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-heading text-base font-bold tracking-tight">
                {feedback.kind === 'completed' ? t(`${base}.reviewed`, { teacher }) : t(`${base}.pendingWith`, { teacher })}
              </h3>
              {feedback.kind === 'pending' && (
                <Badge variant="warning" className="text-[11px]">
                  {t('dashboard.pages.feedback.status.pending')}
                </Badge>
              )}
            </div>
            {feedback.kind === 'completed' && feedback.message ? (
              <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">“{feedback.message}”</p>
            ) : null}
            {when && <p className="mt-1.5 text-xs text-muted-foreground">{when}</p>}
          </div>
        </div>
        <div className="flex shrink-0 gap-2 md:flex-col md:items-stretch">
          <Button asChild size="sm" variant={feedback.kind === 'completed' ? 'chunky' : 'default'}>
            <Link href="/dashboard/feedback">
              {feedback.kind === 'completed' ? (
                <>
                  {feedback.hasVideo && <Play className="h-3.5 w-3.5 fill-current" />}
                  {feedback.hasVideo ? t(`${base}.watch`) : t(`${base}.read`)}
                </>
              ) : (
                t(`${base}.allReviews`)
              )}
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/feedback">{t(`${base}.sendNew`)}</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
