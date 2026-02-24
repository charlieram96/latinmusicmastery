import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

export default function MyCoursesLoading() {
  return (
    <>
      {/* Page Header */}
      <div className="mb-6">
        <Skeleton className="h-9 w-40 mb-2" />
        <Skeleton className="h-5 w-64" />
      </div>

      {/* Filters Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="h-9 w-[180px]" />
      </div>

      {/* Courses Grid Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="overflow-hidden p-0 gap-0">
            {/* Accent bar */}
            <Skeleton className="h-0.5 w-full rounded-none" />

            {/* Thumbnail */}
            <div className="relative aspect-[16/10]">
              <Skeleton className="h-full w-full rounded-none" />
              {/* Teacher avatar overlay */}
              <div className="absolute bottom-2 left-2">
                <Skeleton className="h-6 w-6 rounded-full" />
              </div>
              {/* Style badge */}
              <div className="absolute bottom-2 right-2">
                <Skeleton className="h-4 w-14 rounded" />
              </div>
            </div>

            {/* Content */}
            <div className="p-3">
              {/* Title */}
              <Skeleton className="h-4 w-3/4 mb-2" />

              {/* Progress block */}
              <div className="bg-muted/50 rounded-lg p-2.5 mb-2 space-y-1.5">
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="h-3 w-full" />
                <div className="border-t border-border/50 my-1.5" />
                <Skeleton className="h-2.5 w-14" />
                <Skeleton className="h-3 w-4/5" />
              </div>

              {/* Progress bar */}
              <Skeleton className="h-1 w-full rounded-full" />
              <Skeleton className="h-2.5 w-24 mt-1" />
            </div>
          </Card>
        ))}
      </div>
    </>
  )
}
