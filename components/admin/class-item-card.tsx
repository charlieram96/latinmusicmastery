'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  GripVertical,
  Video,
  HelpCircle,
  FileQuestion,
  Music,
  Pencil,
  Trash2,
} from 'lucide-react'
import { ClassItem } from '@/types/modules'

interface ClassItemCardProps {
  item: ClassItem
  onEdit: (item: ClassItem) => void
  onDelete: (itemId: string) => void
}

function getItemConfig(itemType: ClassItem['item_type']) {
  switch (itemType) {
    case 'VIDEO':
      return {
        icon: Video,
        color: '#3b82f6',
        bgColor: 'bg-blue-500/10',
        textColor: 'text-blue-500',
        label: 'Video',
      }
    case 'QUIZ':
      return {
        icon: HelpCircle,
        color: '#a855f7',
        bgColor: 'bg-purple-500/10',
        textColor: 'text-purple-500',
        label: 'Quiz',
      }
    case 'EXERCISE':
      return {
        icon: FileQuestion,
        color: '#22c55e',
        bgColor: 'bg-green-500/10',
        textColor: 'text-green-500',
        label: 'Exercise',
      }
    case 'JAM_SESSION':
      return {
        icon: Music,
        color: '#f97316',
        bgColor: 'bg-orange-500/10',
        textColor: 'text-orange-500',
        label: 'Jam Session',
      }
    default:
      return {
        icon: Video,
        color: '#6b7280',
        bgColor: 'bg-gray-500/10',
        textColor: 'text-gray-500',
        label: itemType,
      }
  }
}

export function ClassItemCard({ item, onEdit, onDelete }: ClassItemCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const config = getItemConfig(item.item_type)
  const Icon = config.icon

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group flex items-center gap-2 p-2 border rounded-lg bg-card
        hover:bg-muted/50 transition-colors
        ${isDragging ? 'opacity-50' : ''}
      `}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="p-1 rounded cursor-grab active:cursor-grabbing hover:bg-muted transition-colors"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Colored Icon Circle */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${config.bgColor}`}
      >
        <Icon className="w-4 h-4" style={{ color: config.color }} />
      </div>

      {/* Title and Badge */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-sm font-medium truncate">{item.title}</span>
        <Badge
          variant="outline"
          className={`${config.bgColor} border-transparent text-xs shrink-0`}
          style={{ color: config.color }}
        >
          {config.label}
        </Badge>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(item)}
          className="h-7 w-7 p-0 hover:bg-primary/10 hover:text-primary"
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(item.id)}
          className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}

export function ClassItemCardDragOverlay({ item }: { item: ClassItem }) {
  const config = getItemConfig(item.item_type)
  const Icon = config.icon

  return (
    <div className="flex items-center gap-2 p-2 border rounded-lg bg-card shadow-lg scale-105">
      {/* Drag Handle */}
      <div className="p-1 rounded bg-muted">
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>

      {/* Colored Icon Circle */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${config.bgColor}`}
      >
        <Icon className="w-4 h-4" style={{ color: config.color }} />
      </div>

      {/* Title and Badge */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-sm font-medium truncate">{item.title}</span>
        <Badge
          variant="outline"
          className={`${config.bgColor} border-transparent text-xs shrink-0`}
          style={{ color: config.color }}
        >
          {config.label}
        </Badge>
      </div>
    </div>
  )
}
