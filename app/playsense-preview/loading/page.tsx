import Link from 'next/link'
import { notFound } from 'next/navigation'
import { StageLoading } from '@/components/play-sense/stage-highway/stage-loading'
import '@/components/play-sense/stage-highway/highway.css'

/** Holds the real loading panel still for visual review without delaying exercise startup. */
export default function StageLoadingPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <main className="flex h-dvh flex-col bg-background p-3 text-foreground sm:p-5">
    <header className="flex items-center justify-between gap-4 px-2 pb-4 text-xs">
      <span className="text-muted-foreground">PlaySense · Loading preview</span>
      <Link href="/playsense-preview/score" className="rounded-md px-3 py-2 text-primary hover:bg-primary/10">Back to exercise</Link>
    </header>
    <div className="ps-highway border border-border"><StageLoading/></div>
  </main>
}
