'use client'

import { useState, useCallback, useRef } from 'react'
import type { ExerciseEvent, Technique } from '@/lib/play-sense/types'

const MAX_UNDO = 50

interface SelectedCell {
  measure: number
  beat: number
  technique: Technique
}

interface DragState {
  painting: boolean
  value: boolean // true = adding, false = removing
  technique: Technique
}

export interface UseSequencerStateResult {
  events: ExerciseEvent[]
  setEvents: (events: ExerciseEvent[]) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  startDragPaint: (measure: number, beat: number, technique: Technique, addNote: boolean) => void
  continueDragPaint: (measure: number, beat: number, technique: Technique) => void
  endDragPaint: () => void
  isDragPainting: boolean
  selectedCell: SelectedCell | null
  selectCell: (cell: SelectedCell | null) => void
  clearSelection: () => void
}

export function useSequencerState(
  initialEvents: ExerciseEvent[],
  onChange: (events: ExerciseEvent[]) => void
): UseSequencerStateResult {
  const [events, setEventsInternal] = useState<ExerciseEvent[]>(initialEvents)
  const undoStack = useRef<ExerciseEvent[][]>([])
  const redoStack = useRef<ExerciseEvent[][]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const [isDragPainting, setIsDragPainting] = useState(false)
  const visitedRef = useRef<Set<string>>(new Set())

  // Keep events ref in sync for drag operations
  const eventsRef = useRef(events)
  eventsRef.current = events

  const pushState = useCallback((newEvents: ExerciseEvent[]) => {
    undoStack.current.push(eventsRef.current)
    if (undoStack.current.length > MAX_UNDO) {
      undoStack.current.shift()
    }
    redoStack.current = []
    setCanUndo(true)
    setCanRedo(false)
    setEventsInternal(newEvents)
    eventsRef.current = newEvents
    onChange(newEvents)
  }, [onChange])

  const setEvents = useCallback((newEvents: ExerciseEvent[]) => {
    pushState(newEvents)
  }, [pushState])

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return
    const prev = undoStack.current.pop()!
    redoStack.current.push(eventsRef.current)
    setEventsInternal(prev)
    eventsRef.current = prev
    onChange(prev)
    setCanUndo(undoStack.current.length > 0)
    setCanRedo(true)
  }, [onChange])

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return
    const next = redoStack.current.pop()!
    undoStack.current.push(eventsRef.current)
    setEventsInternal(next)
    eventsRef.current = next
    onChange(next)
    setCanUndo(true)
    setCanRedo(redoStack.current.length > 0)
  }, [onChange])

  const startDragPaint = useCallback((measure: number, beat: number, technique: Technique, addNote: boolean) => {
    // Save current state for undo before drag starts
    undoStack.current.push(eventsRef.current)
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift()
    redoStack.current = []
    setCanUndo(true)
    setCanRedo(false)

    dragRef.current = { painting: true, value: addNote, technique }
    visitedRef.current = new Set([`${measure}-${beat}-${technique}`])
    setIsDragPainting(true)
  }, [])

  const continueDragPaint = useCallback((measure: number, beat: number, technique: Technique) => {
    const drag = dragRef.current
    if (!drag || !drag.painting) return

    const key = `${measure}-${beat}-${technique}`
    if (visitedRef.current.has(key)) return
    visitedRef.current.add(key)

    // Only paint same technique row
    if (technique !== drag.technique) return

    const current = eventsRef.current
    const exists = current.some(e => e.measure === measure && e.beat === beat && e.technique === technique)

    if (drag.value && !exists) {
      // Adding a note
      const newEvent: ExerciseEvent = {
        beat,
        measure,
        instrument: current[0]?.instrument || 'conga',
        technique,
        hand: 'R',
        duration: 0.25,
        vexKey: 'c/5',
        accent: false,
      }
      const newEvents = [...current, newEvent].sort((a, b) =>
        a.measure !== b.measure ? a.measure - b.measure : a.beat - b.beat
      )
      setEventsInternal(newEvents)
      eventsRef.current = newEvents
      onChange(newEvents)
    } else if (!drag.value && exists) {
      // Removing a note
      const newEvents = current.filter(e =>
        !(e.measure === measure && e.beat === beat && e.technique === technique)
      )
      setEventsInternal(newEvents)
      eventsRef.current = newEvents
      onChange(newEvents)
    }
  }, [onChange])

  const endDragPaint = useCallback(() => {
    dragRef.current = null
    visitedRef.current.clear()
    setIsDragPainting(false)
  }, [])

  const selectCell = useCallback((cell: SelectedCell | null) => {
    setSelectedCell(cell)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedCell(null)
  }, [])

  return {
    events,
    setEvents,
    undo,
    redo,
    canUndo,
    canRedo,
    startDragPaint,
    continueDragPaint,
    endDragPaint,
    isDragPainting,
    selectedCell,
    selectCell,
    clearSelection,
  }
}
