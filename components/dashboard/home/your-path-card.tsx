'use client'

import Link from 'next/link'
import { ChevronRight, Route } from 'lucide-react'
import { PathStrip } from '@/components/course/path-strip'
import { useTranslation } from '@/components/language-provider'
import type { YourPath } from '@/lib/dashboard/your-path'

const BASE = 'dashboard.pages.home.path'

/**
 * A short slice of the lesson path under the Continue card: the last lessons
 * done, the current one, the next few and the module checkpoint. Phones get
 * a 5-node slice.
 */
export function YourPathCard({ path }: { path: YourPath | null }) {
  const { t } = useTranslation()
  if (!path) return null
  const label = t(`${BASE}.title`)

  return (
    <section aria-labelledby="home-path" className="rounded-xl border border-border bg-card px-4 pb-1 pt-3.5 shadow-card sm:px-5">
      {/* Above the strip: the strip's empty top band is pulled up under this row. */}
      <div className="relative z-10 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/[0.14] text-primary">
          <Route className="h-4 w-4" aria-hidden />
        </span>
        <h2 id="home-path" className="shrink-0 text-base font-semibold">
          {label}
        </h2>
        {/* Phones: its own line under the title (after the course map link); sm+: inline after the title. */}
        <span data-path-module className="order-last min-w-0 basis-full truncate pl-9 text-[13px] text-muted-foreground sm:order-none sm:basis-auto sm:pl-0">
          <span aria-hidden className="hidden sm:inline">· </span>
          {path.moduleTitle
            ? t(`${BASE}.module`, { n: path.moduleNumber, title: path.moduleTitle })
            : t(`${BASE}.moduleOnly`, { n: path.moduleNumber })}
        </span>
        <Link
          href={path.courseHref}
          className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          {t(`${BASE}.courseMap`)}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
      <PathStrip items={path.items} size="compact" ariaLabel={label} className="-mb-3 hidden md:block" />
      <PathStrip items={path.phoneItems} size="compact" ariaLabel={label} className="-mb-3 md:hidden" />
    </section>
  )
}
