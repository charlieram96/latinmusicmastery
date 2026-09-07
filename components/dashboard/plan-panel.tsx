'use client'

import Link from 'next/link'
import { Crown, Play, Plus, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CourseThumb } from '@/components/dashboard/home/course-list'
import { useTranslation } from '@/components/language-provider'
import { instrumentLabel } from '@/lib/i18n/instruments'
import { formatCents } from '@/lib/payments/pricing-types'
import type { PlanCourse, PlanSummary } from '@/types/dashboard'

const base = 'dashboard.pages.myCourses.plan'

function planCourseCta(course: PlanCourse, t: (k: string) => string) {
  if (course.status === 'completed') return { label: t('dashboard.pages.myCourses.row.review'), icon: RotateCcw, variant: 'outline' as const }
  if (course.status === 'in-progress' || course.pct !== null) return { label: t('dashboard.pages.myCourses.row.resume'), icon: Play, variant: 'outline' as const }
  return { label: t('dashboard.pages.myCourses.row.start'), icon: Play, variant: 'default' as const }
}

/** One subscription: what it costs and renews, and every course it includes. */
export function PlanPanel({ plan }: { plan: PlanSummary }) {
  const { t, locale } = useTranslation()
  const instrument = instrumentLabel(plan.instrument, locale)
  const dateFmt = new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en', { day: 'numeric', month: 'short', year: 'numeric' })
  const interval = plan.interval === 'year' ? t(`${base}.interval.year`) : t(`${base}.interval.month`)
  const price =
    plan.interval === 'year'
      ? t(`${base}.perYear`, { price: formatCents(plan.priceCents, plan.currency) })
      : t(`${base}.perMonth`, { price: formatCents(plan.priceCents, plan.currency) })
  const statusKey = plan.status === 'past_due' ? 'past_due' : plan.status === 'canceled' ? 'canceled' : 'active'
  const when = plan.renewsAt
    ? plan.cancelAtPeriodEnd
      ? t(`${base}.ends`, { date: dateFmt.format(new Date(plan.renewsAt)) })
      : t(`${base}.renews`, { date: dateFmt.format(new Date(plan.renewsAt)) })
    : null
  const addon = formatCents(plan.addonPriceCents, plan.currency)

  return (
    <section
      aria-label={t(`${base}.title`)}
      className="mb-6 grid overflow-hidden rounded-2xl border border-primary/35 bg-card shadow-card md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
    >
      <div className="flex flex-col gap-2.5 border-b border-border bg-[linear-gradient(135deg,hsl(var(--primary)/0.16),transparent_70%)] p-6 md:border-b-0 md:border-r">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{t(`${base}.title`)}</p>
        <h2 className="font-heading text-2xl font-extrabold tracking-tight">
          {instrument} · {interval}
        </h2>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${statusKey === 'active' ? 'bg-success' : statusKey === 'past_due' ? 'bg-warning' : 'bg-muted-foreground'}`}
            aria-hidden
          />
          {[t(`${base}.status.${statusKey}`), when, price].filter(Boolean).join(' · ')}
        </p>
        <p className="text-xs text-muted-foreground">{t(`${base}.note`, { price: addon })}</p>
        <div className="mt-auto flex flex-wrap gap-4 pt-2 text-sm font-semibold text-primary">
          <Link href="/dashboard/subscription" className="hover:underline">
            {t(`${base}.manage`)}
          </Link>
          <Link href="/dashboard/subscription" className="hover:underline">
            {t(`${base}.billing`)}
          </Link>
        </div>
      </div>

      <div className="flex flex-col p-5 md:px-6">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{t(`${base}.included`)}</p>
        <ul className="divide-y divide-border">
          {plan.courses.map((course) => {
            const cta = planCourseCta(course, t)
            const sub =
              course.kind === 'fundamentals'
                ? t(`${base}.fundamentals`, { instrument })
                : t(`${base}.styleCourse`)
            const progress = course.pct !== null ? t(`${base}.pctComplete`, { pct: course.pct }) : null
            return (
              <li key={course.id} className="flex items-center gap-3 py-2.5">
                <CourseThumb src={course.thumbnailUrl} styleName={course.styleName} alt="" className="h-7 w-11" />
                <div className="min-w-0 flex-1">
                  <Link href={course.href} className="block truncate text-sm font-semibold hover:text-primary">
                    {course.title}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">{[sub, progress].filter(Boolean).join(' · ')}</p>
                </div>
                <Button asChild size="sm" variant={cta.variant} className="shrink-0">
                  <Link href={course.resumeHref}>
                    <cta.icon className={cta.icon === Play ? 'fill-current' : ''} aria-hidden />
                    {cta.label}
                  </Link>
                </Button>
              </li>
            )
          })}
        </ul>
        <Link
          href={`/dashboard/courses?instrument=${encodeURIComponent(plan.instrument)}`}
          className="mt-3 flex items-center gap-2.5 rounded-lg border border-dashed border-primary/50 px-3 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/[0.06]"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t(`${base}.addStyle`, { instrument })}
          <span className="ml-auto font-medium text-muted-foreground">{t(`${base}.addPrice`, { price: addon })}</span>
        </Link>
      </div>
    </section>
  )
}

/** Shown instead of the panel when the learner has no subscription yet. */
export function PlanEmptyPanel({ priceCents, currency }: { priceCents: number; currency: string }) {
  const { t } = useTranslation()
  return (
    <section className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-primary/35 bg-card bg-[linear-gradient(135deg,hsl(var(--primary)/0.16),transparent_60%)] p-5 shadow-card">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/[0.14] text-primary">
        <Crown className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-heading text-lg font-bold tracking-tight">{t(`${base}.none.title`)}</h2>
        <p className="text-sm text-muted-foreground">{t(`${base}.none.body`, { price: formatCents(priceCents, currency) })}</p>
      </div>
      <Button asChild>
        <Link href="/dashboard/subscribe">{t(`${base}.none.cta`)}</Link>
      </Button>
    </section>
  )
}
