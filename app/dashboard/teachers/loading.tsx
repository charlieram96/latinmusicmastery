import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

export default function TeachersLoading() {
  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <Skeleton className="h-9 w-40 mb-2" />
        <Skeleton className="h-5 w-96 mb-6" />

        {/* Quick Stats */}
        <div className="flex flex-wrap gap-4">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-44" />
          <Skeleton className="h-10 w-36" />
        </div>
      </div>

      {/* Teachers Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center">
                <Skeleton className="w-24 h-24 rounded-full mb-4" />
                <Skeleton className="h-5 w-32 mb-1" />
                <Skeleton className="h-4 w-20 mb-3" />
                <div className="flex gap-1.5 mb-3">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-14" />
                </div>
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-3/4 mb-3" />
                <div className="flex items-center justify-between w-full pt-3 border-t border-border">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
