import { Skeleton } from '@/components/ui/skeleton'

/** Mirrors the Teachers layout: header with stats, instrument chips, avatar-led cards. */
export default function TeachersLoading() {
  return (
    <div aria-busy>
      <div className="mb-8 flex flex-col gap-5">
        <div>
          <Skeleton className="h-9 w-64 rounded-lg" />
          <Skeleton className="mt-3 h-4 w-[28rem] max-w-full rounded" />
        </div>
        <div className="flex gap-6">
          <Skeleton className="h-4 w-36 rounded" />
          <Skeleton className="h-4 w-40 rounded" />
          <Skeleton className="h-4 w-32 rounded" />
        </div>
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {[24, 16, 18, 14, 20, 16].map((w, i) => (
          <Skeleton key={i} className="h-7 rounded-full" style={{ width: `${w * 4}px` }} />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-start gap-4">
              <Skeleton className="h-[124px] w-[124px] shrink-0 rounded-none" />
              <div className="flex-1 space-y-2 pr-4 pt-5">
                <Skeleton className="h-4 w-2/3 rounded" />
                <Skeleton className="h-3 w-1/2 rounded" />
                <div className="flex gap-1 pt-1">
                  <Skeleton className="h-5 w-12 rounded-md" />
                  <Skeleton className="h-5 w-14 rounded-md" />
                </div>
              </div>
            </div>
            <div className="mt-3 space-y-1.5 px-4">
              <Skeleton className="h-3 w-full rounded" />
              <Skeleton className="h-3 w-11/12 rounded" />
              <Skeleton className="h-3 w-2/3 rounded" />
            </div>
            <div className="mx-4 mt-3.5 flex items-center justify-between border-t border-border pb-4 pt-3.5">
              <Skeleton className="h-6 w-24 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
