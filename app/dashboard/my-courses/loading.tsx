import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

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
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="overflow-hidden">
            <div className="relative aspect-video">
              <Skeleton className="h-full w-full" />
              {/* Progress Ring Placeholder */}
              <div className="absolute bottom-3 right-3">
                <Skeleton className="h-14 w-14 rounded-full" />
              </div>
              {/* Status Badge Placeholder */}
              <div className="absolute top-3 left-3">
                <Skeleton className="h-6 w-24" />
              </div>
            </div>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-4 w-12" />
              </div>
              <Skeleton className="h-5 w-full mb-2" />
              <div className="mb-3">
                <Skeleton className="h-1.5 w-full rounded-full" />
                <Skeleton className="h-3 w-32 mt-1.5" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-7 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
