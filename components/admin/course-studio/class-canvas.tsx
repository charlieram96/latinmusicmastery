'use client'

import { useEffect, useRef, useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Layers, ListMusic, Lock, Trash2, Unlock } from 'lucide-react'
import { cn } from '@/lib/utils'
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
  onUpdateClass: (
    classId: string,
    updates: { title?: string; description?: string; is_free?: boolean }
  ) => void
  onDeleteClass: (classId: string) => void
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
  onUpdateClass,
  onDeleteClass,
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
            {hasModules ? 'No class selected' : 'Start with a module'}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {hasModules
              ? 'Pick a class from the outline, or add one inside a module to begin building.'
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
      <ClassHeader
        key={cls.id}
        cls={cls}
        moduleIndex={moduleIndex}
        classIndex={classIndex}
        onUpdateClass={onUpdateClass}
        onDeleteClass={onDeleteClass}
      />

      <div className="mt-6 space-y-2">
        {cls.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-warm-surface/50 px-6 py-8 text-center">
            <p className="text-sm font-medium text-foreground/80">This class is empty</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Add a video lesson, a quiz, an exercise, or a jam session below.
            </p>
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
  onUpdateClass: ClassCanvasProps['onUpdateClass']
  onDeleteClass: (classId: string) => void
}

/** Keyed by class id so drafts reset cleanly when the selection changes. */
function ClassHeader({ cls, moduleIndex, classIndex, onUpdateClass, onDeleteClass }: ClassHeaderProps) {
  const [title, setTitle] = useState(cls.title)
  const [description, setDescription] = useState(cls.description ?? '')
  const descriptionRef = useRef<HTMLTextAreaElement>(null)

  // Auto-grow the description to fit its content.
  useEffect(() => {
    const el = descriptionRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [description])

  const commitTitle = () => {
    const next = title.trim()
    if (!next) {
      setTitle(cls.title)
      return
    }
    if (next !== cls.title) onUpdateClass(cls.id, { title: next })
  }

  const commitDescription = () => {
    if (description.trim() !== (cls.description ?? '')) {
      onUpdateClass(cls.id, { description: description.trim() })
    }
  }

  return (
    <header className={styles.rise}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold">
          Module {moduleIndex + 1} · Class {classIndex + 1}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onUpdateClass(cls.id, { is_free: !cls.is_free })}
            title={cls.is_free ? 'Free preview — visible without enrolling' : 'Members only'}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
              cls.is_free
                ? 'border-gold/40 bg-gold/10 text-gold'
                : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'
            )}
          >
            {cls.is_free ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
            {cls.is_free ? 'Free preview' : 'Members only'}
          </button>
          <button
            type="button"
            onClick={() => onDeleteClass(cls.id)}
            title="Delete class"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            setTitle(cls.title)
            e.currentTarget.blur()
          }
        }}
        placeholder="Class title"
        className="mt-2 w-full rounded-lg border border-transparent bg-transparent px-2 py-1 font-heading text-2xl font-bold tracking-tight text-foreground outline-none transition-colors -mx-2 hover:border-border focus:border-primary/40 focus:bg-card"
      />

      <textarea
        ref={descriptionRef}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={commitDescription}
        rows={1}
        placeholder="Add a short description for this class…"
        className="mt-1 w-full resize-none rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm leading-relaxed text-muted-foreground outline-none transition-colors -mx-2 hover:border-border focus:border-primary/40 focus:bg-card focus:text-foreground"
      />
    </header>
  )
}
