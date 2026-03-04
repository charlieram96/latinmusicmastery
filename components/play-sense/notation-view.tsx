'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { useTheme } from '@/components/theme-provider'
import type { ExerciseDefinition, EventResult } from '@/lib/play-sense/types'
import { GRADE_COLORS } from '@/lib/play-sense/types'
import { groupEventsByMeasure, beatDurationToVexDuration } from '@/lib/play-sense/exercise-utils'

interface NotationViewProps {
  exercise: ExerciseDefinition
  eventResults: EventResult[]
  playheadProgress: number // 0-1
  isPlaying: boolean
}

const MIN_MEASURE_WIDTH = 250

export function NotationView({ exercise, eventResults, playheadProgress, isPlaying }: NotationViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)
  const notationWidthRef = useRef(0)
  const notationLeftRef = useRef(0)
  const totalRenderedHeightRef = useRef(0)
  const [svgReady, setSvgReady] = useState(false)
  const [measuresPerLine, setMeasuresPerLine] = useState(2)
  const { theme } = useTheme()

  const isDark = theme === 'dark'

  // Dynamic measures per line based on container width
  useEffect(() => {
    if (!scrollContainerRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width
        const fits = Math.max(1, Math.floor((width - 40) / MIN_MEASURE_WIDTH))
        setMeasuresPerLine(Math.min(fits, exercise.measures))
      }
    })
    observer.observe(scrollContainerRef.current)
    return () => observer.disconnect()
  }, [exercise.measures])

  const renderNotation = useCallback(async () => {
    if (!containerRef.current) return

    const vexflow = await import('vexflow')
    const { Renderer, Stave, StaveNote, Formatter, Beam } = vexflow

    const container = containerRef.current
    container.innerHTML = ''

    const effectiveMeasuresPerLine = Math.min(measuresPerLine, exercise.measures)
    const totalLines = Math.ceil(exercise.measures / effectiveMeasuresPerLine)

    const containerWidth = container.clientWidth || 800
    const measureWidth = Math.max(
      Math.floor((containerWidth - 40) / effectiveMeasuresPerLine),
      MIN_MEASURE_WIDTH
    )
    const actualWidth = Math.max(containerWidth, effectiveMeasuresPerLine * measureWidth + 40)
    const staveHeight = 140
    const totalHeight = totalLines * staveHeight + 40

    const renderer = new Renderer(container, Renderer.Backends.SVG)
    renderer.resize(actualWidth, totalHeight)
    const context = renderer.getContext()

    // Style the SVG
    const svgEl = container.querySelector('svg')
    if (svgEl) {
      svgEl.style.background = 'transparent'
    }

    // Theme-aware colors
    const staveStyle = isDark
      ? { fillStyle: '#94a3b8', strokeStyle: '#475569' }
      : { fillStyle: '#334155', strokeStyle: '#94a3b8' }
    const noteStyle = isDark
      ? { fillStyle: '#e2e8f0', strokeStyle: '#e2e8f0' }
      : { fillStyle: '#1e293b', strokeStyle: '#1e293b' }

    const grouped = groupEventsByMeasure(exercise.events, exercise.measures)
    let globalEventIdx = 0
    let firstStaveX = 0
    let lastStaveEndX = 0

    for (let line = 0; line < totalLines; line++) {
      for (let col = 0; col < effectiveMeasuresPerLine; col++) {
        const measureNum = line * effectiveMeasuresPerLine + col + 1
        if (measureNum > exercise.measures) break

        const x = col * measureWidth + 20
        const y = line * staveHeight + 10

        const stave = new Stave(x, y, measureWidth)
        if (col === 0) {
          stave.addClef('percussion')
          stave.addTimeSignature(`${exercise.timeSignature[0]}/${exercise.timeSignature[1]}`)
          if (line === 0) firstStaveX = x + stave.getNoteStartX() - x
        }

        // Style stave lines
        stave.setStyle(staveStyle)
        stave.setContext(context).draw()

        if (col === effectiveMeasuresPerLine - 1 || measureNum === exercise.measures) {
          lastStaveEndX = x + measureWidth
        }

        const measureEvents = grouped.get(measureNum) || []

        if (measureEvents.length === 0) {
          const rest = new StaveNote({
            keys: ['b/4'],
            duration: 'wr',
          })
          rest.setStyle({ fillStyle: '#64748b', strokeStyle: '#64748b' })
          Formatter.FormatAndDraw(context, stave, [rest])
          continue
        }

        const notes: InstanceType<typeof StaveNote>[] = []
        for (const event of measureEvents) {
          const duration = beatDurationToVexDuration(event.duration)
          const noteKey = event.vexKey || 'c/5'

          const staveNote = new StaveNote({
            keys: [noteKey],
            duration,
          })

          if (event.accent) {
            try {
              const { Articulation } = vexflow
              staveNote.addModifier(new Articulation('a>'))
            } catch {
              // Articulation may not be available
            }
          }

          // Theme-aware note color
          staveNote.setStyle(noteStyle)
          ;(staveNote as unknown as { _eventIndex: number })._eventIndex = globalEventIdx

          notes.push(staveNote)
          globalEventIdx++
        }

        Formatter.FormatAndDraw(context, stave, notes)

        try {
          const beamableNotes = notes.filter(n => {
            const dur = n.getDuration()
            return dur === '8' || dur === '16'
          })
          if (beamableNotes.length >= 2) {
            const beam = new Beam(beamableNotes)
            beam.setContext(context).draw()
          }
        } catch {
          // Beam may fail
        }
      }
    }

    // Store notation bounds for playhead
    notationLeftRef.current = 20 + firstStaveX
    notationWidthRef.current = lastStaveEndX - 20 - firstStaveX
    totalRenderedHeightRef.current = totalHeight

    // Add data-event-index attributes to SVG note elements
    const svgElements = container.querySelectorAll('.vf-stavenote')
    let idx = 0
    svgElements.forEach((el) => {
      el.setAttribute('data-event-index', String(idx))
      idx++
    })

    setSvgReady(true)
  }, [exercise, measuresPerLine, isDark])

  // Render notation on mount and exercise change
  useEffect(() => {
    setSvgReady(false)
    renderNotation()
  }, [renderNotation])

  // Color notes based on event results with hit pulse animation
  useEffect(() => {
    if (!containerRef.current || !svgReady) return

    for (const result of eventResults) {
      const color = GRADE_COLORS[result.grade]
      const el = containerRef.current.querySelector(`[data-event-index="${result.eventIndex}"]`)
      if (el) {
        const htmlEl = el as HTMLElement
        // Skip if already colored
        if (htmlEl.dataset.graded) continue
        htmlEl.dataset.graded = 'true'

        // Color all paths and text
        el.querySelectorAll('path, text, rect, line').forEach((child) => {
          ;(child as SVGElement).style.fill = color
          ;(child as SVGElement).style.stroke = color
        })

        // Hit pulse animation via CSS class
        htmlEl.classList.add('note-hit-pulse')
        setTimeout(() => htmlEl.classList.remove('note-hit-pulse'), 400)
      }
    }
  }, [eventResults, svgReady])

  // Update playhead position and auto-scroll
  useEffect(() => {
    if (!playheadRef.current) return

    if (!isPlaying) {
      playheadRef.current.style.display = 'none'
      return
    }

    playheadRef.current.style.display = 'block'
    const x = notationLeftRef.current + playheadProgress * notationWidthRef.current
    playheadRef.current.style.left = `${x}px`

    // Auto-scroll to keep playhead visible
    if (scrollContainerRef.current) {
      const scrollEl = scrollContainerRef.current
      const viewWidth = scrollEl.clientWidth
      const scrollLeft = scrollEl.scrollLeft

      if (x > scrollLeft + viewWidth - 60) {
        scrollEl.scrollTo({ left: x - 100, behavior: 'smooth' })
      } else if (x < scrollLeft + 40) {
        scrollEl.scrollTo({ left: Math.max(0, x - 100), behavior: 'smooth' })
      }
    }
  }, [playheadProgress, isPlaying])

  return (
    <div className="relative w-full bg-card rounded-xl border border-border overflow-hidden">
      {/* CSS for hit pulse animation */}
      <style jsx global>{`
        @keyframes notePulse {
          0% { transform: scale(1); filter: brightness(1); }
          30% { transform: scale(1.3); filter: brightness(1.8) drop-shadow(0 0 8px currentColor); }
          100% { transform: scale(1); filter: brightness(1); }
        }
        .note-hit-pulse {
          animation: notePulse 0.4s ease-out;
          transform-origin: center center;
        }
      `}</style>

      {/* Scrollable notation area */}
      <div
        ref={scrollContainerRef}
        className="relative overflow-x-auto overflow-y-hidden p-4 md:p-6"
      >
        {/* Glow playhead */}
        <div
          ref={playheadRef}
          className="absolute top-0 bottom-0 z-10 pointer-events-none"
          style={{
            display: 'none',
            width: '4px',
            background: 'linear-gradient(180deg, rgba(59,130,246,0.8), rgba(147,51,234,0.8))',
            boxShadow: '0 0 12px rgba(59,130,246,0.6), 0 0 24px rgba(147,51,234,0.3)',
            borderRadius: '2px',
            transition: 'left 16ms linear',
          }}
        />

        {/* Notation container */}
        <div ref={containerRef} className="w-full min-h-[160px]" />
      </div>
    </div>
  )
}
