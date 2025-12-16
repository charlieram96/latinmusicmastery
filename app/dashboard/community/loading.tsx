import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function CommunityLoading() {
  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <Skeleton className="h-9 w-40 mb-2" />
        <Skeleton className="h-5 w-80" />
      </div>

      {/* Discord CTA Skeleton */}
      <Card className="mb-8">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <Skeleton className="h-20 w-20 rounded-2xl" />
            <div className="flex-1 text-center md:text-left">
              <Skeleton className="h-8 w-64 mb-2 mx-auto md:mx-0" />
              <Skeleton className="h-4 w-full max-w-xl mb-2" />
              <Skeleton className="h-4 w-3/4 max-w-xl mb-4" />
              <Skeleton className="h-11 w-48 mx-auto md:mx-0" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature Cards Skeleton */}
      <div className="grid gap-6 md:grid-cols-3 mb-8">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-12 w-12 rounded-xl mb-3" />
              <Skeleton className="h-5 w-40 mb-2" />
              <Skeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Guidelines Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </CardContent>
      </Card>
    </>
  )
}
