'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronRight, GripVertical, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { itemMeta } from './item-meta'
import type { ClassItem } from '@/types/modules'

interface ClassItemRowProps {
  item: ClassItem
  active: boolean
  onSelect: () => void
  onDelete: () => void
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function ClassItemRow({ item, active, onSelect, onDelete }: ClassItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })

  const meta = itemMeta(item.item_type)
  const Icon = meta.icon

  const detail =
    item.item_type === 'VIDEO' && item.video_duration_seconds
      ? formatDuration(item.video_duration_seconds)
      : item.item_type === 'JAM_SESSION' && item.bpm
        ? `${item.bpm} BPM${item.key_signature ? ` · ${item.key_signature}` : ''}`
        : null

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('group relative', isDragging && 'z-10 opacity-60')}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect()
          }
        }}
        className={cn(
          'flex w-full cursor-pointer items-center gap-3 rounded-xl border bg-card py-2.5 pl-1.5 pr-2 text-left transition-all duration-150',
          active
            ? 'border-primary/50 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]'
            : 'border-border hover:border-foreground/15 hover:shadow-sm'
        )}
      >
        <span
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          title="Reorder"
          className="flex h-8 w-5 flex-shrink-0 cursor-grab items-center justify-center text-muted-foreground/0 transition-colors active:cursor-grabbing group-hover:text-muted-foreground/50"
        >
          <GripVertical className="h-4 w-4" />
        </span>

        <span
          className={cn(
            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
            meta.bg,
            meta.fg
          )}
        >
          <Icon className="h-4 w-4" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium text-foreground">
            {item.title}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {meta.label}
            {detail && ` · ${detail}`}
            {!detail && item.description && ` · ${item.description}`}
          </span>
        </span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          title="Delete item"
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground/0 transition-colors hover:bg-destructive/10 hover:!text-destructive group-hover:text-muted-foreground/60"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>

        <ChevronRight
          className={cn(
            'h-4 w-4 flex-shrink-0 transition-colors',
            active ? 'text-primary' : 'text-muted-foreground/30 group-hover:text-muted-foreground/60'
          )}
        />
      </div>
    </div>
  )
}
