import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function ClassViewerLoading() {
  return (
    <>
      {/* Nav skeleton */}
      <div className="border-b bg-background sticky top-0 z-10 -mx-6 -mt-6 mb-6">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div className="h-9 w-32 rounded-md bg-muted animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-40 rounded bg-muted animate-pulse" />
                <div className="h-5 w-56 rounded bg-muted animate-pulse" />
              </div>
            </div>
            <div className="h-9 w-36 rounded-md bg-muted animate-pulse" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step indicator skeleton */}
          <div className="flex items-center gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className="h-9 w-24 rounded-full bg-muted animate-pulse" />
                {i < 3 && <div className="w-4 h-0.5 bg-muted" />}
              </div>
            ))}
          </div>

          {/* Video placeholder */}
          <Card>
            <CardContent className="p-0">
              <div className="aspect-video bg-muted rounded-lg animate-pulse" />
            </CardContent>
          </Card>

          {/* Navigation skeleton */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 h-10 rounded-md bg-muted animate-pulse" />
            <div className="flex-1 h-10 rounded-md bg-muted animate-pulse" />
          </div>
        </div>

        {/* Sidebar skeleton */}
        <div className="lg:col-span-1">
          <Card className="sticky top-20">
            <CardHeader>
              <div className="h-5 w-32 rounded bg-muted animate-pulse" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <div className="h-4 w-4 rounded-full bg-muted animate-pulse" />
                  <div className="h-4 flex-1 rounded bg-muted animate-pulse" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
