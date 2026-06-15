'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronRight, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OutlineClassRow } from './outline-class-row'
import { InlineComposer } from './outline-rail'
import type { ClassWithItems, SectionWithClasses } from './types'

interface OutlineModuleProps {
  section: SectionWithClasses
  index: number
  selectedClassId: string | null
  onSelectClass: (classId: string) => void
  onRename: (title: string) => void
  onDelete: () => void
  onAddClass: (title: string) => Promise<void> | void
  onReorderClasses: (classes: ClassWithItems[]) => void
}

export function OutlineModule({
  section,
  index,
  selectedClassId,
  onSelectClass,
  onRename,
  onDelete,
  onAddClass,
  onReorderClasses,
}: OutlineModuleProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [addingClass, setAddingClass] = useState(false)
  const [draftTitle, setDraftTitle] = useState(section.title)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const handleClassDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = section.classes.findIndex((c) => c.id === active.id)
    const newIndex = section.classes.findIndex((c) => c.id === over.id)
    onReorderClasses(arrayMove(section.classes, oldIndex, newIndex))
  }

  const commitRename = () => {
    setEditing(false)
    const title = draftTitle.trim()
    if (title && title !== section.title) onRename(title)
    else setDraftTitle(section.title)
  }

  const containsSelection = section.classes.some((c) => c.id === selectedClassId)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && 'z-10 opacity-60')}
    >
      {/* Module header */}
      <div className="group flex items-center gap-1 rounded-lg py-1 pl-1 pr-1.5 transition-colors hover:bg-foreground/[0.035]">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="flex h-6 w-5 flex-shrink-0 items-center justify-center text-muted-foreground/60 transition-colors hover:text-foreground"
          aria-label={collapsed ? 'Expand module' : 'Collapse module'}
        >
          <ChevronRight
            className={cn('h-3.5 w-3.5 transition-transform duration-200', !collapsed && 'rotate-90')}
          />
        </button>

        {editing ? (
          <input
            autoFocus
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') {
                setDraftTitle(section.title)
                setEditing(false)
              }
            }}
            className="min-w-0 flex-1 rounded-md border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground outline-none focus:border-primary"
          />
        ) : (
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            onDoubleClick={() => {
              setDraftTitle(section.title)
              setEditing(true)
            }}
            className={cn(
              'min-w-0 flex-1 truncate text-left text-[11px] font-semibold uppercase tracking-[0.1em]',
              containsSelection ? 'text-foreground' : 'text-foreground/60'
            )}
            title={section.title}
          >
            {section.title}
          </button>
        )}

        <span className="flex-shrink-0 text-[10px] tabular-nums text-muted-foreground/50">
          {section.classes.length}
        </span>

        {/* Hover actions */}
        <div className="flex flex-shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => {
              setDraftTitle(section.title)
              setEditing(true)
            }}
            title="Rename module"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete module"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </button>
          <span
            {...attributes}
            {...listeners}
            title="Reorder module"
            className="flex h-6 w-5 cursor-grab items-center justify-center text-muted-foreground/60 active:cursor-grabbing"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>

      {/* Classes */}
      {!collapsed && (
        <div className="mt-0.5 space-y-px pb-1">
          <DndContext
            id={`classes-dnd-${section.id}`}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleClassDragEnd}
          >
            <SortableContext
              items={section.classes.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {section.classes.map((cls, ci) => (
                <OutlineClassRow
                  key={cls.id}
                  cls={cls}
                  index={ci}
                  selected={cls.id === selectedClassId}
                  onSelect={() => onSelectClass(cls.id)}
                />
              ))}
            </SortableContext>
          </DndContext>

          {addingClass ? (
            <InlineComposer
              placeholder="Class title…"
              onSubmit={async (title) => {
                await onAddClass(title)
              }}
              onDismiss={() => setAddingClass(false)}
              className="ml-3"
            />
          ) : (
            <button
              type="button"
              onClick={() => setAddingClass(true)}
              className="flex w-full items-center gap-2 rounded-lg py-1.5 pl-[26px] pr-2 text-left text-[12.5px] text-muted-foreground/50 transition-colors hover:bg-foreground/[0.035] hover:text-muted-foreground"
            >
              <Plus className="h-3 w-3" />
              Add class
            </button>
          )}
        </div>
      )}
    </div>
  )
}
