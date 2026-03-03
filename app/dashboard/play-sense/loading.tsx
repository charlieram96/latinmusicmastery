import { Card } from '@/components/ui/card'

export default function Loading() {
  return (
    <>
      <div className="mb-8">
        <div className="h-9 w-48 bg-muted rounded animate-pulse" />
        <div className="h-5 w-72 bg-muted rounded animate-pulse mt-2" />
      </div>

      <div className="max-w-4xl space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4">
            <div className="space-y-2">
              <div className="h-5 w-64 bg-muted rounded animate-pulse" />
              <div className="h-4 w-96 bg-muted rounded animate-pulse" />
              <div className="flex gap-2 mt-2">
                <div className="h-5 w-16 bg-muted rounded animate-pulse" />
                <div className="h-5 w-20 bg-muted rounded animate-pulse" />
                <div className="h-5 w-16 bg-muted rounded animate-pulse" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  )
}
