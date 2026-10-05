import { AdminText } from '@/components/admin/admin-text'
import { Skeleton } from '@/components/ui/skeleton'

export default function CoursesLoading() {
  return (
    <div className="p-6 lg:p-8" aria-busy="true">
      <div className="mb-8">
        <h1 className="mb-1 text-4xl font-bold tracking-tight"><AdminText text={"Courses"} /></h1>
        <p role="status" className="text-muted-foreground"><AdminText text={"Loading courses…"} /></p>
      </div>
      <Skeleton className="mb-6 h-10 w-full max-w-md" />
      <Skeleton className="mb-6 h-8 w-full max-w-xl" />
      <div aria-hidden className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
            <Skeleton className="aspect-video w-full rounded-none" />
            <div className="space-y-3 p-4">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
