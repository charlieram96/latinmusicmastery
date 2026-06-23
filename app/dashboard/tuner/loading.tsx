import { Skeleton } from '@/components/ui/skeleton'

export default function TunerLoading() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 pb-8">
      <div>
        <Skeleton className="mb-2 h-8 w-52" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        {/* Main panel */}
        <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card/40 p-5 sm:p-7">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-24 rounded-xl" />
            ))}
          </div>
          <div className="flex flex-col items-center gap-8 py-2">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-28 w-40" />
            <Skeleton className="h-9 w-48 rounded-full" />
          </div>
          <div className="flex gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 flex-1 rounded-xl" />
            ))}
          </div>
        </div>

        {/* Right rail */}
        <div className="flex flex-col gap-5">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      </div>
    </div>
  )
}
