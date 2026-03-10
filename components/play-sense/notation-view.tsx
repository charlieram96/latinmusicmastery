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

const MIN_MEASURE_WIDTH = 416

export function NotationView({ exercise, eventResults, playheadProgress, isPlaying }: NotationViewProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)
  const notationWidthRef = useRef(0)
  const notationLeftRef = useRef(0)
  const totalRenderedHeightRef = useRef(0)
  const [svgReady, setSvgReady] = useState(false)
  const [measuresPerLine, setMeasuresPerLine] = useState(2)

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

    // Render all measures in a single horizontal row
    const effectiveMeasuresPerLine = exercise.measures
    const totalLines = 1

    const containerWidth = container.clientWidth || 800
    // Size each measure so 3 fit in the viewport
    const measureWidth = Math.max(
      Math.floor((containerWidth - 40) / Math.min(measuresPerLine, 2)),
      MIN_MEASURE_WIDTH
    )
    // Total SVG width extends beyond viewport for scrolling
    const actualWidth = exercise.measures * measureWidth + 40
    const staveHeight = 286
    const totalHeight = totalLines * staveHeight + 40

    const renderer = new Renderer(container, Renderer.Backends.SVG)
    renderer.resize(actualWidth, totalHeight)
    const context = renderer.getContext()

    // Style the SVG — transparent bg, parchment wrapper handles theming
    const svgEl = container.querySelector('svg')
    if (svgEl) {
      svgEl.style.background = 'transparent'
    }

    // Engraved sheet music colors
    const darkColor = 'hsl(0,0%,85%)'
    const staveStyle = isDark
      ? { fillStyle: 'hsl(25,6%,42%)', strokeStyle: 'hsl(25,6%,42%)' }
      : { fillStyle: 'hsl(25,8%,72%)', strokeStyle: 'hsl(25,8%,72%)' }
    const noteStyle = isDark
      ? { fillStyle: 'hsl(30,15%,85%)', strokeStyle: 'hsl(30,15%,85%)' }
      : { fillStyle: 'hsl(20,25%,12%)', strokeStyle: 'hsl(20,25%,12%)' }

    const grouped = groupEventsByMeasure(exercise.events, exercise.measures)
    let globalEventIdx = 0
    let firstStaveX = 0
    let lastStaveEndX = 0

    // Single loop: all measures left-to-right
    for (let col = 0; col < effectiveMeasuresPerLine; col++) {
      const measureNum = col + 1
      if (measureNum > exercise.measures) break

      const x = col * measureWidth + 20
      const y = 10

      const stave = new Stave(x, y, measureWidth)
      if (col === 0) {
        stave.addClef('percussion')
        stave.addTimeSignature(`${exercise.timeSignature[0]}/${exercise.timeSignature[1]}`)
        firstStaveX = x + stave.getNoteStartX() - x
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
        rest.setStyle(isDark
          ? { fillStyle: 'hsl(25,8%,50%)', strokeStyle: 'hsl(25,8%,50%)' }
          : { fillStyle: 'hsl(25,12%,55%)', strokeStyle: 'hsl(25,12%,55%)' }
        )
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

        // Note color (always dark on cream paper)
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

    if (eventResults.length === 0) {
      containerRef.current.querySelectorAll('[data-graded]').forEach(el => {
        delete (el as HTMLElement).dataset.graded
        el.querySelectorAll('path, text, rect, line').forEach(child => {
          ;(child as SVGElement).style.fill = ''
          ;(child as SVGElement).style.stroke = ''
        })
      })
      return
    }

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

        // Hit pulse or miss shake animation
        if (result.grade === 'miss') {
          htmlEl.classList.add('note-miss-shake')
          setTimeout(() => htmlEl.classList.remove('note-miss-shake'), 400)
        } else {
          htmlEl.classList.add('note-hit-pulse')
          setTimeout(() => htmlEl.classList.remove('note-hit-pulse'), 450)
        }
      }
    }
  }, [eventResults, svgReady])

  // Fixed playhead position: 30% from left of viewport
  const PLAYHEAD_VIEWPORT_RATIO = 0.3

  // Guitar Hero style: fixed playhead, notation scrolls behind it
  useEffect(() => {
    if (!playheadRef.current || !scrollContainerRef.current) return

    if (!isPlaying) {
      playheadRef.current.style.opacity = '0'
      scrollContainerRef.current.scrollTo({ left: 0 })
      return
    }

    playheadRef.current.style.opacity = '1'
    const viewWidth = scrollContainerRef.current.clientWidth
    const fixedX = viewWidth * PLAYHEAD_VIEWPORT_RATIO

    // Scroll so current beat position aligns under the fixed playhead
    const beatX = notationLeftRef.current + playheadProgress * notationWidthRef.current
    const targetScroll = beatX - fixedX
    scrollContainerRef.current.scrollLeft = Math.max(0, targetScroll)
  }, [playheadProgress, isPlaying])

  return (
    <div className="relative w-full overflow-hidden rounded-2xl notation-parchment shadow-md">
      {/* CSS for hit pulse animation */}
      <style jsx global>{`
        @keyframes notePulse {
          0% { filter: brightness(1) drop-shadow(0 0 0px currentColor); transform: scale(1); }
          20% { filter: brightness(1.8) drop-shadow(0 0 14px currentColor); transform: scale(1.08); }
          50% { filter: brightness(1.4) drop-shadow(0 0 8px currentColor); transform: scale(1.02); }
          100% { filter: brightness(1) drop-shadow(0 0 0px currentColor); transform: scale(1); }
        }
        @keyframes noteMiss {
          0% { filter: brightness(1); transform: translateX(0); }
          15% { filter: brightness(1.2) hue-rotate(-20deg); transform: translateX(-3px); }
          30% { transform: translateX(3px); }
          45% { transform: translateX(-2px); }
          60% { transform: translateX(1px); }
          100% { filter: brightness(1); transform: translateX(0); }
        }
        .note-hit-pulse {
          animation: notePulse 0.45s ease-out;
        }
        .note-miss-shake {
          animation: noteMiss 0.4s ease-out;
        }
      `}</style>

      {/* Fixed playhead — positioned over the scroll area, never moves */}
      <div
        ref={playheadRef}
        className="absolute top-0 bottom-0 z-10 pointer-events-none"
        style={{
          opacity: 0,
          left: '30%',
          width: '3px',
          background: 'linear-gradient(180deg, hsl(30,85%,55%), hsl(14,52%,53%))',
          boxShadow: '0 0 8px hsla(30,85%,55%,0.4), 0 0 16px hsla(14,52%,53%,0.2)',
          borderRadius: '2px',
          maskImage: 'linear-gradient(180deg, transparent 0%, black 10%, black 90%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, black 10%, black 90%, transparent 100%)',
          animation: isPlaying ? 'pulse-glow 2s ease-in-out infinite' : 'none',
          transition: 'opacity 0.2s ease',
        }}
      />

      {/* Scrollable notation area */}
      <div
        ref={scrollContainerRef}
        className="relative overflow-x-hidden overflow-y-hidden py-4 px-2 md:py-6 md:px-4"
      >
        {/* Notation container */}
        <div ref={containerRef} className="w-full min-h-[286px]" />
      </div>
    </div>
  )
}
