'use client'

import { useState } from 'react'
import { Lock, Trash2, Unlock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { updateClass } from '@/app/actions/course-builder'
import { useAutosave } from './use-autosave'
import { useSaveStatus } from './save-status'
import type { ClassWithItems } from './types'

interface ClassEditorProps {
  cls: ClassWithItems
  onPatched: (patch: Partial<ClassWithItems>) => void
  onDelete: () => void
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
      {children}
    </h4>
  )
}

/** Drawer form for a class. Mount keyed by class id so local drafts reset on
    selection change; the autosave hook flushes pending edits on unmount. */
export function ClassEditor({ cls, onPatched, onDelete }: ClassEditorProps) {
  const { track } = useSaveStatus()

  const [title, setTitle] = useState(cls.title)
  const [titleEs, setTitleEs] = useState(cls.title_es ?? '')
  const [description, setDescription] = useState(cls.description ?? '')
  const [descriptionEs, setDescriptionEs] = useState(cls.description_es ?? '')

  // The save closure is refreshed each render by useAutosave, so it always reads
  // the latest local state.
  const { queue } = useAutosave<Record<string, unknown>>({
    save: () =>
      track(
        updateClass(cls.id, {
          title: title.trim() || cls.title,
          description,
          title_es: titleEs || null,
          description_es: descriptionEs || null,
        })
      ),
  })

  const toggleFree = (isFree: boolean) => {
    onPatched({ is_free: isFree })
    void track(updateClass(cls.id, { is_free: isFree }))
  }

  return (
    <div className="space-y-6 px-5 py-5">
      <div className="space-y-4">
        <SectionLabel>Class</SectionLabel>

        <div className="grid gap-1.5">
          <Label htmlFor="class-title" className="text-xs">
            Title
          </Label>
          <Input
            id="class-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              if (e.target.value.trim()) onPatched({ title: e.target.value.trim() })
              queue({})
            }}
            placeholder="Class title"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="class-title-es" className="text-xs text-muted-foreground">
            Title (Español)
          </Label>
          <Input
            id="class-title-es"
            value={titleEs}
            onChange={(e) => {
              setTitleEs(e.target.value)
              onPatched({ title_es: e.target.value || null })
              queue({})
            }}
            placeholder="Título de la clase (opcional)"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="class-description" className="text-xs">
            Description
          </Label>
          <Textarea
            id="class-description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              onPatched({ description: e.target.value || null })
              queue({})
            }}
            rows={4}
            placeholder="What students will learn in this class…"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="class-description-es" className="text-xs text-muted-foreground">
            Description (Español)
          </Label>
          <Textarea
            id="class-description-es"
            value={descriptionEs}
            onChange={(e) => {
              setDescriptionEs(e.target.value)
              onPatched({ description_es: e.target.value || null })
              queue({})
            }}
            rows={4}
            placeholder="Lo que aprenderán en esta clase (opcional)…"
          />
        </div>
      </div>

      {/* Access */}
      <div className="space-y-4 border-t border-border pt-5">
        <SectionLabel>Access</SectionLabel>
        <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-border bg-warm-surface/60 px-3.5 py-3">
          <span className="space-y-0.5">
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
              {cls.is_free ? (
                <Unlock className="h-3.5 w-3.5 text-gold" />
              ) : (
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              Free preview
            </span>
            <span className="block text-xs leading-relaxed text-muted-foreground">
              Visible to everyone without enrolling.
            </span>
          </span>
          <Switch checked={!!cls.is_free} onCheckedChange={toggleFree} />
        </label>
      </div>

      <div className="border-t border-border pt-5">
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete class
        </button>
        <p className="mt-1 px-2.5 text-[11px] leading-relaxed text-muted-foreground">
          Removes this class and all of its items. This cannot be undone.
        </p>
      </div>
    </div>
  )
}
