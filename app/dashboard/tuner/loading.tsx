import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

export default function TunerLoading() {
  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <Skeleton className="h-9 w-52 mb-2" />
        <Skeleton className="h-5 w-80" />
      </div>

      {/* Main Tuner Card */}
      <Card className="max-w-2xl mx-auto p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-5 w-28" />
        </div>

        {/* Gauge */}
        <div className="flex justify-center mb-6">
          <Skeleton className="h-8 w-full max-w-lg rounded-full" />
        </div>

        {/* Note Display */}
        <div className="flex flex-col items-center gap-2 mb-6">
          <Skeleton className="h-20 w-32" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-5 w-20" />
        </div>

        {/* Button */}
        <Skeleton className="h-12 w-full rounded-lg" />
      </Card>

      {/* Settings Card */}
      <Card className="max-w-2xl mx-auto p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
      </Card>
    </>
  )
}
