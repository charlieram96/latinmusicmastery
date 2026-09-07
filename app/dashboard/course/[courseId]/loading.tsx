import { Skeleton } from '@/components/ui/skeleton'

/** Mirrors the course page: header row, syllabus modules on the left, summary card on the right. */
export default function CourseLoading() {
  return (
    <div aria-busy>
      <Skeleton className="mb-4 h-4 w-32 rounded" />
      <div className="mb-6 flex items-end justify-between gap-5 border-b border-border pb-6">
        <div className="space-y-3">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-10 w-96 max-w-full rounded-lg" />
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-48 rounded" />
          </div>
        </div>
        <Skeleton className="h-11 w-44 rounded-lg" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-7">
          <Skeleton className="h-4 w-[60ch] max-w-full rounded" />
          {[0, 1, 2].map((m) => (
            <div key={m} className="space-y-2">
              <div className="flex items-center gap-3.5">
                <Skeleton className="h-8 w-11 rounded" />
                <Skeleton className="h-5 w-64 rounded" />
              </div>
              {[0, 1].map((l) => (
                <Skeleton key={l} className="ml-[58px] h-[62px] rounded-lg" />
              ))}
            </div>
          ))}
        </div>
        <aside className="hidden lg:block">
          <Skeleton className="h-[520px] rounded-2xl" />
        </aside>
      </div>
    </div>
  )
}
