import { Skeleton } from '@/components/ui/skeleton'

/** Mirrors the My Progress layout: header, four tiles, chart + activity, calendar + courses. */
export default function ProgressLoading() {
  return (
    <div aria-busy>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <Skeleton className="h-9 w-48 rounded-lg" />
          <Skeleton className="mt-3 h-4 w-80 rounded" />
        </div>
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[108px] rounded-xl" />
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
        <div className="min-w-0 space-y-8">
          <Skeleton className="h-[280px] rounded-xl" />
          <div className="space-y-3">
            <Skeleton className="h-6 w-44 rounded-md" />
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <Skeleton className="h-4 w-4 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2 rounded" />
                  <Skeleton className="h-3 w-1/3 rounded" />
                </div>
                <Skeleton className="h-3 w-12 rounded" />
              </div>
            ))}
          </div>
        </div>
        <aside className="space-y-4">
          <Skeleton className="h-[380px] rounded-xl" />
          <Skeleton className="h-[160px] rounded-xl" />
        </aside>
      </div>
    </div>
  )
}
