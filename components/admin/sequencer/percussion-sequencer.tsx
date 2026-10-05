'use client'

import { AdminText } from '@/components/admin/admin-text'


import { useCallback, useMemo, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { ExerciseEvent, Instrument, Technique, Hand } from '@/lib/play-sense/types'
import {
  INSTRUMENT_TECHNIQUES,
  getTechniqueColor,
  DEFAULT_VEX_KEY,
} from '@/lib/play-sense/fretboard-utils'
import { SequencerCell } from './sequencer-cell'
import { NotePropertyPopover } from './note-property-popover'
import type { UseSequencerStateResult } from '@/hooks/use-sequencer-state'

interface PercussionSequencerProps {
  sequencer: UseSequencerStateResult
  instrument: Instrument
  measures: number
  timeSignature: [number, number]
  subdivision: number
  zoom: number
}

export function PercussionSequencer({
  sequencer,
  instrument,
  measures,
  timeSignature,
  subdivision,
  zoom,
}: PercussionSequencerProps) {
  const { events, setEvents, selectedCell, selectCell, clearSelection, startDragPaint, continueDragPaint, endDragPaint } = sequencer

  const techniques = INSTRUMENT_TECHNIQUES[instrument] || ['open']
  const beatsPerMeasure = timeSignature[0]
  const totalSubsPerMeasure = beatsPerMeasure * subdivision

  // Build event lookup
  const eventMap = useMemo(() => {
    const map = new Map<string, ExerciseEvent>()
    for (const event of events) {
      map.set(`${event.measure}-${event.beat}-${event.technique}`, event)
    }
    return map
  }, [events])

  const subdivisionToBeat = useCallback((subIndex: number) => {
    return 1 + subIndex * (1 / subdivision)
  }, [subdivision])

  const handleMouseDown = useCallback((measure: number, beat: number, technique: Technique) => {
    const key = `${measure}-${beat}-${technique}`
    const existing = eventMap.get(key)

    if (existing) {
      // Select existing note
      if (selectedCell?.measure === measure && selectedCell?.beat === beat && selectedCell?.technique === technique) {
        clearSelection()
      } else {
        selectCell({ measure, beat, technique })
      }
    } else {
      // Add new note + start drag paint
      const newEvent: ExerciseEvent = {
        beat,
        measure,
        instrument,
        technique,
        hand: 'R' as Hand,
        duration: 1 / subdivision,
        vexKey: DEFAULT_VEX_KEY[technique] || 'c/5',
        accent: false,
      }
      const newEvents = [...events, newEvent].sort((a, b) =>
        a.measure !== b.measure ? a.measure - b.measure : a.beat - b.beat
      )
      setEvents(newEvents)
      startDragPaint(measure, beat, technique, true)
      clearSelection()
    }
  }, [events, eventMap, instrument, subdivision, selectedCell, setEvents, selectCell, clearSelection, startDragPaint])

  const handleMouseEnter = useCallback((measure: number, beat: number, technique: Technique) => {
    if (!sequencer.isDragPainting) return

    const key = `${measure}-${beat}-${technique}`
    const existing = eventMap.get(key)

    if (!existing) {
      // Add note during drag
      const newEvent: ExerciseEvent = {
        beat,
        measure,
        instrument,
        technique,
        hand: 'R' as Hand,
        duration: 1 / subdivision,
        vexKey: DEFAULT_VEX_KEY[technique] || 'c/5',
        accent: false,
      }
      continueDragPaint(measure, beat, technique)
    } else {
      continueDragPaint(measure, beat, technique)
    }
  }, [sequencer.isDragPainting, eventMap, instrument, subdivision, continueDragPaint])

  const handleContextMenu = useCallback((e: React.MouseEvent, measure: number, beat: number, technique: Technique) => {
    e.preventDefault()
    const key = `${measure}-${beat}-${technique}`
    const existing = eventMap.get(key)
    if (existing) {
      // Quick toggle hand
      const updated = events.map(ev =>
        ev.measure === measure && ev.beat === beat && ev.technique === technique
          ? { ...ev, hand: (ev.hand === 'R' ? 'L' : 'R') as Hand }
          : ev
      )
      setEvents(updated)
    }
  }, [events, eventMap, setEvents])

  const updateEvent = useCallback((measure: number, beat: number, technique: Technique, updates: Partial<ExerciseEvent>) => {
    const updated = events.map(e =>
      e.measure === measure && e.beat === beat && e.technique === technique
        ? { ...e, ...updates }
        : e
    )
    setEvents(updated)
  }, [events, setEvents])

  const deleteEvent = useCallback((measure: number, beat: number, technique: Technique) => {
    setEvents(events.filter(e =>
      !(e.measure === measure && e.beat === beat && e.technique === technique)
    ))
    clearSelection()
  }, [events, setEvents, clearSelection])

  const selectedEvent = selectedCell
    ? eventMap.get(`${selectedCell.measure}-${selectedCell.beat}-${selectedCell.technique}`)
    : null

  return (
    <div
      className="select-none"
      onMouseUp={endDragPaint}
      onMouseLeave={endDragPaint}
    >
      <div className="overflow-x-auto">
        <div className="inline-flex flex-col gap-0 min-w-fit">
          {/* Column headers */}
          <div className="flex">
            <div className="shrink-0" style={{ width: 52 }} />
            {Array.from({ length: measures }).map((_, mIdx) => (
              <div key={mIdx} className="flex">
                {Array.from({ length: totalSubsPerMeasure }).map((_, subIdx) => {
                  const isDownbeat = subIdx === 0
                  const isBeatStart = subIdx % subdivision === 0
                  const beatNum = Math.floor(subIdx / subdivision) + 1
                  const cellSize = Math.round(36 * zoom)

                  return (
                    <div
                      key={subIdx}
                      className={cn(
                        'flex items-center justify-center text-[10px] font-mono',
                        isDownbeat ? 'text-slate-300 font-bold' : isBeatStart ? 'text-slate-400' : 'text-slate-600',
                        isDownbeat && 'border-l-2 border-slate-500',
                        isBeatStart && !isDownbeat && 'border-l border-slate-600',
                      )}
                      style={{ width: cellSize, height: 20 }}
                    >
                      {isBeatStart ? `${mIdx + 1}.${beatNum}` : ''}
                    </div>
                  )
                })}
                {mIdx < measures - 1 && <div className="w-0.5 bg-slate-700" />}
              </div>
            ))}
          </div>

          {/* Rows per technique */}
          {techniques.map((technique) => (
            <div key={technique} className="flex">
              {/* Row label */}
              <div
                className="shrink-0 flex items-center gap-1.5 pr-2 justify-end"
                style={{ width: 52 }}
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: getTechniqueColor(technique) }}
                />
                <span className="text-[11px] text-slate-400 capitalize font-medium truncate">
                  {technique}
                </span>
              </div>

              {Array.from({ length: measures }).map((_, mIdx) => {
                const measure = mIdx + 1
                return (
                  <div key={mIdx} className="flex">
                    {Array.from({ length: totalSubsPerMeasure }).map((_, subIdx) => {
                      const beat = subdivisionToBeat(subIdx)
                      const key = `${measure}-${beat}-${technique}`
                      const event = eventMap.get(key)
                      const isActive = !!event
                      const isSelected = selectedCell?.measure === measure && selectedCell?.beat === beat && selectedCell?.technique === technique
                      const isBeatStart = subIdx % subdivision === 0
                      const isDownbeat = subIdx === 0

                      const cell = (
                        <SequencerCell
                          key={subIdx}
                          active={isActive}
                          selected={isSelected}
                          accent={event?.accent || false}
                          hand={event?.hand}
                          technique={technique}
                          isDownbeat={isDownbeat}
                          isBeatStart={isBeatStart}
                          zoom={zoom}
                          onMouseDown={() => handleMouseDown(measure, beat, technique)}
                          onMouseEnter={() => handleMouseEnter(measure, beat, technique)}
                          onContextMenu={(e) => handleContextMenu(e, measure, beat, technique)}
                        />
                      )

                      // Wrap selected cell in popover
                      if (isSelected && selectedEvent) {
                        return (
                          <NotePropertyPopover
                            key={subIdx}
                            event={selectedEvent}
                            onUpdate={(updates) => updateEvent(measure, beat, technique, updates)}
                            onDelete={() => deleteEvent(measure, beat, technique)}
                            onClose={clearSelection}
                            open={true}
                          >
                            {cell}
                          </NotePropertyPopover>
                        )
                      }

                      return cell
                    })}
                    {mIdx < measures - 1 && <div className="w-0.5 bg-slate-700" />}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 text-[11px] text-slate-500">
        <span><AdminText text={"Click to add"} /></span>
        <span><AdminText text={"Click note to edit"} /></span>
        <span><AdminText text={"Right-click to toggle L/R"} /></span>
        <span><AdminText text={"Shift+click for accent"} /></span>
        <span><AdminText text={"Drag to paint"} /></span>
      </div>
    </div>
  )
}
