import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: ReactNode
  body?: ReactNode
  /** A single call to action, usually a Button wrapping a Link. */
  action?: ReactNode
  className?: string
}

/** The one empty-state recipe for dashboard pages: dashed frame, icon chip, title, body, one action. */
export function EmptyState({ icon: Icon, title, body, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-14 text-center',
        className
      )}
    >
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="font-heading text-lg font-bold tracking-tight">{title}</h3>
      {body ? <p className="mt-1.5 max-w-md text-balance text-sm text-muted-foreground">{body}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}
