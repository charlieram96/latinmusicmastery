'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'
import { QuizMediaUpload } from './quiz-media-upload'
import type { AssemblyPart, AssemblyZone } from '@/lib/quiz/grading'

interface Props {
  questionId: string
  options: { zones?: AssemblyZone[]; parts?: AssemblyPart[] } | null
  imageUrl: string
  onChange: (data: { options?: unknown; image_url?: string | null }) => void
}

const clamp = (n: number) => Math.max(0, Math.min(100, n))

export function InstrumentAssemblyBuilder({ questionId, options, imageUrl, onChange }: Props) {
  const zones = options?.zones ?? []
  const parts = options?.parts ?? []
  const stageRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ id: string; offX: number; offY: number } | null>(null)
  const [, force] = useState(0)

  const patch = (next: { zones?: AssemblyZone[]; parts?: AssemblyPart[] }) => {
    onChange({ options: { zones, parts, ...next } })
  }

  // Click empty stage area → add a zone centered on the click point.
  const handleStageClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return // ignore clicks on existing zones
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = clamp(((e.clientX - rect.left) / rect.width) * 100 - 10)
    const y = clamp(((e.clientY - rect.top) / rect.height) * 100 - 7)
    const id = crypto.randomUUID()
    patch({ zones: [...zones, { id, label: `Zone ${zones.length + 1}`, x, y, width: 20, height: 14 }] })
  }

  const updateZone = (id: string, p: Partial<AssemblyZone>) => {
    patch({ zones: zones.map((z) => (z.id === id ? { ...z, ...p } : z)) })
  }

  const removeZone = (id: string) => {
    patch({
      zones: zones.filter((z) => z.id !== id),
      parts: parts.map((pt) => (pt.correctZoneId === id ? { ...pt, correctZoneId: '' } : pt)),
    })
  }

  // Pointer-drag a zone to reposition it.
  const startDrag = (e: React.PointerEvent, zone: AssemblyZone) => {
    e.stopPropagation()
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return
    const px = ((e.clientX - rect.left) / rect.width) * 100
    const py = ((e.clientY - rect.top) / rect.height) * 100
    dragState.current = { id: zone.id, offX: px - zone.x, offY: py - zone.y }

    const onMove = (ev: PointerEvent) => {
      const st = dragState.current
      const r = stageRef.current?.getBoundingClientRect()
      if (!st || !r) return
      const nx = clamp(((ev.clientX - r.left) / r.width) * 100 - st.offX)
      const ny = clamp(((ev.clientY - r.top) / r.height) * 100 - st.offY)
      updateZone(st.id, { x: nx, y: ny })
      force((n) => n + 1)
    }
    const onUp = () => {
      dragState.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const addPart = () => {
    patch({ parts: [...parts, { id: crypto.randomUUID(), label: '', imageUrl: '', correctZoneId: '' }] })
  }
  const updatePart = (id: string, p: Partial<AssemblyPart>) => {
    patch({ parts: parts.map((pt) => (pt.id === id ? { ...pt, ...p } : pt)) })
  }
  const removePart = (id: string) => {
    patch({ parts: parts.filter((pt) => pt.id !== id) })
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-2">
        <Label>Background image</Label>
        <QuizMediaUpload
          kind="image"
          slug={`${questionId}-bg`}
          value={imageUrl}
          onChange={(url) => onChange({ image_url: url || null })}
        />
      </div>

      <div className="grid gap-2">
        <Label>Drop zones</Label>
        <p className="text-xs text-muted-foreground">
          Click an empty spot on the image to add a drop zone, then drag it to position. Students
          drag parts onto these zones.
        </p>
        <div
          ref={stageRef}
          onClick={handleStageClick}
          className="relative w-full overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted"
          style={{ aspectRatio: imageUrl ? undefined : '16 / 9' }}
        >
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="Background" className="pointer-events-none block w-full select-none" draggable={false} />
          )}
          {zones.map((z) => (
            <div
              key={z.id}
              onPointerDown={(e) => startDrag(e, z)}
              style={{ left: `${z.x}%`, top: `${z.y}%`, width: `${z.width}%`, height: `${z.height}%` }}
              className="absolute flex cursor-grab items-center justify-center rounded-lg border-2 border-primary bg-primary/15 text-center text-[11px] font-semibold text-primary active:cursor-grabbing"
            >
              {z.label || 'Zone'}
            </div>
          ))}
          {zones.length === 0 && !imageUrl && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Upload an image, then click to add zones
            </div>
          )}
        </div>

        {zones.map((z) => (
          <div key={z.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
            <Input
              value={z.label}
              onChange={(e) => updateZone(z.id, { label: e.target.value })}
              placeholder="Zone label"
              className="flex-1"
            />
            <NumberField label="W%" value={z.width} onChange={(v) => updateZone(z.id, { width: clamp(v) })} />
            <NumberField label="H%" value={z.height} onChange={(v) => updateZone(z.id, { height: clamp(v) })} />
            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => removeZone(z.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="grid gap-2">
        <Label>Parts</Label>
        <p className="text-xs text-muted-foreground">
          Add each draggable part, its image, and the zone it belongs in.
        </p>
        {parts.map((pt, i) => (
          <div key={pt.id} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <Input
                value={pt.label}
                onChange={(e) => updatePart(pt.id, { label: e.target.value })}
                placeholder={`Part ${i + 1} label`}
                className="flex-1"
              />
              <Select value={pt.correctZoneId || undefined} onValueChange={(v) => updatePart(pt.id, { correctZoneId: v })}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Correct zone" />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.label || 'Zone'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => removePart(pt.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <QuizMediaUpload
              kind="image"
              slug={`${questionId}-part-${pt.id}`}
              value={pt.imageUrl}
              onChange={(url) => updatePart(pt.id, { imageUrl: url })}
              compact
            />
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addPart}>
          <Plus className="mr-2 h-4 w-4" /> Add Part
        </Button>
      </div>
    </div>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-1 text-xs text-muted-foreground">
      {label}
      <Input
        type="number"
        value={Math.round(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 w-16"
      />
    </label>
  )
}
