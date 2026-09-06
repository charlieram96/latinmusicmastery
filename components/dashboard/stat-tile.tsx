import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface StatTileProps {
  icon: LucideIcon
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  /** Icon chip tint, e.g. `bg-success/[0.14] text-success`. */
  tint?: string
  className?: string
}

/** The one stat-tile recipe: icon chip and label on top, a big heading-face number, a quiet hint. */
export function StatTile({ icon: Icon, label, value, hint, tint = 'bg-primary/[0.14] text-primary', className }: StatTileProps) {
  return (
    <div className={cn('flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card', className)}>
      <div className="flex items-center gap-2">
        <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-md', tint)}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="truncate text-sm text-muted-foreground">{label}</span>
      </div>
      <div>
        <span className="block font-heading text-2xl font-bold tracking-tight tabular-nums">{value}</span>
        {hint ? <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span> : null}
      </div>
    </div>
  )
}
