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
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((i) => (
          <Card key={i} className="overflow-hidden p-0 gap-0 relative">
            {/* Left accent stripe */}
            <div className="absolute left-0 top-0 bottom-0 w-0.5">
              <Skeleton className="h-full w-full rounded-none" />
            </div>

            {/* Thumbnail */}
            <div className="relative aspect-[4/3]">
              <Skeleton className="h-full w-full rounded-none" />
              {/* Progress ring placeholder */}
              <div className="absolute bottom-1.5 right-1.5">
                <Skeleton className="h-10 w-10 rounded-full" />
              </div>
            </div>

            {/* Content */}
            <div className="p-2.5">
              {/* Teacher row */}
              <div className="flex items-center gap-1.5 mb-1">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-2.5 w-16" />
              </div>

              {/* Title */}
              <Skeleton className="h-3 w-full mb-1" />
              <Skeleton className="h-3 w-3/4 mb-1.5" />

              {/* Module line */}
              <Skeleton className="h-2.5 w-12 mb-1" />
              <Skeleton className="h-2.5 w-4/5 mb-1.5" />

              {/* Thin progress bar */}
              <Skeleton className="h-0.5 w-full rounded-full" />
              <Skeleton className="h-2 w-14 mt-1" />
            </div>
          </Card>
        ))}
      </div>
    </>
  )
}
