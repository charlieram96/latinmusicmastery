import { AdminText } from '@/components/admin/admin-text'
import { Loader2 } from 'lucide-react'

export default function StudioLoading() {
  return <div className="flex min-h-[80dvh] items-center justify-center bg-background" aria-busy="true">
    <div role="status" className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-6 py-5">
      <Loader2 aria-hidden className="h-5 w-5 animate-spin text-primary" />
      <span className="font-medium"><AdminText text={"Opening PlaySense Studio…"} /></span>
    </div>
  </div>
}
