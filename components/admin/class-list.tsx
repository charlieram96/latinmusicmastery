'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Accordion } from '@/components/ui/accordion'
import { ClassAccordionItem, ClassAccordionDragOverlay } from './class-accordion-item'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { reorderClasses } from '@/app/actions/course-builder'
import { ClassRecord, ClassItem, ClassItemType } from '@/types/modules'

type ClassWithItems = ClassRecord & { items: ClassItem[] }

interface ClassListProps {
  sectionId: string
  classes: ClassWithItems[]
  onClassesChange: (classes: ClassWithItems[]) => void
  onAddClass: (sectionId: string) => void
  onEditClass: (cls: ClassRecord) => void
  onDeleteClass: (classId: string) => void
  onEditItem: (item: ClassItem) => void
  onDeleteItem: (itemId: string) => void
  onAddItem: (classId: string, type: ClassItemType) => void
  onItemsChange: (classId: string, items: ClassItem[]) => void
}

export function ClassList({
  sectionId,
  classes,
  onClassesChange,
  onAddClass,
  onEditClass,
  onDeleteClass,
  onEditItem,
  onDeleteItem,
  onAddItem,
  onItemsChange,
}: ClassListProps) {
  const [activeClass, setActiveClass] = useState<ClassWithItems | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const cls = classes.find((c) => c.id === active.id)
    if (cls) {
      setActiveClass(cls)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveClass(null)

    if (!over || active.id === over.id) return

    const oldIndex = classes.findIndex((c) => c.id === active.id)
    const newIndex = classes.findIndex((c) => c.id === over.id)

    const newClasses = arrayMove(classes, oldIndex, newIndex)
    onClassesChange(newClasses)

    // Persist new order via server action
    await reorderClasses(sectionId, newClasses.map((c) => c.id))
  }

  const handleDragCancel = () => {
    setActiveClass(null)
  }

  if (classes.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/30">
          <p className="text-sm text-muted-foreground">No classes yet. Add your first class to get started.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAddClass(sectionId)}
          className="w-full"
        >
          <Plus className="w-4 h-4" />
          Add Class
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext
          items={classes.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <Accordion type="multiple">
            {classes.map((cls) => (
              <ClassAccordionItem
                key={cls.id}
                classRecord={cls}
                onEditClass={onEditClass}
                onDeleteClass={onDeleteClass}
                onEditItem={onEditItem}
                onDeleteItem={onDeleteItem}
                onAddItem={onAddItem}
                onItemsChange={onItemsChange}
              />
            ))}
          </Accordion>
        </SortableContext>

        <DragOverlay
          dropAnimation={{
            duration: 200,
            easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
          }}
        >
          {activeClass ? (
            <ClassAccordionDragOverlay classRecord={activeClass} />
          ) : null}
        </DragOverlay>
      </DndContext>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onAddClass(sectionId)}
        className="w-full"
      >
        <Plus className="w-4 h-4" />
        Add Class
      </Button>
    </div>
  )
}
