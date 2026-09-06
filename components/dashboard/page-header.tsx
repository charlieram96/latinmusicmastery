import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  /** Small line above the title: an eyebrow or breadcrumb. */
  crumb?: ReactNode
  /** Right-aligned controls (buttons, links). */
  actions?: ReactNode
  /** Extra content under the title row (stats, tabs, filters). */
  children?: ReactNode
  className?: string
}

/**
 * The one page-title recipe for dashboard pages. Works in server and client
 * components; pass already-translated strings.
 */
export function PageHeader({ title, description, crumb, actions, children, className }: PageHeaderProps) {
  return (
    <header className={cn('mb-8 flex flex-col gap-5', className)}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {crumb ? <div className="mb-1.5 text-xs font-medium text-muted-foreground">{crumb}</div> : null}
          <h1 className="text-balance font-heading text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
          {description ? <p className="mt-2 max-w-[60ch] text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </header>
  )
}
