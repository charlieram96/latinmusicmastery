'use client'

import { Eye, Grid3X3, Pencil, Target } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { PiecePlacementInput, useStageAspect } from '@/components/class-viewer/lesson-viewer/quiz/piece-placement-input'
import { FeedbackBanner } from '@/components/class-viewer/lesson-viewer/quiz/feedback-banner'
import { cn } from '@/lib/utils'
import { readComposition, readPieces, type Background } from '@/lib/quiz/composition'
import { gradeQuestionScore, type PiecePlacement, type PlacementPiece } from '@/lib/quiz/grading'
import { patchLocalizedEntry, pruneLocalizedEntries, type LocalizedOptions } from '@/lib/quiz/options-es'
import type { Rect } from '@/lib/quiz/transform'
import type { QuizQuestion } from '@/types/modules'
import { CompositionCanvas, type Selection } from './composition-canvas'
import { InspectorBackground } from './inspector-background'
import { InspectorPieces } from './inspector-pieces'

export interface BuilderProps {
  questionId: string
  options: unknown
  /** Spanish overlay: `{ pieces: [{ id, label }] }` with the same piece ids. */
  optionsEs?: LocalizedOptions
  imageUrl: string
  onChange: (data: { options?: unknown; options_es?: unknown; image_url?: string | null }) => void
}

function Toggle({ on, onClick, icon: Icon, children }: { on: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={cn('inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-1.5 text-xs font-semibold', on ? 'bg-raised text-foreground shadow-sm' : 'text-muted-foreground')}>
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  )
}

/** Student preview inside the dialog: the real input with local state plus Check / Reset. */
function PreviewPane({ background, pieces }: { background: Background; pieces: PlacementPiece[] }) {
  const [placement, setPlacement] = useState<Record<string, PiecePlacement>>({})
  const [graded, setGraded] = useState(false)
  const score = gradeQuestionScore({ question_type: 'piece_placement', options: { pieces } } as unknown as QuizQuestion, placement)
  return (
    <div className="grid gap-3.5 p-5">
      <PiecePlacementInput background={background} pieces={pieces} placement={placement} isGraded={graded} onChange={setPlacement} maxHeight="420px" />
      {graded && <FeedbackBanner score={score} />}
      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => { setPlacement({}); setGraded(false) }}>Reset</Button>
        <Button disabled={Object.keys(placement).length === 0 || graded} onClick={() => setGraded(true)}>Check placement</Button>
      </div>
    </div>
  )
}

export function PiecePlacementBuilderDialog({ open, onOpenChange, questionId, options, optionsEs = null, imageUrl, onChange }: BuilderProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const background = useMemo(() => readComposition(options, imageUrl), [options, imageUrl])
  const pieces = useMemo(() => readPieces(options), [options])
  const [tab, setTab] = useState<'background' | 'pieces'>('pieces')
  const [selection, setSelection] = useState<Selection>(pieces[0] ? { kind: 'piece', id: pieces[0].id } : null)
  const [snap, setSnap] = useState(true)
  const [showGrid, setShowGrid] = useState(true)
  const [preview, setPreview] = useState(false)
  const aspect = useStageAspect(background)

  const write = (next: { background?: Background; pieces?: PlacementPiece[] }) =>
    onChange({ options: { ...((options as Record<string, unknown>) ?? {}), background: next.background ?? background, pieces: next.pieces ?? pieces }, image_url: null })

  // Migrated rows carry aspect: null; persist the measured ratio the first time the builder sees one.
  useEffect(() => {
    if (open && background.aspect == null && background.layers.length > 0 && aspect) write({ background: { ...background, aspect } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, aspect, background.aspect])

  const setBackground = (patch: Partial<Background>) => write({ background: { ...background, ...patch } })
  const setLayerRect = (id: string, r: Rect) => setBackground({ layers: background.layers.map((l) => (l.id === id ? { ...l, ...r } : l)) })
  const patchPiece = (id: string, patch: Partial<PlacementPiece>) => write({ pieces: pieces.map((p) => (p.id === id ? { ...p, ...patch } : p)) })
  const addPiece = () => {
    const id = crypto.randomUUID()
    write({ pieces: [...pieces, { id, label: '', imageUrl: '', width: 15, area: { x: 40, y: 40, width: 20, height: 15 } }] })
    setSelection({ kind: 'piece', id })
    setTab('pieces')
  }
  const removePiece = (id: string) => {
    const remaining = pieces.filter((p) => p.id !== id)
    onChange({ options: { ...((options as Record<string, unknown>) ?? {}), background, pieces: remaining }, options_es: pruneLocalizedEntries(optionsEs, 'pieces', remaining.map((p) => p.id)), image_url: null })
    if (selection?.kind === 'piece' && selection.id === id) setSelection(null)
  }
  const setLabelEs = (id: string, label: string) => onChange({ options_es: patchLocalizedEntry(optionsEs, 'pieces', id, { label }) })

  const saved = useMemo(() => JSON.stringify({ image_url: null, options: { background, pieces: pieces.length > 1 ? [pieces[0], `… ${pieces.length - 1} more`] : pieces } }, null, 2), [background, pieces])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} aria-describedby={undefined} className="flex h-[90vh] w-[96vw] max-w-[1200px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1200px]">
        <DialogTitle className="sr-only">Drag-and-drop builder</DialogTitle>
        <div className="flex flex-wrap items-center gap-2.5 border-b border-border bg-sunken px-3.5 py-2.5">
          <span className="mr-auto font-heading text-[13px] font-bold">Drag into place</span>
          <div className="inline-flex gap-0.5 rounded-[9px] border border-border p-0.5">
            <Toggle on={!preview} onClick={() => setPreview(false)} icon={Pencil}>Design</Toggle>
            <Toggle on={preview} onClick={() => setPreview(true)} icon={Eye}>Preview as student</Toggle>
          </div>
          {!preview && (
            <div className="inline-flex gap-0.5 rounded-[9px] border border-border p-0.5">
              <Toggle on={snap} onClick={() => setSnap(!snap)} icon={Target}>Snap</Toggle>
              <Toggle on={showGrid} onClick={() => setShowGrid(!showGrid)} icon={Grid3X3}>Grid</Toggle>
            </div>
          )}
          <Button size="sm" onClick={() => onOpenChange(false)}>Done</Button>
        </div>

        {preview ? (
          <div className="min-h-0 flex-1 overflow-auto"><PreviewPane background={background} pieces={pieces} /></div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[minmax(0,1fr)_300px]">
            <div className="grid min-h-0 grid-rows-[1fr_auto] overflow-auto">
              <CompositionCanvas background={background} pieces={pieces} selection={selection} onSelect={setSelection} onLayerRect={setLayerRect} onPieceArea={(id, r) => patchPiece(id, { area: r })} onPieceWidth={(id, w) => patchPiece(id, { width: w })} snap={snap} showGrid={showGrid} />
              <details className="px-4 pb-3.5">
                <summary className="cursor-pointer text-[11.5px] font-bold text-muted-foreground">What gets saved (live)</summary>
                <pre className="mt-2 max-h-[220px] overflow-auto rounded-[10px] border border-border bg-sunken p-3 text-[11.5px] leading-snug text-muted-foreground">{saved}</pre>
              </details>
            </div>
            <div className="grid min-h-0 grid-rows-[auto_1fr] overflow-hidden border-t border-border bg-card md:border-l md:border-t-0">
              <div className="grid grid-cols-2 border-b border-border">
                <button type="button" aria-pressed={tab === 'background'} onClick={() => setTab('background')} className={cn('-mb-px border-b-2 p-3 text-xs font-bold', tab === 'background' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground')}>Background</button>
                <button type="button" aria-pressed={tab === 'pieces'} onClick={() => setTab('pieces')} className={cn('-mb-px border-b-2 p-3 text-xs font-bold', tab === 'pieces' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground')}>Pieces · {pieces.length}</button>
              </div>
              <div className="min-h-0 overflow-auto">
                {tab === 'background' ? (
                  <InspectorBackground questionId={questionId} background={background} selection={selection} onSelect={setSelection} onChange={setBackground} />
                ) : (
                  <InspectorPieces questionId={questionId} pieces={pieces} optionsEs={optionsEs} selection={selection} onSelect={setSelection} onPatch={patchPiece} onLabelEs={setLabelEs} onAdd={addPiece} onRemove={removePiece} />
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
