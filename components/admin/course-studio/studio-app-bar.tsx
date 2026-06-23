'use client'

import Link from 'next/link'
import { ArrowLeft, ListTree, Settings2, SlidersHorizontal } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { SaveIndicator } from './save-status'

interface StudioAppBarProps {
  title: string
  isPublished: boolean
  courseSelected: boolean
  onTogglePublish: (published: boolean) => void
  onSelectCourse: () => void
  onOpenOutline: () => void
  onOpenDrawer: () => void
}

export function StudioAppBar({
  title,
  isPublished,
  courseSelected,
  onTogglePublish,
  onSelectCourse,
  onOpenOutline,
  onOpenDrawer,
}: StudioAppBarProps) {
  return (
    <header className="flex h-14 flex-shrink-0 items-center gap-2.5 border-b border-border bg-card/70 px-3 backdrop-blur-sm md:px-4">
      <Link
        href="/admin/courses"
        title="Back to courses"
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>

      <button
        type="button"
        onClick={onOpenOutline}
        title="Course outline"
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground lg:hidden"
      >
        <ListTree className="h-4 w-4" />
      </button>

      <div className="hidden h-6 w-px flex-shrink-0 bg-border sm:block" />

      <button
        type="button"
        onClick={onSelectCourse}
        title="Course settings"
        className={cn(
          'group flex min-w-0 items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors',
          courseSelected ? 'bg-primary/10' : 'hover:bg-accent/10'
        )}
      >
        <div className="flex min-w-0 flex-col">
          <span className="text-[10px] font-semibold uppercase leading-3 tracking-[0.16em] text-gold">
            Course Studio
          </span>
          <h1 className="truncate font-heading text-[15px] font-semibold leading-5 text-foreground">
            {title || 'Untitled course'}
          </h1>
        </div>
        <Settings2
          className={cn(
            'h-3.5 w-3.5 flex-shrink-0 transition-colors',
            courseSelected
              ? 'text-primary'
              : 'text-muted-foreground/0 group-hover:text-muted-foreground'
          )}
        />
      </button>

      <span
        className={cn(
          'ml-1 hidden flex-shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium sm:flex',
          isPublished
            ? 'border-primary/30 bg-primary/10 text-primary'
            : 'border-border bg-muted/40 text-muted-foreground'
        )}
      >
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            isPublished ? 'bg-primary' : 'bg-muted-foreground/50'
          )}
        />
        {isPublished ? 'Published' : 'Draft'}
      </span>

      <div className="ml-auto flex flex-shrink-0 items-center gap-3">
        <SaveIndicator />

        <button
          type="button"
          onClick={onOpenDrawer}
          title="Inspector"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground lg:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>

        <div className="h-6 w-px bg-border" />

        <label className="flex cursor-pointer items-center gap-2">
          <span className="hidden text-xs font-medium text-muted-foreground md:inline">
            Publish
          </span>
          <Switch checked={isPublished} onCheckedChange={onTogglePublish} />
        </label>
      </div>
    </header>
  )
}
