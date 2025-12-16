import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

export default function AchievementsLoading() {
  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <Skeleton className="h-9 w-44 mb-2" />
        <Skeleton className="h-5 w-80" />
      </div>

      {/* Overall Progress Card */}
      <Card className="mb-8 overflow-hidden">
        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <Skeleton className="h-20 w-20 rounded-2xl" />
            <div className="flex-1">
              <Skeleton className="h-8 w-72 mb-2" />
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="flex gap-4">
              <Skeleton className="h-16 w-20 rounded-lg" />
              <Skeleton className="h-16 w-20 rounded-lg" />
              <Skeleton className="h-16 w-20 rounded-lg" />
            </div>
          </div>
        </div>
      </Card>

      {/* Categories */}
      {[1, 2, 3].map((category) => (
        <div key={category} className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-6 w-12" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-14 w-14 rounded-xl" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-24 mb-1" />
                      <Skeleton className="h-3 w-full mb-2" />
                      <Skeleton className="h-1.5 w-full mb-1" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}
