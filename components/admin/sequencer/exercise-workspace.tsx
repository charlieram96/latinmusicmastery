'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { SequencerPanel } from './sequencer-panel'
import { SequencerToolbar } from './sequencer-toolbar'
import { PreviewPanel } from './preview-panel'
import { useSequencerState } from '@/hooks/use-sequencer-state'
import { useAdminPlayback } from '@/hooks/use-admin-playback'
import type { ExerciseEvent, ExerciseDefinition, Instrument, Difficulty } from '@/lib/play-sense/types'
import { ChevronDown, ChevronUp, Code2 } from 'lucide-react'

interface ExerciseWorkspaceProps {
  events: ExerciseEvent[]
  onChange: (events: ExerciseEvent[]) => void
  instrument: Instrument
  measures: number
  timeSignature: [number, number]
  bpm: number
  swing: number
  difficulty: Difficulty
  audioUrl?: string
  exerciseId: string
  title: string
  description: string
  loopCount: number
  // JSON editor state
  eventsJson: string
  onJsonChange: (json: string) => void
  jsonError: string | null
  onJsonBlur: () => void
}

export function ExerciseWorkspace({
  events,
  onChange,
  instrument,
  measures,
  timeSignature,
  bpm,
  swing,
  difficulty,
  audioUrl,
  exerciseId,
  title,
  description,
  loopCount,
  eventsJson,
  onJsonChange,
  jsonError,
  onJsonBlur,
}: ExerciseWorkspaceProps) {
  const [subdivision, setSubdivision] = useState(4)
  const [zoom, setZoom] = useState(1)
  const [showJson, setShowJson] = useState(false)
  const [previewCollapsed, setPreviewCollapsed] = useState(false)

  const sequencer = useSequencerState(events, onChange)

  // Sync external events changes into sequencer (e.g. from JSON editor)
  useEffect(() => {
    if (JSON.stringify(events) !== JSON.stringify(sequencer.events)) {
      // Don't push to undo stack for external sync
    }
  }, [events])

  // Build ExerciseDefinition for preview
  const exerciseDef = useMemo((): ExerciseDefinition => ({
    id: exerciseId,
    title: title || 'Untitled',
    description: description || '',
    instrument,
    bpm,
    timeSignature,
    swing,
    difficulty,
    measures,
    loopCount,
    events: sequencer.events,
    audioUrl: audioUrl || undefined,
  }), [exerciseId, title, description, instrument, bpm, timeSignature, swing, difficulty, measures, loopCount, sequencer.events, audioUrl])

  const playback = useAdminPlayback(exerciseDef)

  const handlePlayStop = useCallback(() => {
    if (playback.isPlaying) {
      playback.stop()
    } else {
      playback.play(exerciseDef)
    }
  }, [playback, exerciseDef])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === ' ') {
        e.preventDefault()
        handlePlayStop()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (sequencer.selectedCell) {
          const cell = sequencer.selectedCell
          const updated = sequencer.events.filter(ev =>
            !(ev.measure === cell.measure && ev.beat === cell.beat && ev.technique === cell.technique)
          )
          sequencer.setEvents(updated)
          sequencer.clearSelection()
        }
      } else if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        if (e.shiftKey) {
          sequencer.redo()
        } else {
          sequencer.undo()
        }
      } else if (e.key === 'a' && !e.metaKey && !e.ctrlKey) {
        if (sequencer.selectedCell) {
          const cell = sequencer.selectedCell
          const event = sequencer.events.find(ev =>
            ev.measure === cell.measure && ev.beat === cell.beat && ev.technique === cell.technique
          )
          if (event) {
            const updated = sequencer.events.map(ev =>
              ev === event ? { ...ev, accent: !ev.accent } : ev
            )
            sequencer.setEvents(updated)
          }
        }
      } else if (e.key === 'h' && !e.metaKey && !e.ctrlKey) {
        if (sequencer.selectedCell) {
          const cell = sequencer.selectedCell
          const event = sequencer.events.find(ev =>
            ev.measure === cell.measure && ev.beat === cell.beat && ev.technique === cell.technique
          )
          if (event) {
            const updated = sequencer.events.map(ev =>
              ev === event ? { ...ev, hand: ev.hand === 'R' ? 'L' : 'R' as 'L' | 'R' } : ev
            )
            sequencer.setEvents(updated)
          }
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handlePlayStop, sequencer])

  return (
    <div className="space-y-4">
      {/* Main workspace */}
      <Card className="p-4">
        <div className="flex flex-col xl:flex-row gap-4">
          {/* Left: Sequencer */}
          <div className="flex-1 xl:w-[60%] min-w-0 space-y-3">
            <SequencerToolbar
              subdivision={subdivision}
              onSubdivisionChange={setSubdivision}
              zoom={zoom}
              onZoomChange={setZoom}
              canUndo={sequencer.canUndo}
              canRedo={sequencer.canRedo}
              onUndo={sequencer.undo}
              onRedo={sequencer.redo}
              isPlaying={playback.isPlaying}
              onPlayStop={handlePlayStop}
            />

            <SequencerPanel
              sequencer={sequencer}
              instrument={instrument}
              measures={measures}
              timeSignature={timeSignature}
              subdivision={subdivision}
              zoom={zoom}
            />
          </div>

          {/* Divider */}
          <div className="hidden xl:block w-px bg-border shrink-0" />

          {/* Right: Preview */}
          <div className={`xl:w-[40%] shrink-0 ${previewCollapsed ? 'xl:hidden' : ''}`}>
            {/* Mobile collapse toggle */}
            <button
              className="xl:hidden flex items-center gap-1 text-xs text-muted-foreground mb-2"
              onClick={() => setPreviewCollapsed(!previewCollapsed)}
            >
              {previewCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
              {previewCollapsed ? 'Show Preview' : 'Hide Preview'}
            </button>

            {!previewCollapsed && (
              <PreviewPanel exercise={exerciseDef} playback={playback} />
            )}
          </div>
        </div>
      </Card>

      {/* Collapsible JSON editor */}
      <div>
        <button
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowJson(!showJson)}
        >
          <Code2 className="w-3.5 h-3.5" />
          Advanced: JSON
          {showJson ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {showJson && (
          <div className="mt-2 space-y-2">
            <textarea
              className="w-full min-h-[200px] p-3 font-mono text-sm bg-muted rounded-lg border resize-y focus:outline-none focus:ring-2 focus:ring-primary"
              value={eventsJson}
              onChange={(e) => onJsonChange(e.target.value)}
              onBlur={onJsonBlur}
            />
            {jsonError && (
              <p className="text-sm text-destructive">{jsonError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
