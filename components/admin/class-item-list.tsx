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
import { ClassItemCard, ClassItemCardDragOverlay } from './class-item-card'
import AddClassItemBar from './add-class-item-bar'
import { ClassItem, ClassItemType } from '@/types/modules'
import { reorderClassItems } from '@/app/actions/course-builder'

interface ClassItemListProps {
  classId: string
  items: ClassItem[]
  onItemsChange: (items: ClassItem[]) => void
  onEditItem: (item: ClassItem) => void
  onDeleteItem: (itemId: string) => void
  onAddItem: (classId: string, type: ClassItemType) => void
}

export function ClassItemList({
  classId,
  items,
  onItemsChange,
  onEditItem,
  onDeleteItem,
  onAddItem,
}: ClassItemListProps) {
  const [activeItem, setActiveItem] = useState<ClassItem | null>(null)

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
    const item = items.find((i) => i.id === active.id)
    if (item) {
      setActiveItem(item)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveItem(null)

    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)

    const newItems = arrayMove(items, oldIndex, newIndex)
    onItemsChange(newItems)

    // Persist new order via server action
    await reorderClassItems(classId, newItems.map((i) => i.id))
  }

  const handleDragCancel = () => {
    setActiveItem(null)
  }

  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No items yet. Add content below.</p>
      ) : (
        <DndContext
          id={`items-dnd-${classId}`}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext
            items={items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {items.map((item) => (
                <ClassItemCard
                  key={item.id}
                  item={item}
                  onEdit={onEditItem}
                  onDelete={onDeleteItem}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay
            dropAnimation={{
              duration: 200,
              easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
            }}
          >
            {activeItem ? (
              <ClassItemCardDragOverlay item={activeItem} />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <AddClassItemBar onAdd={(type) => onAddItem(classId, type)} />
    </div>
  )
}
