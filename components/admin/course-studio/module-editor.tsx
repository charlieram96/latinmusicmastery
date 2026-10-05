'use client'

import { AdminText } from '@/components/admin/admin-text'


import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { updateSection } from '@/app/actions/course-builder'
import { useAutosave } from './use-autosave'
import { useSaveStatus } from './save-status'
import type { SectionWithClasses } from './types'

interface ModuleEditorProps {
  section: SectionWithClasses
  onPatched: (patch: Partial<SectionWithClasses>) => void
  onDelete: () => void
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
      {children}
    </h4>
  )
}

/** Drawer form for a module. Mount keyed by section id so local drafts reset
    on selection change; the autosave hook flushes pending edits on unmount. */
export function ModuleEditor({ section, onPatched, onDelete }: ModuleEditorProps) {
  const { track } = useSaveStatus()

  const [title, setTitle] = useState(section.title)
  const [titleEs, setTitleEs] = useState(section.title_es ?? '')
  const [description, setDescription] = useState(section.description ?? '')
  const [descriptionEs, setDescriptionEs] = useState(section.description_es ?? '')

  // updateSection persists title + description together, so every save sends the
  // full current set. The save closure is refreshed each render by useAutosave,
  // so it always reads the latest local state.
  const { queue } = useAutosave<Record<string, unknown>>({
    save: () =>
      track(
        updateSection(section.id, title.trim() || section.title, description, {
          title_es: titleEs || null,
          description_es: descriptionEs || null,
        })
      ),
  })

  return (
    <div className="space-y-6 px-5 py-5">
      <div className="space-y-4">
        <SectionLabel><AdminText text={"Module"} /></SectionLabel>

        <div className="grid gap-1.5">
          <Label htmlFor="module-title" className="text-xs"> <AdminText text={"Title"} /> </Label>
          <Input
            id="module-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              if (e.target.value.trim()) onPatched({ title: e.target.value.trim() })
              queue({})
            }}
            placeholder="Module title"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="module-title-es" className="text-xs text-muted-foreground"> <AdminText text={"Title (Español)"} /> </Label>
          <Input
            id="module-title-es"
            value={titleEs}
            onChange={(e) => {
              setTitleEs(e.target.value)
              onPatched({ title_es: e.target.value || null })
              queue({})
            }}
            placeholder="Título del módulo (opcional)"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="module-description" className="text-xs"> <AdminText text={"Description"} /> </Label>
          <Textarea
            id="module-description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              onPatched({ description: e.target.value || null })
              queue({})
            }}
            rows={4}
            placeholder="What this module covers…"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="module-description-es" className="text-xs text-muted-foreground"> <AdminText text={"Description (Español)"} /> </Label>
          <Textarea
            id="module-description-es"
            value={descriptionEs}
            onChange={(e) => {
              setDescriptionEs(e.target.value)
              onPatched({ description_es: e.target.value || null })
              queue({})
            }}
            rows={4}
            placeholder="Lo que cubre este módulo (opcional)…"
          />
        </div>
      </div>

      <div className="border-t border-border pt-5">
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" /> <AdminText text={"Delete module"} /> </button>
        <p className="mt-1 px-2.5 text-[11px] leading-relaxed text-muted-foreground"> <AdminText text={"Removes this module and all of its classes. This cannot be undone."} /> </p>
      </div>
    </div>
  )
}
