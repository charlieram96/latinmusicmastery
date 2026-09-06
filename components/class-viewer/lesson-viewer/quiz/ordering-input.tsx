'use client'

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import type { OrderItem } from '@/lib/quiz/grading'
import type { QuestionInputProps } from './input-props'

function Row({
  id,
  index,
  item,
  total,
  isGraded,
  onMove,
}: {
  id: string
  index: number
  item: OrderItem | undefined
  total: number
  isGraded: boolean
  onMove: (from: number, to: number) => void
}) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: isGraded })
  const ok = isGraded && item?.correctPosition === index
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'grid grid-cols-[auto_30px_1fr_auto] items-center gap-3 rounded-xl border-[1.5px] bg-raised py-2.5 pl-2 pr-3 transition-[border-color,box-shadow]',
        isDragging && 'z-10 border-primary shadow-[0_12px_30px_-12px_rgba(0,0,0,0.5)]',
        !isDragging && !isGraded && 'border-border',
        isGraded && (ok ? 'border-success' : 'border-terracotta'),
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={isGraded}
        aria-label={t('dashboard.classViewer.quiz.ordering.dragHandle')}
        className="grid h-9 w-7 place-items-center rounded-lg text-muted-foreground disabled:opacity-40 enabled:cursor-grab enabled:active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span
        className={cn(
          'grid h-[30px] w-[30px] place-items-center rounded-[9px] font-heading text-[13px] font-extrabold tabular-nums',
          !isGraded && 'bg-foreground/7 text-muted-foreground',
          isGraded && (ok ? 'bg-success text-white' : 'bg-terracotta text-white'),
        )}
      >
        {index + 1}
      </span>
      <span className="text-[14.5px] font-medium">{item?.text}</span>
      {isGraded ? (
        ok ? (
          <Check className="h-4 w-4 text-success" />
        ) : (
          <span className="whitespace-nowrap text-[11.5px] text-muted-foreground">
            {t('dashboard.classViewer.quiz.ordering.shouldBe', { n: (item?.correctPosition ?? 0) + 1 })}
          </span>
        )
      ) : (
        <span className="inline-flex gap-0.5">
          <button type="button" disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={t('dashboard.classViewer.quiz.moveUp')} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-foreground/7 disabled:opacity-30">
            <ChevronUp className="h-4 w-4" />
          </button>
          <button type="button" disabled={index === total - 1} onClick={() => onMove(index, index + 1)} aria-label={t('dashboard.classViewer.quiz.moveDown')} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-foreground/7 disabled:opacity-30">
            <ChevronDown className="h-4 w-4" />
          </button>
        </span>
      )}
    </div>
  )
}

/** Drag the handle (or use the buttons / keyboard) to reorder. Answer shape stays string[] of item ids. */
export function OrderingInput({ question: q, answer, isGraded, onChange }: QuestionInputProps) {
  const items = (((q.options ?? {}) as Record<string, unknown>).items as OrderItem[]) ?? []
  const current = (answer as string[]) ?? items.map((it) => it.id)
  const byId = new Map(items.map((it) => [it.id, it]))
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const move = (from: number, to: number) => {
    if (to < 0 || to >= current.length || from === to) return
    onChange(arrayMove(current, from, to))
  }
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    move(current.indexOf(String(active.id)), current.indexOf(String(over.id)))
  }
  return (
    <DndContext id={`order-${q.id}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={current} strategy={verticalListSortingStrategy}>
        <div className="grid gap-2">
          {current.map((id, i) => (
            <Row key={id} id={id} index={i} item={byId.get(id)} total={current.length} isGraded={isGraded} onMove={move} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
