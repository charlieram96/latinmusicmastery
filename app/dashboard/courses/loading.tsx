import { Skeleton } from '@/components/ui/skeleton'

/** Mirrors Browse: header with search, instrument strip, toolbar, poster grid. */
export default function BrowseCoursesLoading() {
  return (
    <div aria-busy>
      <div className="mb-6 flex flex-col gap-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="mt-2 h-9 w-56 rounded-lg" />
            <Skeleton className="mt-3 h-4 w-[30rem] max-w-full rounded" />
          </div>
          <Skeleton className="h-10 w-72 rounded-lg" />
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} className="h-[92px] rounded-xl" />
          ))}
        </div>
      </div>
      <div className="mb-4 flex items-center gap-2.5">
        <Skeleton className="h-10 w-[360px] rounded-lg" />
        <Skeleton className="h-9 w-40 rounded-lg" />
        <Skeleton className="h-9 w-40 rounded-lg" />
        <span className="flex-1" />
        <Skeleton className="h-9 w-[170px] rounded-lg" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
