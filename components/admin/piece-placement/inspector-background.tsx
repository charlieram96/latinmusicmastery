'use client'

import { ArrowDown, ArrowUp, Palette, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Background, BackgroundLayer } from '@/lib/quiz/composition'
import { QuizMediaUpload } from '../quiz-media-upload'
import type { Selection } from './composition-canvas'

const ASPECTS = [
  { label: '16:9', value: 16 / 9 },
  { label: '16:10', value: 1.6 },
  { label: '4:3', value: 4 / 3 },
  { label: '1:1', value: 1 },
]
const SWATCHES = ['#2A1E17', '#1B1B1F', '#0F2A2E', '#3B2F4A', '#6B2E1E', '#F4EDE1', '#FFFFFF']

/** Read an image's natural ratio so a new layer lands at a sensible size with its corners ratio-locked. */
function measure(url: string): Promise<number | undefined> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : undefined)
    img.onerror = () => resolve(undefined)
    img.src = url
  })
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{children}</div>
}

export function InspectorBackground({
  questionId,
  background,
  selection,
  onSelect,
  onChange,
}: {
  questionId: string
  background: Background
  selection: Selection
  onSelect: (s: Selection) => void
  onChange: (patch: Partial<Background>) => void
}) {
  const aspect = background.aspect ?? 1.6
  const setLayers = (layers: BackgroundLayer[]) => onChange({ layers })

  const addLayer = async (url: string) => {
    if (!url) return
    const ratio = await measure(url)
    const width = 30
    const height = Math.min(100, ratio ? (width * aspect) / ratio : width)
    const layer: BackgroundLayer = { id: crypto.randomUUID(), imageUrl: url, x: 50 - width / 2, y: Math.max(0, 50 - height / 2), width, height, ...(ratio ? { ratio } : {}) }
    setLayers([...background.layers, layer])
    onSelect({ kind: 'layer', id: layer.id })
  }
  const reorder = (id: string, dir: -1 | 1) => {
    const i = background.layers.findIndex((l) => l.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= background.layers.length) return
    const next = [...background.layers]
    ;[next[i], next[j]] = [next[j], next[i]]
    setLayers(next)
  }
  const remove = (id: string) => {
    setLayers(background.layers.filter((l) => l.id !== id))
    if (selection?.kind === 'layer' && selection.id === id) onSelect(null)
  }

  return (
    <div className="grid content-start gap-5 p-3.5">
      <div>
        <Label>Canvas shape</Label>
        <div className="grid grid-cols-4 gap-1.5">
          {ASPECTS.map((a) => (
            <button
              key={a.label}
              type="button"
              aria-pressed={Math.abs(aspect - a.value) < 0.01}
              onClick={() => onChange({ aspect: a.value })}
              className={cn(
                'grid place-items-center gap-1 rounded-[9px] border-[1.5px] px-1 py-2 text-[11px] font-bold',
                Math.abs(aspect - a.value) < 0.01 ? 'border-primary bg-primary/8 text-foreground' : 'border-border text-muted-foreground',
              )}
            >
              <i className="block rounded-[2px] border-[1.5px] border-current" style={{ width: 22, height: 22 / a.value }} />
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Background color</Label>
        <div className="grid grid-cols-7 gap-1.5">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={background.color.toLowerCase() === c.toLowerCase()}
              onClick={() => onChange({ color: c })}
              className={cn('aspect-square rounded-lg border-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]', background.color.toLowerCase() === c.toLowerCase() ? 'border-primary' : 'border-transparent')}
              style={{ background: c }}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Palette className="h-3.5 w-3.5 text-muted-foreground" />
          <Input value={background.color} onChange={(e) => onChange({ color: e.target.value })} className="h-8 font-mono text-xs" aria-label="Hex color" />
          <span className="h-8 w-8 shrink-0 rounded-lg border border-border" style={{ background: background.color }} />
        </div>
      </div>

      <div>
        <Label>
          Image layers <span className="font-medium normal-case tracking-normal">· back → front</span>
        </Label>
        <div className="grid gap-1.5">
          {background.layers.map((l, i) => {
            const on = selection?.kind === 'layer' && selection.id === l.id
            return (
              <div
                key={l.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect({ kind: 'layer', id: l.id })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onSelect({ kind: 'layer', id: l.id })
                }}
                className={cn('grid grid-cols-[34px_1fr_auto] items-center gap-2.5 rounded-[10px] border-[1.5px] bg-raised p-2 text-left', on ? 'border-primary' : 'border-border')}
              >
                <span className="grid h-[30px] w-[34px] place-items-center overflow-hidden rounded-[7px] bg-sunken">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.imageUrl} alt="" className="h-full w-full object-cover" />
                </span>
                <span className="text-xs font-semibold">
                  Layer {i + 1}
                  <small className="block text-[11px] font-medium tabular-nums text-muted-foreground">{Math.round(l.width)}% × {Math.round(l.height)}%</small>
                </span>
                <span className="inline-flex gap-0.5">
                  <button type="button" aria-label="Send back" disabled={i === 0} onClick={(e) => { e.stopPropagation(); reorder(l.id, -1) }} className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/7 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" aria-label="Bring forward" disabled={i === background.layers.length - 1} onClick={(e) => { e.stopPropagation(); reorder(l.id, 1) }} className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/7 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button type="button" aria-label="Delete layer" onClick={(e) => { e.stopPropagation(); remove(l.id) }} className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/7 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </span>
              </div>
            )
          })}
          <QuizMediaUpload key={background.layers.length} kind="image" slug={`${questionId}-layer-${background.layers.length}`} value="" onChange={(url) => void addLayer(url)} compact />
          <p className="text-[11.5px] leading-snug text-muted-foreground">New layers land centered at 30% width. Drag to move; pull a corner to resize (ratio locked).</p>
        </div>
      </div>
    </div>
  )
}
