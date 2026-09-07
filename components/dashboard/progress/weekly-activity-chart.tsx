'use client'

import { useState } from 'react'
import { useTranslation } from '@/components/language-provider'
import type { WeekBucket } from '@/lib/dashboard/progress'
import { cn } from '@/lib/utils'

/**
 * Items completed per week as a small bar chart, with minutes in the hover
 * readout. One scale, thin rounded bars, a dashed average line, and a readout
 * on hover instead of a number on every bar. Built from divs so labels stay
 * crisp at any width.
 */
export function WeeklyActivityChart({ buckets }: { buckets: WeekBucket[] }) {
  const { t, locale } = useTranslation()
  const [hover, setHover] = useState<number | null>(null)

  const max = Math.max(1, ...buckets.map((b) => b.count))
  const total = buckets.reduce((s, b) => s + b.count, 0)
  const avg = buckets.length > 0 ? total / buckets.length : 0
  // Top line always; a midpoint only when it lands on a distinct whole number.
  const ticks = max >= 4 ? [1, 0.5] : [1]
  const fmt = new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en', { month: 'short', day: 'numeric' })
  const label = (b: WeekBucket) =>
    b.isCurrent ? t('dashboard.pages.progress.chart.thisWeek') : fmt.format(new Date(`${b.start}T12:00:00`))
  const readout = (b: WeekBucket) => t('dashboard.pages.progress.chart.tooltip', { count: b.count, minutes: b.minutes })
  const showLabel = (i: number) => i === buckets.length - 1 || (buckets.length - 1 - i) % 4 === 0

  return (
    <div>
      <div className="relative h-44">
        {ticks.map((f) => (
          <div key={f} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${f * 100}%` }}>
            <span className="h-px flex-1 bg-foreground/[0.06]" />
            <span className="w-10 text-right text-[10px] tabular-nums text-muted-foreground">{Math.round(max * f)}</span>
          </div>
        ))}
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2">
          <span className="h-px flex-1 bg-foreground/[0.12]" />
          <span className="w-10 text-right text-[10px] tabular-nums text-muted-foreground">0</span>
        </div>
        {avg > 0 ? (
          <div
            className="absolute left-0 right-12 flex items-end border-t border-dashed border-gold/70"
            style={{ bottom: `${(avg / max) * 100}%` }}
          >
            <span className="mb-0.5 rounded-sm bg-card px-1 text-[10px] font-medium text-gold">
              {t('dashboard.pages.progress.chart.average', { count: Math.round(avg * 10) / 10 })}
            </span>
          </div>
        ) : null}

        <div
          className="absolute inset-y-0 left-0 right-12 flex items-end gap-1.5 sm:gap-2"
          role="img"
          aria-label={t('dashboard.pages.progress.chart.title')}
        >
          {buckets.map((b, i) => {
            const pct = (b.count / max) * 100
            const active = hover === i
            return (
              <div
                key={b.start}
                className="relative flex h-full flex-1 items-end outline-none"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${label(b)}: ${readout(b)}`}
              >
                <div
                  className={cn(
                    'w-full rounded-t-[4px] transition-colors',
                    b.count === 0
                      ? 'bg-foreground/[0.08]'
                      : b.isCurrent
                        ? active
                          ? 'bg-primary'
                          : 'bg-primary/90'
                        : active
                          ? 'bg-primary/80'
                          : 'bg-primary/55'
                  )}
                  style={{ height: b.count === 0 ? 3 : `max(4px, ${pct}%)` }}
                />
                {active ? (
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs shadow-pop">
                    <span className="font-semibold">{label(b)}</span>
                    <span className="text-muted-foreground"> · {readout(b)}</span>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
      <div className="mr-12 mt-2 flex gap-1.5 sm:gap-2">
        {buckets.map((b, i) => (
          <span
            key={b.start}
            className={cn(
              'flex-1 truncate text-center text-[10px] text-muted-foreground',
              b.isCurrent && 'font-semibold text-foreground'
            )}
          >
            {showLabel(i) ? label(b) : ''}
          </span>
        ))}
      </div>
    </div>
  )
}
