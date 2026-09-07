'use client'

import { ArrowDown, ArrowUp, Palette, Sparkles, Trash2, Upload } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Background } from '@/lib/quiz/composition'
import type { Selection } from './composition-canvas'

const ASPECTS = [
  { label: '16:9', value: 16 / 9 },
  { label: '16:10', value: 1.6 },
  { label: '4:3', value: 4 / 3 },
  { label: '1:1', value: 1 },
]
const SWATCHES = ['#2A1E17', '#1B1B1F', '#0F2A2E', '#3B2F4A', '#6B2E1E', '#F4EDE1', '#FFFFFF']

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{children}</div>
}

const layerName = (l: { name?: string; imageUrl: string }, i: number) => l.name || `Layer ${i + 1}`

export function InspectorBackground({
  background,
  aspect,
  selection,
  onSelect,
  onColor,
  onAspect,
  onReorderLayer,
  onRemoveLayer,
  onFitLayer,
  onAddLayers,
  adding,
  onFixImages,
  fixing,
  fixError,
  saved,
  busy: busyElsewhere,
}: {
  background: Background
  aspect: number
  selection: Selection
  onSelect: (s: Selection) => void
  onColor: (color: string, commit: boolean) => void
  onAspect: (aspect: number) => void
  onReorderLayer: (id: string, dir: -1 | 1) => void
  onRemoveLayer: (id: string) => void
  onFitLayer: (id: string) => void
  onAddLayers: (files: File[]) => void
  adding: { done: number; total: number } | null
  onFixImages: () => void
  fixing: { done: number; total: number } | null
  fixError: string | null
  saved: unknown
  /** Any long upload in flight, in this panel or the other one. */
  busy?: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const busy = !!adding || !!fixing || !!busyElsewhere

  return (
    <div className="grid content-start gap-5 p-3.5">
      <div>
        <Label>Canvas shape · layers and pieces re-fit, nothing distorts</Label>
        <div className="grid grid-cols-4 gap-1.5">
          {ASPECTS.map((a) => (
            <button
              key={a.label}
              type="button"
              aria-pressed={Math.abs(aspect - a.value) < 0.01}
              onClick={() => onAspect(a.value)}
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
        <Label>Background colour</Label>
        <div className="grid grid-cols-7 gap-1.5">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={background.color.toLowerCase() === c.toLowerCase()}
              onClick={() => onColor(c, true)}
              className={cn('aspect-square rounded-lg border-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]', background.color.toLowerCase() === c.toLowerCase() ? 'border-primary' : 'border-transparent')}
              style={{ background: c }}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Palette className="h-3.5 w-3.5 text-muted-foreground" />
          <Input value={background.color} onChange={(e) => onColor(e.target.value, false)} onBlur={(e) => onColor(e.target.value, true)} className="h-8 font-mono text-xs" aria-label="Hex colour" />
          <span className="h-8 w-8 shrink-0 rounded-lg border border-border" style={{ background: background.color }} />
        </div>
      </div>

      <div>
        <Label>
          Image layers <span className="font-medium normal-case tracking-normal">· back → front · the first one is the base frame</span>
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
                className={cn('grid grid-cols-[40px_1fr_auto] items-center gap-2.5 rounded-[10px] border-[1.5px] bg-raised p-2 text-left', on ? 'border-primary' : 'border-border')}
              >
                <span className="grid h-9 w-10 place-items-center overflow-hidden rounded-[7px] bg-sunken p-0.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.imageUrl} alt="" className="h-full w-full object-contain" />
                </span>
                <span className="min-w-0 text-xs font-semibold">
                  <span className="block truncate">{layerName(l, i)}</span>
                  <small className="block text-[11px] font-medium tabular-nums text-muted-foreground">
                    {Math.round(l.width)}% × {Math.round(l.height)}%{l.ratio ? ` · ratio ${l.ratio.toFixed(2)}` : ' · ratio unknown'}
                  </small>
                </span>
                <span className="inline-flex gap-0.5">
                  <button type="button" title="Fit the box to the image's natural ratio" aria-label="Fit to image" disabled={!l.ratio} onClick={(e) => { e.stopPropagation(); onFitLayer(l.id) }} className="h-6 rounded-md px-1.5 text-[10.5px] font-bold text-muted-foreground hover:bg-foreground/7 disabled:opacity-30">Fit</button>
                  <button type="button" aria-label="Send back" disabled={i === 0} onClick={(e) => { e.stopPropagation(); onReorderLayer(l.id, -1) }} className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/7 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" aria-label="Bring forward" disabled={i === background.layers.length - 1} onClick={(e) => { e.stopPropagation(); onReorderLayer(l.id, 1) }} className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/7 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button type="button" aria-label="Delete layer" onClick={(e) => { e.stopPropagation(); onRemoveLayer(l.id) }} className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/7 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </span>
              </div>
            )
          })}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/webp,image/jpeg"
            multiple
            disabled={busy}
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'))
              if (files.length) onAddLayers(files)
              e.target.value = ''
            }}
          />
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()} className="w-full justify-start">
            <Upload className="mr-2 h-4 w-4" /> {adding ? `Uploading ${adding.done} of ${adding.total}…` : 'Upload image layers'}
          </Button>
          <p className="text-[11.5px] leading-snug text-muted-foreground">New layers land centred at 30% width at their natural ratio. Drag to move; corners keep the ratio, edges are free.</p>
        </div>
      </div>

      <div className="grid gap-2 rounded-xl border border-gold/30 bg-gold/8 px-3.5 py-3 text-xs leading-snug">
        <b className="flex items-center gap-1.5 text-gold"><Sparkles className="h-3.5 w-3.5" /> Fix images</b>
        <span>Trims transparent margins off every piece and layer, shrinks them to 1024 px, uploads the new files and rewrites each piece’s size and target from where it sits in its export. Pieces exported at the base image’s size are placed automatically. Originals stay in storage; undo restores the previous data.</span>
        <Button type="button" size="sm" variant="outline" disabled={busy || (background.layers.length === 0)} onClick={onFixImages} className="w-fit">
          {fixing ? `Fixing ${fixing.done} of ${fixing.total}…` : 'Fix images'}
        </Button>
        {fixError && <span className="text-destructive">{fixError}</span>}
      </div>

      <details className="min-w-0">
        <summary className="cursor-pointer text-[11.5px] font-bold text-muted-foreground">Advanced · saved data</summary>
        <pre className="mt-2 max-h-[220px] max-w-full overflow-auto rounded-[10px] border border-border bg-sunken p-3 text-[11px] leading-snug text-muted-foreground">{JSON.stringify(saved, null, 2)}</pre>
      </details>
    </div>
  )
}
