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
import { createClient } from '@/lib/supabase/client'
import { ModuleCard, ModuleCardDragOverlay } from './module-card'
import { CourseModule } from '@/types/modules'
import { GripVertical, ArrowDownUp, Package } from 'lucide-react'

interface ModuleListProps {
  courseId: string
  modules: CourseModule[]
  onModulesChange: (modules: CourseModule[]) => void
  onEdit: (module: CourseModule) => void
  onDelete: (moduleId: string) => void
}

export function ModuleList({
  courseId,
  modules,
  onModulesChange,
  onEdit,
  onDelete,
}: ModuleListProps) {
  const [activeModule, setActiveModule] = useState<CourseModule | null>(null)
  const [isSaving, setIsSaving] = useState(false)

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
    const module = modules.find((m) => m.id === active.id)
    if (module) {
      setActiveModule(module)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveModule(null)

    if (!over || active.id === over.id) return

    const oldIndex = modules.findIndex((m) => m.id === active.id)
    const newIndex = modules.findIndex((m) => m.id === over.id)

    const newModules = arrayMove(modules, oldIndex, newIndex)
    onModulesChange(newModules)

    // Update order_index in database
    setIsSaving(true)
    const supabase = createClient()
    const updates = newModules.map((module, index) => ({
      id: module.id,
      order_index: index,
    }))

    try {
      for (const update of updates) {
        await supabase
          .from('course_modules_legacy')
          .update({ order_index: update.order_index })
          .eq('id', update.id)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleDragCancel = () => {
    setActiveModule(null)
  }

  if (modules.length === 0) {
    return (
      <div className="relative">
        <div className="text-center py-16 border-2 border-dashed rounded-xl bg-muted/30">
          <div className="inline-flex p-4 rounded-full bg-muted mb-4">
            <Package className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg text-foreground mb-2">No modules yet</h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Add your first video, quiz, or exercise using the cards above to start building your course.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Saving indicator */}
      {isSaving && (
        <div className="absolute -top-2 right-0 z-20">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium shadow-lg animate-pulse">
            <ArrowDownUp className="w-3 h-3" />
            Saving order...
          </div>
        </div>
      )}

      {/* Drag instruction */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4 pl-4">
        <GripVertical className="w-4 h-4" />
        <span>Drag modules to reorder</span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext
          items={modules.map((m) => m.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-0 pl-4">
            {modules.map((module, index) => (
              <ModuleCard
                key={module.id}
                module={module}
                index={index}
                totalModules={modules.length}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={{
          duration: 200,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}>
          {activeModule ? (
            <ModuleCardDragOverlay module={activeModule} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
