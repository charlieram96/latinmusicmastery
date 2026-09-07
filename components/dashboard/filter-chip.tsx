import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface FilterChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active: boolean
}

/** The one filter-chip recipe: a small pill that tints amber when selected. */
export function FilterChip({ active, className, children, ...props }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'h-7 rounded-full px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        active ? 'bg-primary/[0.12] text-primary' : 'bg-secondary text-muted-foreground hover:text-foreground',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
