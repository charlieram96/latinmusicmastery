import { Skeleton } from '@/components/ui/skeleton'

/** Mirrors the home layout: greeting row, continue card, list + rail. */
export default function DashboardLoading() {
  return (
    <div className="w-full space-y-6 lg:space-y-8" aria-busy>
      <div className="flex items-end justify-between gap-3">
        <Skeleton className="h-9 w-72 rounded-lg" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 w-36 rounded-full" />
        </div>
      </div>

      <Skeleton className="h-[240px] rounded-2xl md:h-[340px]" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
        <div className="min-w-0 space-y-8">
          <div className="space-y-3">
            <Skeleton className="h-6 w-40 rounded-md" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-5 py-2">
                <Skeleton className="h-[45px] w-[72px] rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2 rounded" />
                  <Skeleton className="h-3 w-1/3 rounded" />
                </div>
                <Skeleton className="hidden h-1 w-40 rounded sm:block" />
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <Skeleton className="h-6 w-56 rounded-md" />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
              <Skeleton className="h-[340px] rounded-xl" />
              <div className="space-y-3">
                <Skeleton className="h-[80px] rounded-xl" />
                <Skeleton className="h-[80px] rounded-xl" />
                <Skeleton className="h-[80px] rounded-xl" />
              </div>
            </div>
          </div>
        </div>
        <aside className="space-y-4">
          <Skeleton className="h-[320px] rounded-xl" />
          <Skeleton className="h-[150px] rounded-xl" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-[110px] rounded-xl" />
            <Skeleton className="h-[110px] rounded-xl" />
          </div>
        </aside>
      </div>
    </div>
  )
}
