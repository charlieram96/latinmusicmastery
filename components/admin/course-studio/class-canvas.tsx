'use client'

import { AdminText } from '@/components/admin/admin-text'


import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Layers, ListMusic, Unlock } from 'lucide-react'
import styles from './course-studio.module.css'
import { AddItemBar } from './add-item-bar'
import { ClassItemRow } from './class-item-row'
import type { ClassItem, ClassItemType } from '@/types/modules'
import type { ClassWithItems, SectionWithClasses } from './types'

interface ClassCanvasProps {
  section: SectionWithClasses | null
  cls: ClassWithItems | null
  moduleIndex: number
  classIndex: number
  hasModules: boolean
  activeItemId: string | null
  onAddItem: (classId: string, type: ClassItemType) => Promise<void> | void
  onSelectItem: (itemId: string) => void
  onDeleteItem: (itemId: string) => void
  onReorderItems: (classId: string, items: ClassItem[]) => void
}

export function ClassCanvas({
  section,
  cls,
  moduleIndex,
  classIndex,
  hasModules,
  activeItemId,
  onAddItem,
  onSelectItem,
  onDeleteItem,
  onReorderItems,
}: ClassCanvasProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  if (!cls || !section) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-sm text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-warm-surface">
            {hasModules ? (
              <ListMusic className="h-5 w-5 text-muted-foreground/60" />
            ) : (
              <Layers className="h-5 w-5 text-muted-foreground/60" />
            )}
          </span>
          <h2 className="mb-1.5 font-heading text-base font-semibold text-foreground">
            {hasModules ? <AdminText text={"No class selected"} /> : 'Start with a module'}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {hasModules
              ? <AdminText text={"Pick a class from the outline, or add one inside a module to begin building."} />
              : 'Create your first module in the outline, add a class inside it, and the builder opens right here.'}
          </p>
        </div>
      </div>
    )
  }

  const handleItemDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = cls.items.findIndex((i) => i.id === active.id)
    const newIndex = cls.items.findIndex((i) => i.id === over.id)
    onReorderItems(cls.id, arrayMove(cls.items, oldIndex, newIndex))
  }

  return (
    <div className="mx-auto w-full max-w-[760px] px-5 py-7 md:px-8">
      <ClassHeader cls={cls} moduleIndex={moduleIndex} classIndex={classIndex} />

      <div className="mt-6 space-y-2">
        {cls.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-warm-surface/50 px-6 py-8 text-center">
            <p className="text-sm font-medium text-foreground/80"><AdminText text={"This class is empty"} /></p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground"> <AdminText text={"Add a video lesson, a quiz, an exercise, or a jam session below."} /> </p>
          </div>
        ) : (
          <DndContext
            id={`items-dnd-${cls.id}`}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleItemDragEnd}
          >
            <SortableContext
              items={cls.items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              {cls.items.map((item, i) => (
                <div
                  key={item.id}
                  className={styles.rise}
                  style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
                >
                  <ClassItemRow
                    item={item}
                    active={item.id === activeItemId}
                    onSelect={() => onSelectItem(item.id)}
                    onDelete={() => onDeleteItem(item.id)}
                  />
                </div>
              ))}
            </SortableContext>
          </DndContext>
        )}

        <div className="pt-2">
          <AddItemBar onAdd={(type) => onAddItem(cls.id, type)} />
        </div>
      </div>
    </div>
  )
}

interface ClassHeaderProps {
  cls: ClassWithItems
  moduleIndex: number
  classIndex: number
}

/** Read-only header — title/description/free/delete are edited in the drawer. */
function ClassHeader({ cls, moduleIndex, classIndex }: ClassHeaderProps) {
  return (
    <header className={styles.rise}>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold"> <AdminText text={"Module"} /> {moduleIndex + 1} <AdminText text={"· Class"} /> {classIndex + 1}
        </span>
        {cls.is_free && (
          <span className="flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-gold">
            <Unlock className="h-2.5 w-2.5" /> <AdminText text={"Free preview"} /> </span>
        )}
      </div>

      <h2 className="mt-2 font-heading text-2xl font-bold tracking-tight text-foreground">
        {cls.title || 'Untitled class'}
      </h2>

      {cls.description && (
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{cls.description}</p>
      )}
    </header>
  )
}
