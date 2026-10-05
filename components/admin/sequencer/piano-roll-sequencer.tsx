'use client'

import { AdminText } from '@/components/admin/admin-text'


import { useCallback, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { ExerciseEvent, Instrument, Hand, PitchedInstrument } from '@/lib/play-sense/types'
import { INSTRUMENT_NOTE_RANGES, midiToNoteName, midiToVexKey, isBlackKey } from '@/lib/play-sense/pitch-utils'
import { NotePropertyPopover } from './note-property-popover'
import type { UseSequencerStateResult } from '@/hooks/use-sequencer-state'

interface PianoRollSequencerProps {
  sequencer: UseSequencerStateResult
  instrument: Instrument
  measures: number
  timeSignature: [number, number]
  subdivision: number
  zoom: number
}

const ROW_HEIGHT = 20
const KEY_WIDTH = 32

export function PianoRollSequencer({
  sequencer,
  instrument,
  measures,
  timeSignature,
  subdivision,
  zoom,
}: PianoRollSequencerProps) {
  const { events, setEvents, selectedCell, selectCell, clearSelection } = sequencer
  const [dragStart, setDragStart] = useState<{ measure: number; beat: number; midi: number } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ measure: number; beat: number } | null>(null)

  const range = INSTRUMENT_NOTE_RANGES[instrument as PitchedInstrument] || { min: 48, max: 84 }
  const midiNotes = useMemo(() => {
    const notes: number[] = []
    for (let m = range.max; m >= range.min; m--) {
      notes.push(m)
    }
    return notes
  }, [range.min, range.max])

  const beatsPerMeasure = timeSignature[0]
  const totalSubsPerMeasure = beatsPerMeasure * subdivision
  const cellWidth = Math.round(36 * zoom)
  const totalColumns = totalSubsPerMeasure * measures

  const subdivisionToBeat = useCallback((subIndex: number) => {
    return 1 + subIndex * (1 / subdivision)
  }, [subdivision])

  // Convert column index to measure + beat
  const columnToPosition = useCallback((col: number) => {
    const measure = Math.floor(col / totalSubsPerMeasure) + 1
    const subInMeasure = col % totalSubsPerMeasure
    const beat = subdivisionToBeat(subInMeasure)
    return { measure, beat }
  }, [totalSubsPerMeasure, subdivisionToBeat])

  // Build event lookup by midi-measure-beat
  const eventMap = useMemo(() => {
    const map = new Map<string, ExerciseEvent>()
    for (const event of events) {
      if (event.expectedPitch !== undefined) {
        map.set(`${event.expectedPitch}-${event.measure}-${event.beat}`, event)
      }
    }
    return map
  }, [events])

  // Find notes that occupy a given cell (note may span multiple cells via duration)
  const getNoteAtCell = useCallback((midi: number, measure: number, beat: number): ExerciseEvent | null => {
    // Direct hit
    const direct = eventMap.get(`${midi}-${measure}-${beat}`)
    if (direct) return direct

    // Check if a previous note spans into this cell
    for (const event of events) {
      if (event.expectedPitch !== midi) continue
      const eventStartCol = (event.measure - 1) * totalSubsPerMeasure + Math.round((event.beat - 1) * subdivision)
      const eventDurationCols = Math.round(event.duration * subdivision)
      const cellCol = (measure - 1) * totalSubsPerMeasure + Math.round((beat - 1) * subdivision)
      if (cellCol >= eventStartCol && cellCol < eventStartCol + eventDurationCols) {
        return event
      }
    }
    return null
  }, [events, eventMap, totalSubsPerMeasure, subdivision])

  const handleMouseDown = useCallback((midi: number, measure: number, beat: number) => {
    const existing = getNoteAtCell(midi, measure, beat)
    if (existing) {
      selectCell({ measure: existing.measure, beat: existing.beat, technique: existing.technique })
    } else {
      setDragStart({ measure, beat, midi })
      setDragEnd({ measure, beat })
      clearSelection()
    }
  }, [getNoteAtCell, selectCell, clearSelection])

  const handleMouseMove = useCallback((measure: number, beat: number) => {
    if (!dragStart) return
    setDragEnd({ measure, beat })
  }, [dragStart])

  const handleMouseUp = useCallback(() => {
    if (!dragStart || !dragEnd) {
      setDragStart(null)
      setDragEnd(null)
      return
    }

    // Calculate duration from drag distance
    const startCol = (dragStart.measure - 1) * totalSubsPerMeasure + Math.round((dragStart.beat - 1) * subdivision)
    const endCol = (dragEnd.measure - 1) * totalSubsPerMeasure + Math.round((dragEnd.beat - 1) * subdivision)
    const durationCols = Math.max(1, endCol - startCol + 1)
    const duration = durationCols / subdivision

    const newEvent: ExerciseEvent = {
      beat: dragStart.beat,
      measure: dragStart.measure,
      instrument,
      technique: 'open',
      hand: 'R' as Hand,
      duration,
      vexKey: midiToVexKey(dragStart.midi),
      accent: false,
      expectedPitch: dragStart.midi,
      expectedNoteName: midiToNoteName(dragStart.midi),
    }

    setEvents([...events, newEvent].sort((a, b) =>
      a.measure !== b.measure ? a.measure - b.measure : a.beat - b.beat
    ))

    setDragStart(null)
    setDragEnd(null)
  }, [dragStart, dragEnd, events, instrument, subdivision, totalSubsPerMeasure, setEvents])

  const updateEvent = useCallback((measure: number, beat: number, updates: Partial<ExerciseEvent>) => {
    const updated = events.map(e =>
      e.measure === measure && e.beat === beat && e.expectedPitch !== undefined
        ? { ...e, ...updates }
        : e
    )
    setEvents(updated)
  }, [events, setEvents])

  const deleteEvent = useCallback((measure: number, beat: number) => {
    setEvents(events.filter(e =>
      !(e.measure === measure && e.beat === beat && selectedCell?.technique === e.technique)
    ))
    clearSelection()
  }, [events, selectedCell, setEvents, clearSelection])

  const selectedEvent = selectedCell
    ? events.find(e => e.measure === selectedCell.measure && e.beat === selectedCell.beat && e.technique === selectedCell.technique)
    : null

  // Compute drag preview
  const dragPreview = useMemo(() => {
    if (!dragStart || !dragEnd) return null
    const startCol = (dragStart.measure - 1) * totalSubsPerMeasure + Math.round((dragStart.beat - 1) * subdivision)
    const endCol = (dragEnd.measure - 1) * totalSubsPerMeasure + Math.round((dragEnd.beat - 1) * subdivision)
    return {
      midi: dragStart.midi,
      startCol,
      width: Math.max(1, endCol - startCol + 1),
    }
  }, [dragStart, dragEnd, totalSubsPerMeasure, subdivision])

  return (
    <div
      className="select-none"
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { setDragStart(null); setDragEnd(null) }}
    >
      <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
        <div className="inline-flex min-w-fit">
          {/* Piano keyboard strip */}
          <div className="sticky left-0 z-10 bg-slate-950 shrink-0" style={{ width: KEY_WIDTH }}>
            {midiNotes.map((midi) => {
              const black = isBlackKey(midi)
              const noteName = midiToNoteName(midi)
              const isC = midi % 12 === 0
              return (
                <div
                  key={midi}
                  className={cn(
                    'flex items-center justify-end pr-1 text-[9px] font-mono border-b border-slate-800/40',
                    black ? 'bg-slate-800 text-slate-400' : 'bg-slate-900 text-slate-500',
                  )}
                  style={{ height: ROW_HEIGHT, width: KEY_WIDTH }}
                >
                  {isC ? noteName : ''}
                </div>
              )
            })}
          </div>

          {/* Grid */}
          <div className="relative">
            {/* Background rows */}
            {midiNotes.map((midi, rowIdx) => {
              const black = isBlackKey(midi)
              return (
                <div key={midi} className="flex" style={{ height: ROW_HEIGHT }}>
                  {Array.from({ length: totalColumns }).map((_, colIdx) => {
                    const { measure, beat } = columnToPosition(colIdx)
                    const subInMeasure = colIdx % totalSubsPerMeasure
                    const isDownbeat = subInMeasure === 0
                    const isBeatStart = subInMeasure % subdivision === 0

                    return (
                      <div
                        key={colIdx}
                        className={cn(
                          'border-b border-r border-slate-800/30 cursor-crosshair',
                          black ? 'bg-slate-900/80' : 'bg-slate-950/50',
                          isDownbeat && 'border-l-2 border-l-slate-600',
                          isBeatStart && !isDownbeat && 'border-l border-l-slate-700/50',
                        )}
                        style={{ width: cellWidth, height: ROW_HEIGHT }}
                        onMouseDown={() => handleMouseDown(midi, measure, beat)}
                        onMouseMove={() => handleMouseMove(measure, beat)}
                      />
                    )
                  })}
                </div>
              )
            })}

            {/* Note rectangles overlay */}
            <div className="absolute inset-0 pointer-events-none">
              {events.map((event, idx) => {
                if (event.expectedPitch === undefined) return null
                const rowIdx = midiNotes.indexOf(event.expectedPitch)
                if (rowIdx === -1) return null

                const startCol = (event.measure - 1) * totalSubsPerMeasure + Math.round((event.beat - 1) * subdivision)
                const durationCols = Math.max(1, Math.round(event.duration * subdivision))
                const isSelected = selectedCell?.measure === event.measure && selectedCell?.beat === event.beat

                const noteEl = (
                  <div
                    key={idx}
                    className={cn(
                      'absolute rounded-sm pointer-events-auto cursor-pointer',
                      isSelected && 'ring-2 ring-white',
                      event.accent ? 'brightness-125' : 'opacity-85',
                    )}
                    style={{
                      left: startCol * cellWidth + 1,
                      top: rowIdx * ROW_HEIGHT + 1,
                      width: durationCols * cellWidth - 2,
                      height: ROW_HEIGHT - 2,
                      backgroundColor: 'hsl(30, 60%, 55%)',
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      selectCell({ measure: event.measure, beat: event.beat, technique: event.technique })
                    }}
                  >
                    {event.hand === 'L' && (
                      <span className="absolute left-1 top-0 text-[8px] font-bold text-white/80">L</span>
                    )}
                    {event.accent && (
                      <span className="absolute right-1 top-0 text-[8px] font-bold text-white/80">&gt;</span>
                    )}
                  </div>
                )

                if (isSelected && selectedEvent) {
                  return (
                    <NotePropertyPopover
                      key={idx}
                      event={selectedEvent}
                      onUpdate={(updates) => updateEvent(event.measure, event.beat, updates)}
                      onDelete={() => deleteEvent(event.measure, event.beat)}
                      onClose={clearSelection}
                      open={true}
                    >
                      {noteEl}
                    </NotePropertyPopover>
                  )
                }

                return noteEl
              })}

              {/* Drag preview */}
              {dragPreview && (
                <div
                  className="absolute rounded-sm bg-white/20 border border-white/40"
                  style={{
                    left: dragPreview.startCol * cellWidth,
                    top: midiNotes.indexOf(dragPreview.midi) * ROW_HEIGHT,
                    width: dragPreview.width * cellWidth,
                    height: ROW_HEIGHT,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 text-[11px] text-slate-500">
        <span><AdminText text={"Click + drag to place notes"} /></span>
        <span><AdminText text={"Click note to edit"} /></span>
        <span><AdminText text={"Pitch auto-populates from row"} /></span>
      </div>
    </div>
  )
}
