'use client'

import { Eye, Grid3X3, Magnet, Pencil, Redo2, Target, Undo2, ZoomIn } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { PiecePlacementInput, useMeasuredAspect } from '@/components/class-viewer/lesson-viewer/quiz/piece-placement-input'
import { FeedbackBanner } from '@/components/class-viewer/lesson-viewer/quiz/feedback-banner'
import { useHistory } from '@/hooks/use-history'
import { cn } from '@/lib/utils'
import { readComposition, readPieces, readTolerance, shouldPersistAspect, type Background } from '@/lib/quiz/composition'
import { gradeQuestionScore, type PiecePlacement, type PlacementPiece } from '@/lib/quiz/grading'
import { patchLocalizedEntry, pruneLocalizedEntries, type LocalizedOptions } from '@/lib/quiz/options-es'
import { centreOf, pieceWarnings, placePiece, refitForAspect, type Centre } from '@/lib/quiz/placement'
import type { Rect } from '@/lib/quiz/transform'
import type { QuizQuestion } from '@/types/modules'
import { fixImages, importLayerFiles, importPieceFiles, measureNatural, sameSize, type Natural } from './builder-import'
import { CompositionCanvas, type Selection } from './composition-canvas'
import { InspectorBackground } from './inspector-background'
import { InspectorPieces } from './inspector-pieces'

export interface BuilderProps {
  questionId: string
  /** The question text, shown in the dialog header. */
  question?: string
  options: unknown
  /** Spanish overlay: `{ pieces: [{ id, label }] }` with the same piece ids. */
  optionsEs?: LocalizedOptions
  imageUrl: string
  onChange: (data: { options?: unknown; options_es?: unknown; image_url?: string | null }) => void
}

type Snapshot = { options: unknown; optionsEs: LocalizedOptions }
type Progress = { done: number; total: number } | null
const NEW_PIECE_WIDTH = 20

function Toggle({ on, onClick, icon: Icon, children, title, disabled }: { on?: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; title?: string; disabled?: boolean }) {
  return (
    <button type="button" aria-pressed={on} title={title} disabled={disabled} onClick={onClick} className={cn('inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40', on ? 'bg-raised text-foreground shadow-sm' : 'text-muted-foreground')}>
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  )
}

/** Natural pixel size per image URL (for aligned-set detection and sprite ratios). */
function useNaturalSizes(urls: string[]): Record<string, Natural> {
  const [sizes, setSizes] = useState<Record<string, Natural>>({})
  const key = urls.join('|')
  useEffect(() => {
    let alive = true
    for (const u of urls) {
      if (!u || sizes[u]) continue
      void measureNatural(u).then((n) => {
        if (alive && n) setSizes((s) => (s[u] ? s : { ...s, [u]: n }))
      })
    }
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return sizes
}

/** Student preview inside the dialog: the real input with local state plus Check / Reset. */
function PreviewPane({ background, pieces }: { background: Background; pieces: PlacementPiece[] }) {
  const [placement, setPlacement] = useState<Record<string, PiecePlacement>>({})
  const [graded, setGraded] = useState(false)
  const score = gradeQuestionScore({ question_type: 'piece_placement', options: { pieces } } as unknown as QuizQuestion, placement)
  return (
    <div className="grid gap-3.5 p-5">
      <PiecePlacementInput background={background} pieces={pieces} placement={placement} isGraded={graded} onChange={setPlacement} maxHeight="min(62vh, 640px)" />
      {graded && <FeedbackBanner score={score} />}
      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => { setPlacement({}); setGraded(false) }}>Reset</Button>
        <Button disabled={Object.keys(placement).length === 0 || graded} onClick={() => setGraded(true)}>Check placement</Button>
      </div>
    </div>
  )
}

export function PiecePlacementBuilderDialog({ open, onOpenChange, questionId, question, options, optionsEs = null, imageUrl, onChange }: BuilderProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const background = useMemo(() => readComposition(options, imageUrl), [options, imageUrl])
  const pieces = useMemo(() => readPieces(options), [options])
  const tolerance = useMemo(() => readTolerance(options), [options])
  const [tab, setTab] = useState<'background' | 'pieces'>('pieces')
  const [selection, setSelection] = useState<Selection>(pieces[0] ? { kind: 'piece', id: pieces[0].id } : null)
  const [snap, setSnap] = useState(true)
  const [showGrid, setShowGrid] = useState(false)
  const [showHalos, setShowHalos] = useState(false)
  const [zoom, setZoom] = useState<1 | 2>(1)
  const [preview, setPreview] = useState(false)
  const [importing, setImporting] = useState<Progress>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [adding, setAdding] = useState<Progress>(null)
  const [fixing, setFixing] = useState<Progress>(null)
  const [fixError, setFixError] = useState<string | null>(null)
  const { aspect, measured } = useMeasuredAspect(background)
  const history = useHistory<Snapshot>({ options, optionsEs })

  const naturals = useNaturalSizes([...background.layers.map((l) => l.imageUrl), ...pieces.map((p) => p.imageUrl)])
  const baseLayer = background.layers[0]
  const baseNatural = baseLayer ? naturals[baseLayer.imageUrl] : undefined
  const ratios = useMemo(() => {
    const out: Record<string, number> = {}
    for (const p of pieces) {
      const n = naturals[p.imageUrl]
      if (n) out[p.id] = n.width / n.height
    }
    return out
  }, [pieces, naturals])
  const fullFrameIds = useMemo(() => new Set(pieces.filter((p) => baseNatural && sameSize(naturals[p.imageUrl], baseNatural)).map((p) => p.id)), [pieces, naturals, baseNatural])
  const warnings = useMemo(() => pieceWarnings(pieces, aspect, tolerance, fullFrameIds), [pieces, aspect, tolerance, fullFrameIds])
  const labels = (p: PlacementPiece, i: number) => (p.label ?? '').trim() || `Piece ${i + 1}`
  /** One flag for every long upload: they share the same options, so only one may run at a time. */
  const busy = !!importing || !!adding || !!fixing
  /** What the Background tab's "saved data" shows: the current props, normalised. */
  const saved = useMemo(() => ({ image_url: null, options: { ...((options as Record<string, unknown>) ?? {}), background, pieces, tolerance } }), [options, background, pieces, tolerance])

  // ---- writes: every write autosaves through onChange; `commitLabel` also records a history entry
  // What the last write handed to `onChange`, updated synchronously so a commit that lands in the
  // same tick as its write (drag end) records the new state, not the props this render still holds.
  // It is also what every write merges into, so an upload that resolves seconds after it started
  // folds into whatever the state is *now* instead of reinstating the props it captured.
  const latest = useRef<Snapshot>({ options, optionsEs })
  useEffect(() => {
    latest.current = { options, optionsEs }
  }, [options, optionsEs])
  const build = (next: { background?: Background; pieces?: PlacementPiece[]; tolerance?: number }) => {
    const base = latest.current.options
    return {
      ...((base as Record<string, unknown>) ?? {}),
      background: next.background ?? readComposition(base, imageUrl),
      pieces: next.pieces ?? readPieces(base),
      tolerance: next.tolerance ?? readTolerance(base),
    }
  }
  const write = (next: { background?: Background; pieces?: PlacementPiece[]; tolerance?: number }, commitLabel?: string, es?: LocalizedOptions) => {
    const nextOptions = build(next)
    latest.current = { options: nextOptions, optionsEs: es !== undefined ? es : optionsEs }
    onChange({ options: nextOptions, image_url: null, ...(es !== undefined ? { options_es: es } : {}) })
    if (commitLabel) history.commit(latest.current)
  }
  const commitNow = () => history.commit(latest.current)
  const restore = (s: Snapshot) => {
    latest.current = s
    onChange({ options: s.options, options_es: s.optionsEs, image_url: null })
  }
  const undo = () => { const s = history.undo(); if (s) restore(s) }
  const redo = () => { const s = history.redo(); if (s) restore(s) }

  // The summary card mounts this dialog closed, so the first snapshot can be stale: re-seed on open,
  // with the *normalised* options so undoing all the way back never yields a row that has no
  // background (the write path always sets image_url to null).
  useEffect(() => {
    if (open) {
      latest.current = { options, optionsEs }
      const seed = { options: build({}), optionsEs }
      latest.current = seed
      history.reset(seed)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // An undo can drop the piece or layer the selection points at; forget it rather than keep
  // an inspector row and a canvas handle for something that no longer exists.
  useEffect(() => {
    if (!selection) return
    const list = selection.kind === 'piece' ? pieces : background.layers
    if (!list.some((x) => x.id === selection.id)) setSelection(null)
  }, [selection, pieces, background.layers])

  // Migrated rows carry aspect: null; persist the measured ratio the first time it's actually known.
  useEffect(() => {
    if (shouldPersistAspect({ open, storedAspect: background.aspect, layerCount: background.layers.length, measured })) write({ background: { ...background, aspect } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, aspect, measured, background.aspect])

  // ---- pieces
  const withPiece = (id: string, fn: (p: PlacementPiece) => PlacementPiece) => pieces.map((p) => (p.id === id ? fn(p) : p))
  const movePiece = (id: string, centre: Centre) => write({ pieces: withPiece(id, (p) => placePiece(p, centre, p.width, aspect, tolerance)) })
  const sizePiece = (id: string, width: number) => write({ pieces: withPiece(id, (p) => placePiece(p, centreOf(p.area), width, aspect, tolerance)) })
  const patchPiece = (id: string, patch: Partial<PlacementPiece>) =>
    write({
      pieces: withPiece(id, (p) => {
        const merged = { ...p, ...patch }
        if (merged.tolerance === undefined) delete merged.tolerance
        return placePiece(merged, centreOf(p.area), merged.width, aspect, tolerance)
      }),
    })
  const removePiece = (id: string) => {
    const remaining = pieces.filter((p) => p.id !== id)
    const es = pruneLocalizedEntries(optionsEs, 'pieces', remaining.map((p) => p.id))
    write({ pieces: remaining }, 'remove piece', es)
    if (selection?.kind === 'piece' && selection.id === id) setSelection(null)
  }
  const setLabelEs = (id: string, label: string) => {
    const es = patchLocalizedEntry(optionsEs, 'pieces', id, { label })
    latest.current = { options: latest.current.options, optionsEs: es }
    onChange({ options_es: es })
  }
  const setTolerance = (t: number, commit: boolean) => write({ tolerance: t, pieces: pieces.map((p) => placePiece(p, centreOf(p.area), p.width, aspect, t)) }, commit ? 'tolerance' : undefined)

  const importPieces = async (files: File[]) => {
    setImportError(null)
    setImporting({ done: 0, total: files.length })
    try {
      const imported = await importPieceFiles(files, { questionId, base: baseLayer && baseNatural ? { rect: baseLayer, natural: baseNatural } : null, onProgress: (done, total) => setImporting({ done, total }) })
      // Place and append against the state as it is *now*, not the props this call closed over.
      const now = latest.current.options
      const t = readTolerance(now)
      const added = imported.map((it) => {
        const seed: PlacementPiece = { id: it.id, label: it.label, imageUrl: it.imageUrl, ratio: it.ratio, width: NEW_PIECE_WIDTH, area: { x: 0, y: 0, width: 0, height: 0 } }
        return it.aligned ? placePiece(seed, it.aligned.centre, it.aligned.width, aspect, t) : placePiece(seed, { x: 50, y: 50 }, NEW_PIECE_WIDTH, aspect, t)
      })
      write({ pieces: [...readPieces(now), ...added] }, `import ${added.length} piece${added.length === 1 ? '' : 's'}`)
      if (added[0]) setSelection({ kind: 'piece', id: added[0].id })
      setTab('pieces')
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(null)
    }
  }

  // ---- background
  const setBackground = (patch: Partial<Background>, commitLabel?: string) => write({ background: { ...background, ...patch } }, commitLabel)
  const setLayerRect = (id: string, r: Rect) => setBackground({ layers: background.layers.map((l) => (l.id === id ? { ...l, ...r } : l)) })
  const setAspect = (a: number) => {
    const out = refitForAspect(background, pieces, a, tolerance)
    write({ background: out.background, pieces: out.pieces }, 'canvas shape')
  }
  const fitLayer = (id: string) => {
    const l = background.layers.find((x) => x.id === id)
    if (!l?.ratio) return
    const height = Math.min(100, (l.width * aspect) / l.ratio)
    const y = Math.min(100 - height, Math.max(0, l.y + l.height / 2 - height / 2))
    setBackground({ layers: background.layers.map((x) => (x.id === id ? { ...x, height, y } : x)) }, 'fit layer')
  }
  const reorderLayer = (id: string, dir: -1 | 1) => {
    const i = background.layers.findIndex((l) => l.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= background.layers.length) return
    const next = [...background.layers]
    ;[next[i], next[j]] = [next[j], next[i]]
    setBackground({ layers: next }, 'reorder layers')
  }
  const removeLayer = (id: string) => {
    setBackground({ layers: background.layers.filter((l) => l.id !== id) }, 'remove layer')
    if (selection?.kind === 'layer' && selection.id === id) setSelection(null)
  }
  const addLayers = async (files: File[]) => {
    setFixError(null)
    setAdding({ done: 0, total: files.length })
    try {
      const added = await importLayerFiles(files, { questionId, aspect, onProgress: (done, total) => setAdding({ done, total }) })
      // Append to the layers as they are *now*, not the props this call closed over.
      const now = readComposition(latest.current.options, imageUrl)
      write({ background: { ...now, layers: [...now.layers, ...added] } }, `add ${added.length} layer${added.length === 1 ? '' : 's'}`)
      if (added[0]) setSelection({ kind: 'layer', id: added[0].id })
    } catch (e) {
      setFixError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setAdding(null)
    }
  }
  const runFixImages = async () => {
    setFixError(null)
    setFixing({ done: 0, total: background.layers.length + pieces.length })
    try {
      const out = await fixImages({ questionId, background, pieces, aspect, tolerance, onProgress: (done, total) => setFixing({ done, total }) })
      write({ background: out.background, pieces: out.pieces }, 'fix images')
    } catch (e) {
      setFixError(e instanceof Error ? e.message : 'Fix images failed')
    } finally {
      setFixing(null)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z' || preview) return
    e.preventDefault()
    if (e.shiftKey) redo()
    else undo()
  }
  const done = () => {
    history.reset({ options: build({}), optionsEs: latest.current.optionsEs })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        onKeyDown={onKeyDown}
        onEscapeKeyDown={(e) => {
          // Radix listens for Escape on the document in the capture phase, so the
          // canvas can't swallow it: deselect here instead of closing the dialog.
          if (selection) {
            e.preventDefault()
            setSelection(null)
          }
        }}
        className="flex h-[92vh] w-[96vw] max-w-[1280px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1280px]"
      >
        <DialogTitle className="sr-only">Drag-and-drop builder</DialogTitle>
        <div className="flex flex-wrap items-center gap-2.5 border-b border-border bg-sunken px-3.5 py-2.5">
          <div className="mr-auto min-w-0">
            <div className="font-heading text-[13px] font-bold">Drag into place</div>
            {question && <div className="max-w-[46ch] truncate text-xs text-muted-foreground">{question}</div>}
          </div>
          <div className="inline-flex gap-0.5 rounded-[9px] border border-border p-0.5">
            <Toggle on={!preview} onClick={() => setPreview(false)} icon={Pencil}>Design</Toggle>
            <Toggle on={preview} onClick={() => setPreview(true)} icon={Eye}>Preview as student</Toggle>
          </div>
          {!preview && (
            <>
              <div className="inline-flex gap-0.5 rounded-[9px] border border-border p-0.5">
                <Toggle onClick={undo} icon={Undo2} disabled={!history.canUndo} title="Undo (⌘Z)">Undo</Toggle>
                <Toggle onClick={redo} icon={Redo2} disabled={!history.canRedo} title="Redo (⇧⌘Z)">Redo</Toggle>
              </div>
              <div className="inline-flex gap-0.5 rounded-[9px] border border-border p-0.5">
                <Toggle on={showHalos} onClick={() => setShowHalos(!showHalos)} icon={Target} title="Show every piece's tolerance">Tolerance</Toggle>
                <Toggle on={showGrid} onClick={() => setShowGrid(!showGrid)} icon={Grid3X3}>Grid</Toggle>
                <Toggle on={snap} onClick={() => setSnap(!snap)} icon={Magnet}>Snap</Toggle>
                <Toggle on={zoom === 2} onClick={() => setZoom(zoom === 2 ? 1 : 2)} icon={ZoomIn}>2×</Toggle>
              </div>
            </>
          )}
          <Button size="sm" onClick={done}>Done</Button>
        </div>

        {preview ? (
          <div className="min-h-0 flex-1 overflow-auto"><PreviewPane background={background} pieces={pieces} /></div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto]">
              <CompositionCanvas
                background={background}
                pieces={pieces}
                aspect={aspect}
                tolerance={tolerance}
                ratios={ratios}
                selection={selection}
                onSelect={setSelection}
                onLayerRect={setLayerRect}
                onPieceCentre={movePiece}
                onPieceWidth={sizePiece}
                onRemovePiece={removePiece}
                onGestureEnd={commitNow}
                snap={snap}
                showGrid={showGrid}
                showHalos={showHalos}
                zoom={zoom}
                warnings={warnings}
                labels={labels}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 text-[11.5px] text-muted-foreground">
                <span>Autosaves as you go · {history.canUndo ? 'undo available until Done' : 'nothing to undo yet'}</span>
                <span>← ↑ ↓ → nudge 0.1% · Shift 1% · ⌫ remove · ⌘Z undo</span>
              </div>
            </div>
            <div className="grid min-h-0 grid-rows-[auto_1fr] overflow-hidden border-t border-border bg-card md:border-l md:border-t-0">
              <div className="grid grid-cols-2 border-b border-border">
                <button type="button" aria-pressed={tab === 'pieces'} onClick={() => setTab('pieces')} className={cn('-mb-px border-b-2 p-3 text-xs font-bold', tab === 'pieces' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground')}>Pieces · {pieces.length}</button>
                <button type="button" aria-pressed={tab === 'background'} onClick={() => setTab('background')} className={cn('-mb-px border-b-2 p-3 text-xs font-bold', tab === 'background' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground')}>Background</button>
              </div>
              <div className="min-h-0 overflow-auto">
                {tab === 'background' ? (
                  <InspectorBackground
                    background={background}
                    aspect={aspect}
                    selection={selection}
                    onSelect={setSelection}
                    onColor={(color, commit) => setBackground({ color }, commit ? 'colour' : undefined)}
                    onAspect={setAspect}
                    onReorderLayer={reorderLayer}
                    onRemoveLayer={removeLayer}
                    onFitLayer={fitLayer}
                    onAddLayers={(files) => void addLayers(files)}
                    adding={adding}
                    onFixImages={() => void runFixImages()}
                    fixing={fixing}
                    fixError={fixError}
                    saved={saved}
                    busy={busy}
                  />
                ) : (
                  <InspectorPieces
                    pieces={pieces}
                    optionsEs={optionsEs}
                    selection={selection}
                    onSelect={setSelection}
                    onPatch={patchPiece}
                    onCentre={movePiece}
                    onCommit={commitNow}
                    onLabelEs={setLabelEs}
                    onRemove={removePiece}
                    onImport={(files) => void importPieces(files)}
                    importing={importing}
                    importError={importError}
                    tolerance={tolerance}
                    onTolerance={setTolerance}
                    warnings={warnings}
                    labels={labels}
                    busy={busy}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
