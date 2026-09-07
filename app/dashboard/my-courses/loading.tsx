import { Skeleton } from '@/components/ui/skeleton'

/** Mirrors the My Courses layout: page header with toolbar, then course rows. */
export default function MyCoursesLoading() {
  return (
    <div aria-busy>
      <div className="mb-8 flex flex-col gap-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <Skeleton className="h-9 w-44 rounded-lg" />
            <Skeleton className="mt-3 h-4 w-72 rounded" />
          </div>
          <Skeleton className="h-10 w-40 rounded-lg" />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-10 w-80 rounded-lg" />
          <Skeleton className="h-9 w-56 rounded-lg" />
        </div>
      </div>
      <div className="divide-y divide-border border-y border-border">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-5 py-4">
            <Skeleton className="h-[60px] w-24 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3 rounded" />
              <Skeleton className="h-3 w-1/4 rounded" />
              <Skeleton className="h-3 w-1/2 rounded" />
            </div>
            <div className="hidden w-44 space-y-2 md:block">
              <Skeleton className="h-1 w-full rounded" />
              <Skeleton className="h-3 w-28 rounded" />
            </div>
            <Skeleton className="hidden h-9 w-[7.5rem] rounded-lg sm:block" />
          </div>
        ))}
      </div>
    </div>
  )
}
