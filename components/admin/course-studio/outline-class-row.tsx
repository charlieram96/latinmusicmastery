'use client'
import { useTranslation } from '@/components/language-provider'
import { pick } from '@/lib/i18n/localize'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Unlock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ClassWithItems } from './types'

interface OutlineClassRowProps {
  cls: ClassWithItems
  index: number
  selected: boolean
  onSelect: () => void
}

export function OutlineClassRow({ cls, index, selected, onSelect }: OutlineClassRowProps) {
  const { locale } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cls.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('group relative', isDragging && 'z-10 opacity-60')}
    >
      {selected && (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary" />
      )}
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg py-1.5 pl-3 pr-1.5 text-left transition-colors',
          selected
            ? 'bg-primary/10 text-primary'
            : 'text-foreground/70 hover:bg-foreground/[0.045] hover:text-foreground'
        )}
      >
        <span
          className={cn(
            'w-4 flex-shrink-0 text-right text-[11px] tabular-nums',
            selected ? 'text-primary/70' : 'text-muted-foreground/60'
          )}
        >
          {index + 1}
        </span>
        <span className={cn('min-w-0 flex-1 truncate text-[13px]', selected && 'font-medium')}>
          {pick(locale, cls.title, cls.title_es ?? '')}
        </span>
        {cls.is_free && (
          <Unlock className="h-3 w-3 flex-shrink-0 text-gold" aria-label="Free preview" />
        )}
        <span
          className={cn(
            'flex-shrink-0 rounded-md px-1.5 py-0.5 text-[10px] tabular-nums',
            selected ? 'bg-primary/10 text-primary/80' : 'bg-foreground/[0.05] text-muted-foreground'
          )}
        >
          {cls.items.length}
        </span>
        <span
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="flex h-5 w-4 flex-shrink-0 cursor-grab items-center justify-center text-muted-foreground/0 transition-colors active:cursor-grabbing group-hover:text-muted-foreground/60"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
      </button>
    </div>
  )
}
