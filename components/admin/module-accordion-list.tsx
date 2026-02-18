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
import { ModuleAccordionItem, ModuleAccordionDragOverlay } from './module-accordion-item'
import { Button } from '@/components/ui/button'
import { Plus, Layers } from 'lucide-react'
import { reorderSections } from '@/app/actions/course-builder'
import type {
  CourseSection,
  ClassRecord,
  ClassItem,
  ClassItemType,
} from '@/types/modules'

type SectionWithClasses = CourseSection & { classes: (ClassRecord & { items: ClassItem[] })[] }

interface ModuleAccordionListProps {
  courseId: string
  sections: SectionWithClasses[]
  onSectionsChange: (sections: SectionWithClasses[]) => void
  onAddSection: () => void
  onEditSection: (section: CourseSection) => void
  onDeleteSection: (sectionId: string) => void
  onAddClass: (sectionId: string) => void
  onEditClass: (cls: ClassRecord) => void
  onDeleteClass: (classId: string) => void
  onClassesChange: (sectionId: string, classes: (ClassRecord & { items: ClassItem[] })[]) => void
  onEditItem: (item: ClassItem) => void
  onDeleteItem: (itemId: string) => void
  onAddItem: (classId: string, type: ClassItemType) => void
  onItemsChange: (classId: string, items: ClassItem[]) => void
}

export function ModuleAccordionList({
  courseId,
  sections,
  onSectionsChange,
  onAddSection,
  onEditSection,
  onDeleteSection,
  onAddClass,
  onEditClass,
  onDeleteClass,
  onClassesChange,
  onEditItem,
  onDeleteItem,
  onAddItem,
  onItemsChange,
}: ModuleAccordionListProps) {
  const [activeSection, setActiveSection] = useState<SectionWithClasses | null>(null)

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
    const section = sections.find((s) => s.id === active.id)
    if (section) {
      setActiveSection(section)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveSection(null)

    if (!over || active.id === over.id) return

    const oldIndex = sections.findIndex((s) => s.id === active.id)
    const newIndex = sections.findIndex((s) => s.id === over.id)

    const newSections = arrayMove(sections, oldIndex, newIndex)
    onSectionsChange(newSections)

    // Persist new order via server action
    const newIds = newSections.map((s) => s.id)
    await reorderSections(courseId, newIds)
  }

  const handleDragCancel = () => {
    setActiveSection(null)
  }

  // Empty state
  if (sections.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center py-16 border-2 border-dashed rounded-xl bg-muted/30">
          <div className="inline-flex p-4 rounded-full bg-muted mb-4">
            <Layers className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg text-foreground mb-2">No modules yet</h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Add your first module to start building your course.
          </p>
          <Button
            onClick={onAddSection}
            className="mt-6"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Module
          </Button>
        </div>
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
          items={sections.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <Accordion
            type="multiple"
            defaultValue={sections.map((s) => s.id)}
            className="space-y-0"
          >
            {sections.map((section) => (
              <ModuleAccordionItem
                key={section.id}
                section={section}
                onEditSection={onEditSection}
                onDeleteSection={onDeleteSection}
                onAddClass={onAddClass}
                onEditClass={onEditClass}
                onDeleteClass={onDeleteClass}
                onClassesChange={onClassesChange}
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
          {activeSection ? (
            <ModuleAccordionDragOverlay section={activeSection} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Add Module button */}
      <div className="flex justify-center pt-2">
        <Button
          variant="outline"
          onClick={onAddSection}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Module
        </Button>
      </div>
    </div>
  )
}
