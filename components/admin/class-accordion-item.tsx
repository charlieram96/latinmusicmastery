'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { AccordionContent, AccordionItem } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  GripVertical,
  ChevronDown,
  Pencil,
  Trash2,
  BookOpen,
  Eye,
} from 'lucide-react'
import { ClassItemList } from './class-item-list'
import { ClassRecord, ClassItem, ClassItemType } from '@/types/modules'

interface ClassAccordionItemProps {
  classRecord: ClassRecord & { items: ClassItem[] }
  onEditClass: (cls: ClassRecord) => void
  onDeleteClass: (classId: string) => void
  onEditItem: (item: ClassItem) => void
  onDeleteItem: (itemId: string) => void
  onAddItem: (classId: string, type: ClassItemType) => void
  onItemsChange: (classId: string, items: ClassItem[]) => void
}

export function ClassAccordionItem({
  classRecord,
  onEditClass,
  onDeleteClass,
  onEditItem,
  onDeleteItem,
  onAddItem,
  onItemsChange,
}: ClassAccordionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: classRecord.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'opacity-50' : ''}
    >
      <AccordionItem value={classRecord.id} className="border rounded-lg mb-2 bg-card">
        <AccordionPrimitive.Header className="flex">
          <div className="flex flex-1 items-center gap-2 py-3 px-3">
            {/* Drag Handle */}
            <button
              {...attributes}
              {...listeners}
              className="p-1 rounded cursor-grab active:cursor-grabbing hover:bg-muted transition-colors"
            >
              <GripVertical className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Class Title */}
            <span className="font-medium text-sm truncate">{classRecord.title}</span>

            {/* Item Count Badge */}
            <Badge variant="secondary" className="text-xs gap-1 shrink-0">
              <BookOpen className="w-3 h-3" />
              {classRecord.items.length} {classRecord.items.length === 1 ? 'item' : 'items'}
            </Badge>

            {/* Free Badge */}
            {classRecord.is_free && (
              <Badge variant="outline" className="text-xs gap-1 shrink-0 text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
                <Eye className="w-3 h-3" />
                Free
              </Badge>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Edit & Delete Buttons */}
            <div className="flex items-center gap-0.5 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onEditClass(classRecord)
                }}
                className="h-7 w-7 p-0 hover:bg-primary/10 hover:text-primary"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteClass(classRecord.id)
                }}
                className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Accordion Toggle */}
            <AccordionPrimitive.Trigger className="p-1 rounded hover:bg-muted transition-colors [&[data-state=open]>svg]:rotate-180">
              <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-200" />
            </AccordionPrimitive.Trigger>
          </div>
        </AccordionPrimitive.Header>

        <AccordionContent className="px-3 pb-3">
          <ClassItemList
            classId={classRecord.id}
            items={classRecord.items}
            onItemsChange={(items) => onItemsChange(classRecord.id, items)}
            onEditItem={onEditItem}
            onDeleteItem={onDeleteItem}
            onAddItem={onAddItem}
          />
        </AccordionContent>
      </AccordionItem>
    </div>
  )
}

export function ClassAccordionDragOverlay({
  classRecord,
}: {
  classRecord: ClassRecord & { items: ClassItem[] }
}) {
  return (
    <div className="border rounded-lg bg-card shadow-lg scale-105">
      <div className="flex items-center gap-2 py-3 px-3">
        {/* Drag Handle */}
        <div className="p-1 rounded bg-muted">
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>

        {/* Class Title */}
        <span className="font-medium text-sm truncate">{classRecord.title}</span>

        {/* Item Count Badge */}
        <Badge variant="secondary" className="text-xs gap-1 shrink-0">
          <BookOpen className="w-3 h-3" />
          {classRecord.items.length} {classRecord.items.length === 1 ? 'item' : 'items'}
        </Badge>

        {/* Free Badge */}
        {classRecord.is_free && (
          <Badge variant="outline" className="text-xs gap-1 shrink-0 text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
            <Eye className="w-3 h-3" />
            Free
          </Badge>
        )}

        <div className="flex-1" />

        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </div>
    </div>
  )
}
