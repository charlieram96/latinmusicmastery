import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SectionHeaderProps {
  title: string
  /** Small muted text beside the title, e.g. "3 in progress". */
  count?: string | null
  href?: string
  linkLabel?: string
  /** Extra controls (filter chips) rendered after the count. */
  children?: React.ReactNode
  className?: string
}

/** The one section-title recipe for the dashboard: heading face, count, optional link. */
export function SectionHeader({ title, count, href, linkLabel, children, className }: SectionHeaderProps) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-center gap-x-3 gap-y-2', className)}>
      <h2 className="font-heading text-xl font-bold tracking-tight">{title}</h2>
      {count ? <span className="text-sm text-muted-foreground">{count}</span> : null}
      {children}
      {href && linkLabel ? (
        <Link
          href={href}
          className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          {linkLabel}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      ) : null}
    </div>
  )
}
