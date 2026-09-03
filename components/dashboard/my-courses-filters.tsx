'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BookOpen, Clock, CheckCircle2, ArrowDownAZ, TrendingUp, History } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'

interface MyCoursesFiltersProps {
  counts: {
    all: number
    inProgress: number
    completed: number
  }
}

export function MyCoursesFilters({ counts }: MyCoursesFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const { t } = useTranslation()

  const filter = searchParams.get('filter') || 'all'
  const sort = searchParams.get('sort') || 'recent'

  const createQueryString = useCallback(
    (params: Record<string, string | null>) => {
      const newParams = new URLSearchParams(searchParams.toString())

      Object.entries(params).forEach(([key, value]) => {
        if (value === null || value === '') {
          newParams.delete(key)
        } else {
          newParams.set(key, value)
        }
      })

      return newParams.toString()
    },
    [searchParams]
  )

  const updateParams = (params: Record<string, string | null>) => {
    startTransition(() => {
      const queryString = createQueryString(params)
      router.push(`/dashboard/my-courses${queryString ? `?${queryString}` : ''}`, { scroll: false })
    })
  }

  const filterOptions = [
    { value: 'all', label: t('dashboard.pages.myCourses.filters.all'), icon: BookOpen, count: counts.all },
    { value: 'in-progress', label: t('dashboard.pages.myCourses.filters.inProgress'), icon: Clock, count: counts.inProgress },
    { value: 'completed', label: t('dashboard.pages.myCourses.filters.completed'), icon: CheckCircle2, count: counts.completed },
  ]

  const sortOptions = [
    { value: 'recent', label: t('dashboard.pages.myCourses.filters.sort.recent'), icon: History },
    { value: 'progress', label: t('dashboard.pages.myCourses.filters.sort.progress'), icon: TrendingUp },
    { value: 'alphabetical', label: t('dashboard.pages.myCourses.filters.sort.alphabetical'), icon: ArrowDownAZ },
  ]

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      {/* Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {filterOptions.map((option) => {
          const Icon = option.icon
          const isActive = filter === option.value
          return (
            <Button
              key={option.value}
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              className="gap-2"
              onClick={() => updateParams({ filter: option.value === 'all' ? null : option.value })}
              disabled={isPending}
            >
              <Icon className="h-4 w-4" />
              {option.label}
              <Badge
                variant={isActive ? 'secondary' : 'outline'}
                className="ml-1 h-5 px-1.5 text-xs"
              >
                {option.count}
              </Badge>
            </Button>
          )
        })}
      </div>

      {/* Sort Dropdown */}
      <Select
        value={sort}
        onValueChange={(value) => updateParams({ sort: value === 'recent' ? null : value })}
        disabled={isPending}
      >
        <SelectTrigger className="w-[180px] h-9 bg-secondary border-0">
          <SelectValue placeholder={t('dashboard.pages.myCourses.filters.sortPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((option) => {
            const Icon = option.icon
            return (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {option.label}
                </div>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </div>
  )
}
