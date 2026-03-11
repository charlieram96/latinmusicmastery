'use client'

import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import { useTheme } from '@/components/theme-provider'
import type { ExerciseDefinition, EventResult, HitGrade } from '@/lib/play-sense/types'
import { GRADE_COLORS } from '@/lib/play-sense/types'
import {
  buildLaneConfig,
  eventToNormalizedTime,
  getTechniqueColor,
} from '@/lib/play-sense/fretboard-utils'
import { getExerciseDuration } from '@/lib/play-sense/exercise-utils'

interface FretboardViewProps {
  exercise: ExerciseDefinition
  eventResults: EventResult[]
  playheadProgress: number // 0-1
  isPlaying: boolean
  mode?: 'live' | 'static' // default 'live'
}

const HIT_LINE_RATIO = .95
const LOOK_AHEAD_SEC = 9
const BOARD_HEIGHT = 2500
const BOARD_HEIGHT_MOBILE = 2000
const LOOK_BEHIND_SEC = 0.5
const NOTE_RADIUS_DESKTOP = 20
const NOTE_RADIUS_MOBILE = 16
const MIN_LANE_WIDTH = 48
const RECEIVER_RADIUS_DESKTOP = 30
const RECEIVER_RADIUS_MOBILE = 24
const PROXIMITY_THRESHOLD = 0.5 // seconds for receiver glow

export function FretboardView({ exercise, eventResults, playheadProgress, isPlaying, mode = 'live' }: FretboardViewProps) {
  const isStatic = mode === 'static'
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 400, height: 500 })
  const [compact, setCompact] = useState(false)
  const gradedRef = useRef<Set<number>>(new Set())

  // Reset graded set when results clear
  useEffect(() => {
    if (eventResults.length === 0) {
      gradedRef.current.clear()
    }
  }, [eventResults.length])

  // ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setSize({ width: Math.max(width, 100), height: Math.max(height, 200) })
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const lanes = useMemo(() => buildLaneConfig(exercise), [exercise])
  const laneWidth = size.width / lanes.length
  const isCompact = laneWidth < MIN_LANE_WIDTH

  useEffect(() => setCompact(isCompact), [isCompact])

  const duration = useMemo(() => getExerciseDuration(exercise), [exercise])
  const boardHeight = size.width < 640 ? BOARD_HEIGHT_MOBILE : BOARD_HEIGHT
  const noteRadius = size.width < 500 ? NOTE_RADIUS_MOBILE : NOTE_RADIUS_DESKTOP
  const receiverRadius = size.width < 500 ? RECEIVER_RADIUS_MOBILE : RECEIVER_RADIUS_DESKTOP

  // Build note data with normalized times (including loops)
  const notes = useMemo(() => {
    const result: Array<{
      normalizedTime: number
      technique: string
      hand: string
      accent: boolean
      duration: number
      eventIndex: number
    }> = []

    for (let loop = 0; loop < exercise.loopCount; loop++) {
      for (const event of exercise.events) {
        const t = eventToNormalizedTime(event, exercise, loop)
        result.push({
          normalizedTime: t,
          technique: event.technique,
          hand: event.hand,
          accent: event.accent,
          duration: event.duration,
          eventIndex: result.length,
        })
      }
    }

    return result.sort((a, b) => a.normalizedTime - b.normalizedTime)
  }, [exercise])

  // Compute virtual height: maps the full exercise duration to pixel space
  const lookAheadFraction = duration > 0 ? LOOK_AHEAD_SEC / duration : 0.3
  const hitLineY = boardHeight * HIT_LINE_RATIO
  const virtualHeight = isStatic
    ? boardHeight * 0.85 // In static mode, fit all notes within the board
    : lookAheadFraction > 0 ? hitLineY / lookAheadFraction : boardHeight * 3

  // Note group translateY: shift so current progress aligns at hit line
  const noteGroupOffset = isStatic
    ? boardHeight * 0.92 // In static mode, start notes near bottom
    : hitLineY + playheadProgress * virtualHeight

  // Visible range for culling (in normalized time)
  const lookBehindFraction = duration > 0 ? LOOK_BEHIND_SEC / duration : 0.05
  const visibleMin = isStatic ? -1 : playheadProgress - lookBehindFraction
  const visibleMax = isStatic ? 2 : playheadProgress + lookAheadFraction * 1.2

  // Build event result lookup
  const resultMap = useMemo(() => {
    const map = new Map<number, EventResult>()
    for (const r of eventResults) {
      map.set(r.eventIndex, r)
    }
    return map
  }, [eventResults])

  // Measure lines (normalized time positions)
  const measureLines = useMemo(() => {
    const lines: number[] = []
    const beatsPerMeasure = exercise.timeSignature[0]
    const beatDuration = 60 / exercise.bpm
    const totalMeasures = exercise.measures * exercise.loopCount
    for (let m = 0; m <= totalMeasures; m++) {
      const time = m * beatsPerMeasure * beatDuration
      lines.push(duration > 0 ? time / duration : 0)
    }
    return lines
  }, [exercise, duration])

  // Closest note per lane (for receiver glow proximity)
  const closestPerLane = useMemo(() => {
    const proximityFraction = duration > 0 ? PROXIMITY_THRESHOLD / duration : 0.05
    const closest = new Map<string, number>() // technique -> min distance in normalized time

    for (const note of notes) {
      const dist = note.normalizedTime - playheadProgress
      if (dist < 0) continue // already passed
      if (dist > proximityFraction) continue // too far

      const current = closest.get(note.technique)
      if (current === undefined || dist < current) {
        closest.set(note.technique, dist)
      }
    }

    return closest
  }, [notes, playheadProgress, duration])

  // Check if a lane has a recent hit for flash
  const recentHitPerLane = useMemo(() => {
    const hits = new Map<string, HitGrade>()
    for (const result of eventResults) {
      if (result.grade === 'miss') continue
      // Find the note for this event
      const note = notes.find((n) => n.eventIndex === result.eventIndex)
      if (!note) continue
      // Only flash if very recent (within ~0.3s)
      const timeDist = Math.abs(note.normalizedTime - playheadProgress)
      const recentFraction = duration > 0 ? 0.3 / duration : 0.03
      if (timeDist < recentFraction) {
        hits.set(note.technique, result.grade)
      }
    }
    return hits
  }, [eventResults, notes, playheadProgress, duration])

  // Colors
  const measureLineColor = isDark ? 'hsl(25, 6%, 30%)' : 'hsl(25, 8%, 78%)'
  const noteStroke = isDark ? 'hsl(30, 15%, 85%)' : 'hsl(20, 25%, 12%)'
  const staffLineColor = isDark ? 'hsl(25, 8%, 35%)' : 'hsl(25, 12%, 72%)'

  // Grade coloring via DOM for animations
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current) return

    if (eventResults.length === 0) {
      // Reset all graded notes
      svgRef.current.querySelectorAll('[data-graded]').forEach((el) => {
        delete (el as SVGElement).dataset.graded
        ;(el as SVGElement).removeAttribute('style')
      })
      return
    }

    for (const result of eventResults) {
      if (gradedRef.current.has(result.eventIndex)) continue
      gradedRef.current.add(result.eventIndex)

      const color = GRADE_COLORS[result.grade]
      const el = svgRef.current.querySelector(`[data-event-index="${result.eventIndex}"]`)
      if (!el) continue

      const svgEl = el as SVGElement
      svgEl.dataset.graded = 'true'
      svgEl.style.fill = color
      svgEl.style.stroke = color

      if (result.grade === 'miss') {
        svgEl.classList.add('note-miss-shake')
        setTimeout(() => svgEl.classList.remove('note-miss-shake'), 400)
      } else {
        svgEl.classList.add('note-hit-pulse')
        setTimeout(() => svgEl.classList.remove('note-hit-pulse'), 450)
      }

      // Flash receiver circle
      const receiverEl = svgRef.current.querySelector(`[data-receiver="${notes.find((n) => n.eventIndex === result.eventIndex)?.technique}"]`)
      if (receiverEl) {
        receiverEl.classList.add('receiver-hit-flash')
        setTimeout(() => receiverEl.classList.remove('receiver-hit-flash'), 300)
      }
    }
  }, [eventResults, notes])

  // Get lane X center
  const getLaneX = useCallback(
    (technique: string) => {
      const idx = lanes.findIndex((l) => l.technique === technique)
      if (idx === -1) return size.width / 2
      return (idx + 0.5) * laneWidth
    },
    [lanes, laneWidth, size.width]
  )

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full fretboard-outer shadow-md"
    >
      <div className={isStatic ? '' : 'fretboard-perspective'}>
        <div className={isStatic ? '' : 'fretboard-runway'}>
        <div className={isStatic ? 'notation-parchment' : 'fretboard-board notation-parchment'}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${size.width} ${boardHeight}`}
            preserveAspectRatio="none"
            className="block"
            style={{ width: '100%', height: '100%' }}
          >
            {/* Vertical staff lines — one per lane, like fretboard strings */}
            {lanes.map((lane, i) => {
              const x = (i + 0.5) * laneWidth
              return (
                <line
                  key={`staff-${i}`}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={boardHeight}
                  stroke={staffLineColor}
                  strokeWidth={1}
                  opacity={0.6}
                />
              )
            })}

            {/* Measure lines — scrolling with notes */}
            <g
              transform={`translate(0, ${noteGroupOffset})`}
              style={{ willChange: 'transform' }}
            >
              {measureLines.map((t, i) => {
                const y = -t * virtualHeight
                return (
                  <line
                    key={`measure-${i}`}
                    x1={0}
                    y1={y}
                    x2={size.width}
                    y2={y}
                    stroke={measureLineColor}
                    strokeWidth={1}
                    strokeDasharray="6 4"
                    className="fretboard-measure-line"
                    opacity={0.6}
                  />
                )
              })}
            </g>

            {/* Hit line (hidden in static mode) */}
            {!isStatic && (
              <>
                <defs>
                  <linearGradient id="hitLineGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="hsl(30, 85%, 55%)" stopOpacity={0} />
                    <stop offset="15%" stopColor="hsl(30, 85%, 55%)" stopOpacity={1} />
                    <stop offset="85%" stopColor="hsl(14, 52%, 53%)" stopOpacity={1} />
                    <stop offset="100%" stopColor="hsl(14, 52%, 53%)" stopOpacity={0} />
                  </linearGradient>
                  <filter id="hitLineGlow">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <rect
                  x={0}
                  y={hitLineY - 2}
                  width={size.width}
                  height={4}
                  fill="url(#hitLineGrad)"
                  filter="url(#hitLineGlow)"
                  className="fretboard-hit-line"
                />
              </>
            )}

            {/* Receiver circles — one per lane at hit line (hidden in static mode) */}
            {!isStatic && lanes.map((lane, i) => {
              const cx = (i + 0.5) * laneWidth
              const cy = hitLineY
              const color = lane.color
              const proximityDist = closestPerLane.get(lane.technique)
              const proximityFraction = duration > 0 ? PROXIMITY_THRESHOLD / duration : 0.05
              // Glow opacity: 0.3 base, up to 0.9 when note is right on top
              const glowOpacity = proximityDist !== undefined
                ? 0.3 + 0.6 * (1 - proximityDist / proximityFraction)
                : 0.3

              return (
                <g key={`receiver-${i}`} data-receiver={lane.technique}>
                  {/* Glow ring */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={receiverRadius + 4}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    opacity={glowOpacity}
                    className="receiver-glow"
                  />
                  {/* Inner circle */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={receiverRadius}
                    fill={isDark ? 'hsl(20, 8%, 18%)' : 'hsl(35, 25%, 90%)'}
                    stroke={color}
                    strokeWidth={2}
                    opacity={0.85}
                  />
                  {/* Technique label */}
                  {!compact && (
                    <text
                      x={cx}
                      y={cy + 1}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={color}
                      fontSize={compact ? 9 : 11}
                      fontWeight={700}
                      style={{ userSelect: 'none', pointerEvents: 'none' }}
                    >
                      {lane.label}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Note group — scrolls via translateY */}
            <g
              transform={`translate(0, ${noteGroupOffset})`}
              style={{ willChange: 'transform' }}
            >
              {notes.map((note) => {
                // Cull notes outside visible range
                if (note.normalizedTime < visibleMin || note.normalizedTime > visibleMax) return null

                const cx = getLaneX(note.technique)
                const cy = -note.normalizedTime * virtualHeight
                const r = note.accent ? noteRadius * 1.3 : noteRadius
                const result = resultMap.get(note.eventIndex)
                const gradeColor = result ? GRADE_COLORS[result.grade] : undefined
                const isRightHand = note.hand === 'R'
                const techniqueColor = getTechniqueColor(note.technique as any)

                // Duration tail height
                const beatDuration = 60 / exercise.bpm
                const tailHeight =
                  note.duration > 0.5
                    ? ((note.duration * beatDuration) / duration) * virtualHeight
                    : 0

                return (
                  <g key={note.eventIndex} data-event-index={note.eventIndex}>
                    {/* Duration tail */}
                    {tailHeight > 4 && (
                      <line
                        x1={cx}
                        y1={cy - tailHeight}
                        x2={cx}
                        y2={cy}
                        stroke={gradeColor || techniqueColor}
                        strokeWidth={3}
                        strokeLinecap="round"
                        opacity={0.5}
                      />
                    )}

                    {/* Note circle — colored by technique */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={r}
                      fill={gradeColor || (isRightHand ? techniqueColor : 'transparent')}
                      stroke={gradeColor || techniqueColor}
                      strokeWidth={isRightHand ? 0 : 2.5}
                      className={isRightHand ? 'fretboard-note-R' : 'fretboard-note-L'}
                    />

                    {/* Accent marker */}
                    {note.accent && (
                      <text
                        x={cx}
                        y={cy - r - 4}
                        textAnchor="middle"
                        fill={gradeColor || techniqueColor}
                        fontSize={14}
                        fontWeight={700}
                      >
                        &gt;
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          </svg>
        </div>
        </div>
      </div>
      {/* Top fade overlay — painted after 3D content so it renders on top (hidden in static mode) */}
      {!isStatic && <div
        className="absolute top-0 left-0 right-0 h-32 pointer-events-none rounded-t-[1rem]"
        style={{
          zIndex: 50,
          background: isDark
            ? 'linear-gradient(rgb(18 18 18) 0%, rgb(18 18 18) 45%, rgb(18 18 18) 60%, transparent 100%)'
            : 'linear-gradient(hsl(35 30% 93%) 0%, hsl(35 30% 93%) 45%, hsl(35 30% 93%) 60%, transparent 100%)',
        }}
      />}
    </div>
  )
}
