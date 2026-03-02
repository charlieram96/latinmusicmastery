'use client'

import { useState, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { ExerciseEvent, Instrument, Technique, Hand } from '@/lib/play-sense/types'
import { PlaySenseNoteDetail } from './play-sense-note-detail'

interface PatternGridProps {
  events: ExerciseEvent[]
  instrument: Instrument
  measures: number
  timeSignature: [number, number]
  onChange: (events: ExerciseEvent[]) => void
}

// Techniques available per instrument
const INSTRUMENT_TECHNIQUES: Record<Instrument, Technique[]> = {
  conga: ['open', 'slap', 'mute', 'bass', 'touch', 'heel', 'tip'],
  timbale: ['open', 'rim', 'mute', 'shell', 'bell'],
  bongo: ['open', 'slap', 'mute', 'rim', 'heel', 'tip'],
  clave: ['open'],
  cowbell: ['open', 'mute', 'bell'],
  guiro: ['open', 'mute'],
}

// Default vexKey per technique
const DEFAULT_VEX_KEY: Record<Technique, string> = {
  open: 'e/5',
  slap: 'f/5',
  mute: 'd/5',
  bass: 'c/5',
  touch: 'e/5',
  heel: 'c/5',
  tip: 'c/5',
  rim: 'g/5',
  shell: 'g/5',
  bell: 'a/5',
}

// Technique label abbreviations for compact display
const TECHNIQUE_LABELS: Record<Technique, string> = {
  open: 'O',
  slap: 'S',
  mute: 'M',
  bass: 'B',
  touch: 'T',
  heel: 'H',
  tip: 'Ti',
  rim: 'R',
  shell: 'Sh',
  bell: 'Be',
}

export function PlaySensePatternGrid({
  events,
  instrument,
  measures,
  timeSignature,
  onChange,
}: PatternGridProps) {
  const [selectedCell, setSelectedCell] = useState<{ measure: number; beat: number; technique: Technique } | null>(null)

  const techniques = INSTRUMENT_TECHNIQUES[instrument] || ['open']
  const beatsPerMeasure = timeSignature[0]
  // 16th note resolution: 4 subdivisions per beat
  const subdivisionsPerBeat = 4
  const totalSubdivisionsPerMeasure = beatsPerMeasure * subdivisionsPerBeat

  // Build a lookup map: "measure-beat-technique" -> event
  const eventMap = useMemo(() => {
    const map = new Map<string, ExerciseEvent>()
    for (const event of events) {
      const key = `${event.measure}-${event.beat}-${event.technique}`
      map.set(key, event)
    }
    return map
  }, [events])

  // Convert subdivision index to beat value (1-based, with decimal subdivisions)
  const subdivisionToBeat = useCallback((subIndex: number) => {
    return 1 + subIndex * (1 / subdivisionsPerBeat)
  }, [subdivisionsPerBeat])

  const toggleCell = useCallback((measure: number, beat: number, technique: Technique) => {
    const key = `${measure}-${beat}-${technique}`
    const existing = eventMap.get(key)

    if (existing) {
      // Remove the event
      const updated = events.filter(e =>
        !(e.measure === measure && e.beat === beat && e.technique === technique)
      )
      onChange(updated)
      setSelectedCell(null)
    } else {
      // Add a new event
      const newEvent: ExerciseEvent = {
        beat,
        measure,
        instrument,
        technique,
        hand: 'R' as Hand,
        duration: 1 / subdivisionsPerBeat,
        vexKey: DEFAULT_VEX_KEY[technique] || 'c/5',
        accent: false,
      }
      onChange([...events, newEvent].sort((a, b) =>
        a.measure !== b.measure ? a.measure - b.measure : a.beat - b.beat
      ))
    }
  }, [events, eventMap, instrument, onChange, subdivisionsPerBeat])

  const handleCellClick = useCallback((measure: number, beat: number, technique: Technique) => {
    const key = `${measure}-${beat}-${technique}`
    if (eventMap.has(key)) {
      // If already selected, deselect; otherwise select for editing
      if (selectedCell?.measure === measure && selectedCell?.beat === beat && selectedCell?.technique === technique) {
        setSelectedCell(null)
      } else {
        setSelectedCell({ measure, beat, technique })
      }
    } else {
      toggleCell(measure, beat, technique)
    }
  }, [eventMap, selectedCell, toggleCell])

  const updateEvent = useCallback((measure: number, beat: number, technique: Technique, updates: Partial<ExerciseEvent>) => {
    const updated = events.map(e => {
      if (e.measure === measure && e.beat === beat && e.technique === technique) {
        return { ...e, ...updates }
      }
      return e
    })
    onChange(updated)
  }, [events, onChange])

  const deleteEvent = useCallback((measure: number, beat: number, technique: Technique) => {
    const updated = events.filter(e =>
      !(e.measure === measure && e.beat === beat && e.technique === technique)
    )
    onChange(updated)
    setSelectedCell(null)
  }, [events, onChange])

  const selectedEvent = selectedCell
    ? eventMap.get(`${selectedCell.measure}-${selectedCell.beat}-${selectedCell.technique}`)
    : null

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <div className="inline-flex flex-col gap-0 min-w-fit">
          {/* Column headers: measure/beat labels */}
          <div className="flex">
            {/* Technique label column */}
            <div className="w-16 shrink-0" />
            {Array.from({ length: measures }).map((_, mIdx) => (
              <div key={mIdx} className="flex">
                {Array.from({ length: totalSubdivisionsPerMeasure }).map((_, subIdx) => {
                  const isDownbeat = subIdx === 0
                  const isBeatStart = subIdx % subdivisionsPerBeat === 0
                  const beatNum = Math.floor(subIdx / subdivisionsPerBeat) + 1

                  return (
                    <div
                      key={subIdx}
                      className={cn(
                        'w-8 h-6 flex items-center justify-center text-[10px] font-mono',
                        isDownbeat ? 'text-slate-300 font-bold' : isBeatStart ? 'text-slate-400' : 'text-slate-600',
                        isDownbeat && 'border-l-2 border-slate-500',
                        isBeatStart && !isDownbeat && 'border-l border-slate-600',
                      )}
                    >
                      {isBeatStart ? `${mIdx + 1}.${beatNum}` : ''}
                    </div>
                  )
                })}
                {/* Measure separator */}
                {mIdx < measures - 1 && <div className="w-1 bg-slate-700" />}
              </div>
            ))}
          </div>

          {/* Rows: one per technique */}
          {techniques.map((technique) => (
            <div key={technique} className="flex">
              {/* Technique label */}
              <div className="w-16 shrink-0 flex items-center justify-end pr-2 text-xs text-slate-400 capitalize font-medium">
                {technique}
              </div>

              {Array.from({ length: measures }).map((_, mIdx) => {
                const measure = mIdx + 1
                return (
                  <div key={mIdx} className="flex">
                    {Array.from({ length: totalSubdivisionsPerMeasure }).map((_, subIdx) => {
                      const beat = subdivisionToBeat(subIdx)
                      const key = `${measure}-${beat}-${technique}`
                      const event = eventMap.get(key)
                      const isActive = !!event
                      const isSelected = selectedCell?.measure === measure && selectedCell?.beat === beat && selectedCell?.technique === technique
                      const isBeatStart = subIdx % subdivisionsPerBeat === 0
                      const isDownbeat = subIdx === 0

                      return (
                        <div
                          key={subIdx}
                          className={cn(
                            'w-8 h-8 border border-slate-800 cursor-pointer transition-all duration-100 flex items-center justify-center',
                            isDownbeat && 'border-l-2 border-l-slate-500',
                            isBeatStart && !isDownbeat && 'border-l-slate-600',
                            isActive
                              ? cn(
                                  'bg-blue-500/80 hover:bg-blue-400/80',
                                  event?.accent && 'bg-orange-500/80 hover:bg-orange-400/80',
                                  isSelected && 'ring-2 ring-white'
                                )
                              : 'bg-slate-900/50 hover:bg-slate-800/80',
                          )}
                          onClick={() => handleCellClick(measure, beat, technique)}
                          title={`${technique} - M${measure} B${beat}`}
                        >
                          {isActive && (
                            <span className="text-[9px] font-bold text-white/90">
                              {TECHNIQUE_LABELS[technique]}{event?.hand === 'L' ? 'L' : ''}
                            </span>
                          )}
                        </div>
                      )
                    })}
                    {mIdx < measures - 1 && <div className="w-1 bg-slate-700" />}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Note detail popover */}
      {selectedEvent && selectedCell && (
        <PlaySenseNoteDetail
          event={selectedEvent}
          onUpdate={(updates) => updateEvent(selectedCell.measure, selectedCell.beat, selectedCell.technique, updates)}
          onDelete={() => deleteEvent(selectedCell.measure, selectedCell.beat, selectedCell.technique)}
          onClose={() => setSelectedCell(null)}
        />
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span>Click to toggle notes</span>
        <span>Click active note to edit properties</span>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-500/80 rounded-sm" /> Normal
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-orange-500/80 rounded-sm" /> Accent
        </div>
      </div>
    </div>
  )
}
