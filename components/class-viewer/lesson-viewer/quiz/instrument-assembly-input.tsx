'use client'

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { AssemblyPart, AssemblyZone } from '@/lib/quiz/grading'

type Placement = Record<string, string> // partId -> zoneId

function PartChip({
  part,
  state,
  disabled,
}: {
  part: AssemblyPart
  state: 'idle' | 'correct' | 'incorrect'
  disabled?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border-2 bg-card px-2 py-1.5 shadow-sm',
        state === 'idle' && 'border-border',
        state === 'correct' && 'border-green-500 bg-green-500/10',
        state === 'incorrect' && 'border-red-500 bg-red-500/10',
        !disabled && 'cursor-grab active:cursor-grabbing',
      )}
    >
      {part.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={part.imageUrl} alt={part.label} className="h-9 w-9 shrink-0 rounded-lg object-contain" />
      ) : null}
      <span className="text-sm font-medium">{part.label}</span>
    </div>
  )
}

function DraggablePart({
  part,
  state,
  disabled,
}: {
  part: AssemblyPart
  state: 'idle' | 'correct' | 'incorrect'
  disabled?: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: part.id, disabled })
  return (
    <div
      ref={setNodeRef}
      {...(disabled ? {} : listeners)}
      {...attributes}
      className={cn(isDragging && 'opacity-30')}
    >
      <PartChip part={part} state={state} disabled={disabled} />
    </div>
  )
}

function Zone({
  zone,
  children,
  disabled,
}: {
  zone: AssemblyZone
  children: React.ReactNode
  disabled?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: zone.id, disabled })
  return (
    <div
      ref={setNodeRef}
      style={{
        left: `${zone.x}%`,
        top: `${zone.y}%`,
        width: `${zone.width}%`,
        height: `${zone.height}%`,
      }}
      className={cn(
        'absolute flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-1 text-center transition-colors',
        isOver ? 'border-primary bg-primary/15' : 'border-primary/40 bg-primary/5',
      )}
    >
      <span className="pointer-events-none absolute left-1 top-1 rounded bg-background/70 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {zone.label}
      </span>
      {children}
    </div>
  )
}

export function InstrumentAssemblyInput({
  imageUrl,
  zones,
  parts,
  placement,
  isGraded,
  onChange,
}: {
  imageUrl: string | null
  zones: AssemblyZone[]
  parts: AssemblyPart[]
  placement: Placement
  isGraded: boolean
  onChange: (v: Placement) => void
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const partById = new Map(parts.map((p) => [p.id, p]))
  const unplaced = parts.filter((p) => !placement[p.id])

  const partState = (part: AssemblyPart): 'idle' | 'correct' | 'incorrect' => {
    if (!isGraded || !placement[part.id]) return 'idle'
    return placement[part.id] === part.correctZoneId ? 'correct' : 'incorrect'
  }

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const partId = String(e.active.id)
    const next = { ...placement }
    if (e.over) {
      // Dropped onto a zone → assign; otherwise (dropped in the tray) → unplace.
      next[partId] = String(e.over.id)
    } else {
      delete next[partId]
    }
    onChange(next)
  }

  const activePart = activeId ? partById.get(activeId) : null

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        <div className="relative w-full overflow-hidden rounded-2xl border-2 border-border bg-muted">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="Assemble the instrument" className="block w-full select-none" draggable={false} />
          ) : (
            <div className="aspect-video" />
          )}
          {zones.map((zone) => {
            const placedHere = parts.filter((p) => placement[p.id] === zone.id)
            return (
              <Zone key={zone.id} zone={zone} disabled={isGraded}>
                <div className="flex flex-wrap items-center justify-center gap-1">
                  {placedHere.map((p) => (
                    <DraggablePart key={p.id} part={p} state={partState(p)} disabled={isGraded} />
                  ))}
                </div>
              </Zone>
            )
          })}
        </div>

        {unplaced.length > 0 && (
          <div className="rounded-2xl border border-border bg-card/50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Drag each part onto the instrument
            </p>
            <div className="flex flex-wrap gap-2">
              {unplaced.map((p) => (
                <DraggablePart key={p.id} part={p} state="idle" disabled={isGraded} />
              ))}
            </div>
          </div>
        )}
      </div>

      <DragOverlay>
        {activePart ? <PartChip part={activePart} state="idle" /> : null}
      </DragOverlay>
    </DndContext>
  )
}
