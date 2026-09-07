'use client'

import { ChevronRight, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { PlacementPiece } from '@/lib/quiz/grading'
import { readLocalizedField, type LocalizedOptions } from '@/lib/quiz/options-es'
import { centreOf, type Centre, type PieceWarning } from '@/lib/quiz/placement'
import { clampPieceWidth } from '@/lib/quiz/transform'
import type { Selection } from './composition-canvas'

export function warningText(w: PieceWarning): string {
  switch (w.code) {
    case 'noName':
      return 'No name'
    case 'swappable':
      return `Swappable with #${w.with.join(', #')} · exchanging them still passes; tighten the tolerance or merge them`
    case 'offCanvas':
      return 'Off canvas'
    case 'fullFrame':
      return 'Image is still full-frame · run Fix images (Background tab)'
  }
}

const num = (v: string): number | undefined => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : undefined
}

function Field({ label, value, step = 0.1, onChange, onCommit }: { label: string; value: number; step?: number; onChange: (v: number) => void; onCommit: () => void }) {
  const [text, setText] = useState<string | null>(null)
  return (
    <label className="grid gap-0.5 text-center text-[10px] font-bold text-muted-foreground">
      {label}
      <input
        type="number"
        step={step}
        value={text ?? String(Math.round(value * 10) / 10)}
        onChange={(e) => {
          setText(e.target.value)
          const v = num(e.target.value)
          if (v !== undefined) onChange(v)
        }}
        onBlur={() => {
          setText(null)
          onCommit()
        }}
        className="h-7 w-full rounded-[7px] border border-border bg-sunken text-center text-xs tabular-nums outline-none focus:border-primary"
      />
    </label>
  )
}

export function InspectorPieces({
  pieces,
  optionsEs,
  selection,
  onSelect,
  onPatch,
  onCentre,
  onCommit,
  onLabelEs,
  onRemove,
  onImport,
  importing,
  importError,
  tolerance,
  onTolerance,
  warnings,
  labels,
  busy: busyElsewhere,
}: {
  pieces: PlacementPiece[]
  optionsEs: LocalizedOptions
  selection: Selection
  onSelect: (s: Selection) => void
  onPatch: (id: string, patch: Partial<PlacementPiece>) => void
  onCentre: (id: string, centre: Centre) => void
  onCommit: (label: string) => void
  onLabelEs: (id: string, label: string) => void
  onRemove: (id: string) => void
  onImport: (files: File[]) => void
  importing: { done: number; total: number } | null
  importError: string | null
  tolerance: number
  onTolerance: (t: number, commit: boolean) => void
  warnings: Record<string, PieceWarning[]>
  labels: (piece: PlacementPiece, index: number) => string
  /** Any long upload in flight, in this panel or the other one. */
  busy?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const busy = !!importing || !!busyElsewhere
  const pick = (list: FileList | null) => {
    if (busy) return
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith('image/'))
    if (files.length) onImport(files)
  }

  return (
    <div className="grid content-start gap-3 p-3.5">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!busy) setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          if (busy) return
          setOver(false)
          pick(e.dataTransfer.files)
        }}
        className={cn('grid gap-1.5 rounded-xl border-[1.5px] border-dashed p-3 text-center text-xs', over ? 'border-primary bg-primary/8' : 'border-foreground/25')}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/webp,image/jpeg"
          multiple
          disabled={busy}
          className="hidden"
          onChange={(e) => {
            pick(e.target.files)
            e.target.value = ''
          }}
        />
        {importing ? (
          <span className="font-semibold">Importing {importing.done} of {importing.total}…</span>
        ) : (
          <>
            <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="inline-flex items-center justify-center gap-1.5 font-semibold text-foreground hover:text-primary disabled:opacity-40">
              <Upload className="h-3.5 w-3.5" /> Drop PNGs here or click to choose
            </button>
            <span className="leading-snug text-muted-foreground">Several at once is fine. Files with the base image’s pixel size are trimmed and placed automatically; others land centred at 20% width.</span>
          </>
        )}
        {importError && <span className="text-destructive">{importError}</span>}
      </div>

      <label className="grid gap-1 text-xs text-muted-foreground">
        <span className="flex justify-between">
          <span>Tolerance for the whole question · the halo around each piece</span>
          <b className="font-mono font-medium text-foreground">{tolerance}%</b>
        </span>
        <input type="range" min={1} max={12} step={0.5} value={tolerance} onChange={(e) => onTolerance(Number(e.target.value), false)} onPointerUp={() => onTolerance(tolerance, true)} onKeyUp={() => onTolerance(tolerance, true)} className="w-full accent-primary" aria-label="Tolerance for the whole question" />
      </label>

      {pieces.map((p, i) => {
        const on = selection?.kind === 'piece' && selection.id === p.id
        const warn = warnings[p.id] ?? []
        const c = centreOf(p.area)
        return (
          <div key={p.id} data-row={p.id} aria-selected={on} onClick={() => onSelect({ kind: 'piece', id: p.id })} className={cn('grid gap-2 rounded-xl border-[1.5px] bg-raised p-2', on ? 'border-primary' : 'border-border')}>
            <div className="grid grid-cols-[22px_40px_1fr_auto] items-center gap-2">
              <span className={cn('grid h-5 w-5 place-items-center rounded-full text-[10.5px] font-bold text-white', warn.length ? 'bg-terracotta' : 'bg-primary')}>{i + 1}</span>
              <span className="grid h-9 w-10 place-items-center overflow-hidden rounded-lg bg-sunken p-1">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-[10px] text-muted-foreground">img</span>
                )}
              </span>
              <span className="grid min-w-0 gap-0.5">
                <Input
                  value={p.label ?? ''}
                  onChange={(e) => onPatch(p.id, { label: e.target.value })}
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (v !== p.label) onPatch(p.id, { label: v })
                    onCommit('name')
                  }}
                  placeholder="Name (English)"
                  aria-label="Name"
                  className="h-7 border-0 bg-transparent px-0 text-[13px] font-semibold shadow-none focus-visible:ring-0"
                />
                <Input
                  value={readLocalizedField(optionsEs, 'pieces', p.id, 'label')}
                  onChange={(e) => onLabelEs(p.id, e.target.value)}
                  onBlur={() => onCommit('Spanish name')}
                  placeholder="Nombre (Español)"
                  aria-label="Nombre en español"
                  className="h-6 border-0 bg-transparent px-0 text-xs text-muted-foreground shadow-none focus-visible:ring-0"
                />
              </span>
              <span className="grid justify-items-end gap-1">
                <input
                  type="number"
                  step={0.5}
                  min={0}
                  max={20}
                  value={p.tolerance ?? ''}
                  placeholder={`${tolerance}%`}
                  title="Tolerance for this piece (blank = question default)"
                  aria-label="Tolerance for this piece"
                  onChange={(e) => onPatch(p.id, { tolerance: e.target.value === '' ? undefined : Math.min(20, Math.max(0, Number(e.target.value))) })}
                  onBlur={() => onCommit('tolerance')}
                  className="h-6 w-14 rounded-md border border-border bg-sunken text-center font-mono text-[11px] tabular-nums outline-none focus:border-primary"
                />
                <button
                  type="button"
                  aria-label={`Remove ${labels(p, i)}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(p.id)
                  }}
                  className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/7 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
            {warn.map((w) => (
              <p key={w.code} className="flex items-start gap-1.5 text-[11.5px] leading-snug text-terracotta">
                <span className="mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-terracotta text-[9px] font-bold text-white">!</span>
                {warningText(w)}
              </p>
            ))}
            {on && (
              <details className="grid gap-2">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11.5px] font-bold text-muted-foreground [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="h-3 w-3 transition-transform [details[open]>summary>&]:rotate-90" /> Precise values
                </summary>
                <div className="grid grid-cols-3 gap-1.5">
                  <Field label="X" value={c.x} onChange={(v) => onCentre(p.id, { x: v, y: c.y })} onCommit={() => onCommit('position')} />
                  <Field label="Y" value={c.y} onChange={(v) => onCentre(p.id, { x: c.x, y: v })} onCommit={() => onCommit('position')} />
                  <Field label="Size" value={p.width} onChange={(v) => onPatch(p.id, { width: clampPieceWidth(v) })} onCommit={() => onCommit('size')} />
                </div>
              </details>
            )}
          </div>
        )
      })}
      {pieces.length === 0 && <p className="text-center text-xs text-muted-foreground">No pieces yet. Drop the exported part images above.</p>}
      <div className="grid gap-1.5 rounded-xl border border-gold/30 bg-gold/8 px-3.5 py-3 text-xs leading-snug">
        <b className="text-gold">How it works</b>
        Every piece sits on the canvas where it belongs, at the size the student sees. Drag it to move, pull the gold dot to resize, use the arrows to nudge. The dashed halo is how far off a student can be and still pass.
      </div>
    </div>
  )
}
