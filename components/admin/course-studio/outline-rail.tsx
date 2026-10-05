'use client'

import { AdminText } from '@/components/admin/admin-text'


import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Check, Layers, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OutlineModule } from './outline-module'
import type { ClassWithItems, SectionWithClasses } from './types'

interface OutlineRailProps {
  sections: SectionWithClasses[]
  selectedClassId: string | null
  selectedModuleId: string | null
  onSelectClass: (classId: string) => void
  onSelectModule: (sectionId: string) => void
  onAddModule: (title: string) => Promise<void> | void
  onDeleteModule: (sectionId: string) => void
  onReorderModules: (sections: SectionWithClasses[]) => void
  onAddClass: (sectionId: string, title: string) => Promise<void> | void
  onReorderClasses: (sectionId: string, classes: ClassWithItems[]) => void
}

export function OutlineRail({
  sections,
  selectedClassId,
  selectedModuleId,
  onSelectClass,
  onSelectModule,
  onAddModule,
  onDeleteModule,
  onReorderModules,
  onAddClass,
  onReorderClasses,
}: OutlineRailProps) {
  const [addingModule, setAddingModule] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const handleModuleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sections.findIndex((s) => s.id === active.id)
    const newIndex = sections.findIndex((s) => s.id === over.id)
    onReorderModules(arrayMove(sections, oldIndex, newIndex))
  }

  const classCount = sections.reduce((acc, s) => acc + s.classes.length, 0)

  return (
    <div className="flex min-h-full flex-col px-3 py-4">
      <div className="mb-3 flex items-baseline justify-between px-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70"> <AdminText text={"Outline"} /> </span>
        <span className="text-[10px] tabular-nums text-muted-foreground/50">
          {sections.length} {sections.length === 1 ? 'module' : 'modules'} · {classCount}{' '}
          {classCount === 1 ? 'class' : <AdminText text={"classes"} />}
        </span>
      </div>

      {sections.length === 0 && !addingModule && (
        <div className="mx-1 mb-3 rounded-xl border border-dashed border-border bg-background/40 px-4 py-6 text-center">
          <Layers className="mx-auto mb-2 h-5 w-5 text-muted-foreground/40" />
          <p className="text-xs leading-relaxed text-muted-foreground"> <AdminText text={"Structure your course into modules, then fill each module with classes."} /> </p>
        </div>
      )}

      <div className="flex-1 space-y-2">
        <DndContext
          id="modules-dnd"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleModuleDragEnd}
        >
          <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {sections.map((section) => (
              <OutlineModule
                key={section.id}
                section={section}
                selectedClassId={selectedClassId}
                selectedModuleId={selectedModuleId}
                onSelectClass={onSelectClass}
                onSelectModule={() => onSelectModule(section.id)}
                onDelete={() => onDeleteModule(section.id)}
                onAddClass={(title) => onAddClass(section.id, title)}
                onReorderClasses={(classes) => onReorderClasses(section.id, classes)}
              />
            ))}
          </SortableContext>
        </DndContext>

        {addingModule ? (
          <InlineComposer
            placeholder="Module title…"
            onSubmit={async (title) => {
              await onAddModule(title)
            }}
            onDismiss={() => setAddingModule(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingModule(true)}
            className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-left text-[12.5px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.04] hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> <AdminText text={"New module"} /> </button>
        )}
      </div>
    </div>
  )
}

interface InlineComposerProps {
  placeholder: string
  onSubmit: (title: string) => Promise<void> | void
  onDismiss: () => void
  className?: string
}

/** Borderless add-row that morphs into a commit/cancel input. Enter submits
    (and stays open for rapid entry), Escape or blur-empty dismisses. */
export function InlineComposer({ placeholder, onSubmit, onDismiss, className }: InlineComposerProps) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)

  const commit = async () => {
    const title = value.trim()
    if (!title || busy) return
    setBusy(true)
    try {
      await onSubmit(title)
      setValue('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-lg border border-primary/40 bg-background py-1 pl-2.5 pr-1 shadow-sm',
        className
      )}
    >
      <input
        autoFocus
        value={value}
        disabled={busy}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void commit()
          if (e.key === 'Escape') onDismiss()
        }}
        onBlur={() => {
          if (!value.trim()) onDismiss()
        }}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/50 disabled:opacity-60"
      />
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => void commit()}
        disabled={busy || !value.trim()}
        title="Add"
        className="flex h-6 w-6 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10 disabled:opacity-30"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onDismiss}
        title="Cancel"
        className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
