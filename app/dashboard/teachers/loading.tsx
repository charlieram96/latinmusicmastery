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
          <div key={i} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start gap-4">
              <Skeleton className="h-16 w-16 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2 pt-1">
                <Skeleton className="h-4 w-2/3 rounded" />
                <Skeleton className="h-3 w-1/2 rounded" />
                <div className="flex gap-1 pt-1">
                  <Skeleton className="h-5 w-12 rounded-md" />
                  <Skeleton className="h-5 w-14 rounded-md" />
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-1.5">
              <Skeleton className="h-3 w-full rounded" />
              <Skeleton className="h-3 w-11/12 rounded" />
              <Skeleton className="h-3 w-2/3 rounded" />
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <Skeleton className="h-6 w-24 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
