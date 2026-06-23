'use client'

import { cn } from '@/lib/utils'

/** Segmented progress bar — one segment per question. */
export function ProgressSegments({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-1 gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                i < current && 'w-full bg-primary',
                i === current && 'w-full bg-primary/40',
                i > current && 'w-0',
              )}
            />
          </div>
        ))}
      </div>
      <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
        {Math.min(current + 1, total)} / {total}
      </span>
    </div>
  )
}
