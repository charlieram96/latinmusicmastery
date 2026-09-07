'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { ArrowDownAZ, History, TrendingUp } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'

export type MyCoursesFilter = 'all' | 'in-progress' | 'completed'
export type MyCoursesSort = 'recent' | 'progress' | 'alphabetical'

interface MyCoursesToolbarProps {
  counts: { all: number; inProgress: number; completed: number }
  filter: MyCoursesFilter
  sort: MyCoursesSort
}

function hrefFor(filter: MyCoursesFilter, sort: MyCoursesSort) {
  const params = new URLSearchParams()
  if (filter !== 'all') params.set('filter', filter)
  if (sort !== 'recent') params.set('sort', sort)
  const qs = params.toString()
  return `/dashboard/my-courses${qs ? `?${qs}` : ''}`
}

/** Segmented status filter (links, so the server re-renders) plus a sort select. */
export function MyCoursesToolbar({ counts, filter, sort }: MyCoursesToolbarProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const filters: { value: MyCoursesFilter; label: string; count: number }[] = [
    { value: 'all', label: t('dashboard.pages.myCourses.filters.all'), count: counts.all },
    { value: 'in-progress', label: t('dashboard.pages.myCourses.filters.inProgress'), count: counts.inProgress },
    { value: 'completed', label: t('dashboard.pages.myCourses.filters.completed'), count: counts.completed },
  ]
  const sorts: { value: MyCoursesSort; label: string; icon: typeof History }[] = [
    { value: 'recent', label: t('dashboard.pages.myCourses.filters.sort.recent'), icon: History },
    { value: 'progress', label: t('dashboard.pages.myCourses.filters.sort.progress'), icon: TrendingUp },
    { value: 'alphabetical', label: t('dashboard.pages.myCourses.filters.sort.alphabetical'), icon: ArrowDownAZ },
  ]

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label={t('dashboard.pages.myCourses.filters.label')} className="inline-flex rounded-lg bg-secondary p-1">
        {filters.map((f) => {
          const active = f.value === filter
          return (
            <Link
              key={f.value}
              href={hrefFor(f.value, sort)}
              scroll={false}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors',
                active ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {f.label}
              <span
                className={cn(
                  'rounded-full px-1.5 text-xs tabular-nums',
                  active ? 'bg-primary/[0.12] text-primary' : 'bg-foreground/[0.06] text-muted-foreground'
                )}
              >
                {f.count}
              </span>
            </Link>
          )
        })}
      </nav>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{t('dashboard.pages.myCourses.filters.sortLabel')}</span>
        <Select
          value={sort}
          disabled={isPending}
          onValueChange={(value) =>
            startTransition(() => router.push(hrefFor(filter, value as MyCoursesSort), { scroll: false }))
          }
        >
          <SelectTrigger className="h-9 w-[200px]" aria-label={t('dashboard.pages.myCourses.filters.sortLabel')}>
            <SelectValue placeholder={t('dashboard.pages.myCourses.filters.sortPlaceholder')} />
          </SelectTrigger>
          <SelectContent align="end">
            {sorts.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                <span className="flex items-center gap-2">
                  <s.icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                  {s.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
    </div>
  )
}
