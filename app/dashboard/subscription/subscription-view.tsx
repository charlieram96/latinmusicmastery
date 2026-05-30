'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  Music, Plus, X, AlertCircle, CreditCard, Crown,
} from 'lucide-react'
import { formatCents, type PricingMap } from '@/lib/payments/pricing-types'
import { ManageSubscriptionButton } from '@/components/manage-subscription-button'
import { removeCourseFromSubscription, cancelInstrument } from '@/app/actions/billing'

interface CourseRef {
  id: string
  title: string
  slug: string | null
  instrument: string | null
}

interface SubscriptionCourseRow {
  id: string
  course: CourseRef | null
}

interface SubRow {
  id: string
  instrument: string
  billing_interval: string
  status: string
  base_current_period_end: string | null
  addon_current_period_end: string | null
  cancel_at_period_end: boolean
  pending_interval: string | null
  stripe_addon_subscription_id: string | null
  subscription_courses: SubscriptionCourseRow[] | null
}

interface SubscriptionViewProps {
  subs: SubRow[]
  fundamentalsByInstrument: Record<string, { id: string; title: string; slug: string }>
  prices: PricingMap
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function SubscriptionView({ subs, fundamentalsByInstrument, prices }: SubscriptionViewProps) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleRemoveCourse(courseId: string) {
    if (!confirm('Remove this course from your plan? This will reduce your monthly bill.')) return
    setError(null)
    startTransition(async () => {
      const res = await removeCourseFromSubscription(courseId)
      if (res.error) setError(res.error)
    })
  }

  function handleCancelInstrument(instrument: string) {
    if (!confirm(`Cancel your ${instrument} subscription at the end of the current period? You'll keep access until then.`)) return
    setError(null)
    startTransition(async () => {
      const res = await cancelInstrument(instrument)
      if (res.error) setError(res.error)
    })
  }

  if (subs.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-6 md:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">My subscription</h1>
          <p className="mt-2 text-muted-foreground">
            You don&apos;t have any active subscriptions yet.
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-8 text-center">
          <Crown className="mx-auto mb-3 h-8 w-8 text-primary" />
          <h2 className="mb-2 text-lg font-semibold">Start an instrument</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Get the instrument&apos;s fundamentals course plus one genre course from{' '}
            <strong>{formatCents(prices.base_monthly.amount_cents)}/mo</strong>.
          </p>
          <Button asChild size="lg">
            <Link href="/dashboard/subscribe">Choose a plan</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">My subscription</h1>
        <p className="mt-2 text-muted-foreground">
          One subscription per instrument. Add more genres any time.
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-6">
        {subs.map((sub) => {
          const fundamentals = fundamentalsByInstrument[sub.instrument]
          const courses = (sub.subscription_courses ?? [])
            .map((sc) => sc.course)
            .filter((c): c is CourseRef => !!c)
          const isCanceling = sub.cancel_at_period_end
          const monthly = sub.billing_interval === 'month'
          const addonCount = Math.max(0, courses.length - 1)
          const periodTotalCents = monthly
            ? prices.base_monthly.amount_cents + addonCount * prices.addon_monthly.amount_cents
            : prices.base_annual.amount_cents + addonCount * prices.addon_monthly.amount_cents

          return (
            <div key={sub.id} className="rounded-2xl border bg-card overflow-hidden">
              <div className="border-b bg-muted/30 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Music className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="font-semibold leading-tight">{sub.instrument}</h2>
                    <p className="text-xs text-muted-foreground">
                      {monthly ? 'Monthly' : 'Annual'} · {sub.status}
                      {isCanceling && ' · cancels at period end'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">{formatCents(periodTotalCents)}{monthly ? '/mo' : '/yr'}</div>
                  <div className="text-xs text-muted-foreground">
                    Next renewal: {fmtDate(sub.base_current_period_end)}
                  </div>
                  {!monthly && sub.stripe_addon_subscription_id && (
                    <div className="text-xs text-muted-foreground">
                      Add-on renewal: {fmtDate(sub.addon_current_period_end)}
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 space-y-3">
                {/* Fundamentals (included) */}
                {fundamentals && (
                  <div className="flex items-center justify-between rounded-lg border bg-background px-4 py-3">
                    <div>
                      <div className="text-sm font-medium">
                        <Link href={`/dashboard/course/${fundamentals.slug || fundamentals.id}`} className="hover:underline">
                          {fundamentals.title}
                        </Link>
                      </div>
                      <div className="text-xs text-muted-foreground">Fundamentals · included</div>
                    </div>
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                      Included
                    </span>
                  </div>
                )}

                {/* Genre courses */}
                {courses.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No genre courses on this plan yet.</p>
                ) : (
                  courses.map((course, idx) => {
                    const isFirstGenre = idx === 0 // first genre is bundled into the base
                    return (
                      <div key={course.id} className="flex items-center justify-between rounded-lg border bg-background px-4 py-3">
                        <div>
                          <div className="text-sm font-medium">
                            <Link href={`/dashboard/course/${course.slug || course.id}`} className="hover:underline">
                              {course.title}
                            </Link>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {isFirstGenre
                              ? 'Genre · included with base'
                              : `Genre · +${formatCents(prices.addon_monthly.amount_cents)}/mo`}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() => handleRemoveCourse(course.id)}
                          title={isFirstGenre ? 'Removing the last genre cancels the instrument' : 'Remove this genre'}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )
                  })
                )}
              </div>

              <div className="border-t bg-muted/20 px-6 py-3 flex flex-wrap items-center justify-between gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/dashboard/subscribe?instrument=${encodeURIComponent(sub.instrument)}`}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add a genre
                  </Link>
                </Button>
                <div className="flex items-center gap-2">
                  <ManageSubscriptionButton />
                  {!isCanceling && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => handleCancelInstrument(sub.instrument)}
                      className="text-destructive hover:text-destructive"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        <CreditCard className="mr-1 inline h-3 w-3" />
        Payment details and invoices are managed in the Stripe customer portal — click <strong>Manage</strong> above.
      </p>
    </div>
  )
}
