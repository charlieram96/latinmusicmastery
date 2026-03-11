'use client'

import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import { useTheme } from '@/components/theme-provider'
import type { ExerciseDefinition, EventResult, HitGrade } from '@/lib/play-sense/types'
import { GRADE_COLORS } from '@/lib/play-sense/types'
import { eventToNormalizedTime } from '@/lib/play-sense/fretboard-utils'
import { getExerciseDuration } from '@/lib/play-sense/exercise-utils'

interface ViolinFingerboardViewProps {
  exercise: ExerciseDefinition
  eventResults: EventResult[]
  playheadProgress: number
  isPlaying: boolean
}

const HIT_LINE_RATIO = 0.90
const LOOK_AHEAD_SEC = 9
const BOARD_HEIGHT = 2500
const BOARD_HEIGHT_MOBILE = 2000
const LOOK_BEHIND_SEC = 0.5
const NOTE_RADIUS_DESKTOP = 20
const NOTE_RADIUS_MOBILE = 16
const PROXIMITY_THRESHOLD = 0.5
const RECEIVER_RADIUS_DESKTOP = 28
const RECEIVER_RADIUS_MOBILE = 22

// Violin open string MIDI notes
const STRINGS = [
  { name: 'G', midi: 55 }, // G3
  { name: 'D', midi: 62 }, // D4
  { name: 'A', midi: 69 }, // A4
  { name: 'E', midi: 76 }, // E5
] as const

// Max semitones above open string in first-through-third position
const MAX_POSITION = 5

// Position dot colors
const POSITION_COLORS = [
  'hsl(30, 60%, 55%)',   // open
  'hsl(0, 55%, 55%)',    // 1st
  'hsl(200, 40%, 50%)',  // 2nd
  'hsl(260, 40%, 55%)',  // 3rd
  'hsl(160, 40%, 45%)',  // 4th
  'hsl(45, 50%, 50%)',   // extension
]

/** Map a MIDI note to string index and finger position */
function midiToStringPosition(midi: number): { stringIndex: number; position: number } | null {
  // Try each string from lowest (G) to highest (E)
  // Pick the lowest string that can play the note
  for (let s = 0; s < STRINGS.length; s++) {
    const openMidi = STRINGS[s].midi
    const pos = midi - openMidi
    if (pos >= 0 && pos <= MAX_POSITION) {
      return { stringIndex: s, position: pos }
    }
  }
  // Fallback: find closest string
  let bestString = 0
  let bestDist = Infinity
  for (let s = 0; s < STRINGS.length; s++) {
    const dist = Math.abs(midi - STRINGS[s].midi)
    if (dist < bestDist) { bestDist = dist; bestString = s }
  }
  const pos = Math.max(0, Math.min(MAX_POSITION, midi - STRINGS[bestString].midi))
  return { stringIndex: bestString, position: pos }
}

export function ViolinFingerboardView({ exercise, eventResults, playheadProgress, isPlaying }: ViolinFingerboardViewProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 400, height: 500 })
  const gradedRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    if (eventResults.length === 0) gradedRef.current.clear()
  }, [eventResults.length])

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

  const duration = useMemo(() => getExerciseDuration(exercise), [exercise])
  const boardHeight = size.width < 640 ? BOARD_HEIGHT_MOBILE : BOARD_HEIGHT
  const noteRadius = size.width < 500 ? NOTE_RADIUS_MOBILE : NOTE_RADIUS_DESKTOP
  const receiverRadius = size.width < 500 ? RECEIVER_RADIUS_MOBILE : RECEIVER_RADIUS_DESKTOP

  const hitLineY = boardHeight * HIT_LINE_RATIO

  // String spacing
  const stringPadding = size.width * 0.15
  const stringSpacing = (size.width - stringPadding * 2) / (STRINGS.length - 1)

  const getStringX = useCallback(
    (stringIndex: number) => stringPadding + stringIndex * stringSpacing,
    [stringPadding, stringSpacing]
  )

  // Position markers spacing (horizontal offsets from string center — like fret distances)
  const positionSpacing = size.width < 500 ? 8 : 12

  const getNoteX = useCallback(
    (stringIndex: number, position: number) => {
      // Open string: on the string line. Fingered: slightly offset right of string
      return getStringX(stringIndex) + position * positionSpacing
    },
    [getStringX, positionSpacing]
  )

  // Build note data
  const notes = useMemo(() => {
    const result: Array<{
      normalizedTime: number
      hand: string
      accent: boolean
      duration: number
      eventIndex: number
      expectedPitch: number
      expectedNoteName?: string
      stringIndex: number
      position: number
    }> = []

    for (let loop = 0; loop < exercise.loopCount; loop++) {
      for (const event of exercise.events) {
        const t = eventToNormalizedTime(event, exercise, loop)
        const midi = event.expectedPitch || 55
        const sp = midiToStringPosition(midi)
        result.push({
          normalizedTime: t,
          hand: event.hand,
          accent: event.accent,
          duration: event.duration,
          eventIndex: result.length,
          expectedPitch: midi,
          expectedNoteName: event.expectedNoteName,
          stringIndex: sp?.stringIndex ?? 0,
          position: sp?.position ?? 0,
        })
      }
    }

    return result.sort((a, b) => a.normalizedTime - b.normalizedTime)
  }, [exercise])

  // Scrolling
  const lookAheadFraction = duration > 0 ? LOOK_AHEAD_SEC / duration : 0.3
  const virtualHeight = lookAheadFraction > 0 ? hitLineY / lookAheadFraction : boardHeight * 3
  const noteGroupOffset = hitLineY + playheadProgress * virtualHeight
  const lookBehindFraction = duration > 0 ? LOOK_BEHIND_SEC / duration : 0.05
  const visibleMin = playheadProgress - lookBehindFraction
  const visibleMax = playheadProgress + lookAheadFraction * 1.2

  const resultMap = useMemo(() => {
    const map = new Map<number, EventResult>()
    for (const r of eventResults) map.set(r.eventIndex, r)
    return map
  }, [eventResults])

  // Measure lines
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

  // Closest note per string for receiver glow
  const closestPerString = useMemo(() => {
    const proximityFraction = duration > 0 ? PROXIMITY_THRESHOLD / duration : 0.05
    const closest = new Map<number, number>() // stringIndex -> min distance

    for (const note of notes) {
      const dist = note.normalizedTime - playheadProgress
      if (dist < 0 || dist > proximityFraction) continue
      const current = closest.get(note.stringIndex)
      if (current === undefined || dist < current) {
        closest.set(note.stringIndex, dist)
      }
    }
    return closest
  }, [notes, playheadProgress, duration])

  // Colors
  const measureLineColor = isDark ? 'hsl(25, 6%, 30%)' : 'hsl(25, 8%, 78%)'
  const stringColor = isDark ? 'hsl(35, 20%, 60%)' : 'hsl(25, 15%, 45%)'

  const svgRef = useRef<SVGSVGElement>(null)

  // Grade coloring via DOM
  useEffect(() => {
    if (!svgRef.current) return

    if (eventResults.length === 0) {
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

      // Flash receiver
      const note = notes.find((n) => n.eventIndex === result.eventIndex)
      if (note) {
        const receiverEl = svgRef.current.querySelector(`[data-receiver="string-${note.stringIndex}"]`)
        if (receiverEl) {
          receiverEl.classList.add('receiver-hit-flash')
          setTimeout(() => receiverEl.classList.remove('receiver-hit-flash'), 300)
        }
      }
    }
  }, [eventResults, notes])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full fretboard-outer shadow-md"
    >
      <div className="fretboard-perspective">
        <div className="fretboard-runway">
          <div className="fretboard-board notation-parchment">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${size.width} ${boardHeight}`}
              preserveAspectRatio="none"
              className="block"
              style={{ width: '100%', height: '100%' }}
            >
              {/* String lines */}
              {STRINGS.map((str, i) => {
                const x = getStringX(i)
                // Vary thickness: G is thickest, E is thinnest
                const thickness = 3 - i * 0.5
                return (
                  <line
                    key={`string-${i}`}
                    x1={x}
                    y1={0}
                    x2={x}
                    y2={boardHeight}
                    stroke={stringColor}
                    strokeWidth={thickness}
                    opacity={0.7}
                  />
                )
              })}

              {/* Measure lines */}
              <g
                transform={`translate(0, ${noteGroupOffset})`}
                style={{ willChange: 'transform' }}
              >
                {measureLines.map((t, i) => {
                  const y = -t * virtualHeight
                  return (
                    <line
                      key={`measure-${i}`}
                      x1={stringPadding - 20}
                      y1={y}
                      x2={size.width - stringPadding + 20}
                      y2={y}
                      stroke={measureLineColor}
                      strokeWidth={1}
                      strokeDasharray="6 4"
                      opacity={0.6}
                    />
                  )
                })}
              </g>

              {/* Hit line */}
              <defs>
                <linearGradient id="violinHitLineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="hsl(30, 85%, 55%)" stopOpacity={0} />
                  <stop offset="15%" stopColor="hsl(30, 85%, 55%)" stopOpacity={1} />
                  <stop offset="85%" stopColor="hsl(14, 52%, 53%)" stopOpacity={1} />
                  <stop offset="100%" stopColor="hsl(14, 52%, 53%)" stopOpacity={0} />
                </linearGradient>
                <filter id="violinHitLineGlow">
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
                fill="url(#violinHitLineGrad)"
                filter="url(#violinHitLineGlow)"
              />

              {/* Receiver circles — one per string at hit line */}
              {STRINGS.map((str, i) => {
                const cx = getStringX(i)
                const cy = hitLineY
                const proximityDist = closestPerString.get(i)
                const proximityFraction = duration > 0 ? PROXIMITY_THRESHOLD / duration : 0.05
                const glowOpacity = proximityDist !== undefined
                  ? 0.3 + 0.6 * (1 - proximityDist / proximityFraction)
                  : 0.3

                return (
                  <g key={`receiver-${i}`} data-receiver={`string-${i}`}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={receiverRadius + 4}
                      fill="none"
                      stroke={stringColor}
                      strokeWidth={2}
                      opacity={glowOpacity}
                      className="receiver-glow"
                    />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={receiverRadius}
                      fill={isDark ? 'hsl(20, 8%, 18%)' : 'hsl(35, 25%, 90%)'}
                      stroke={stringColor}
                      strokeWidth={2}
                      opacity={0.85}
                    />
                    <text
                      x={cx}
                      y={cy + 1}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={stringColor}
                      fontSize={12}
                      fontWeight={700}
                      style={{ userSelect: 'none', pointerEvents: 'none' }}
                    >
                      {str.name}
                    </text>
                  </g>
                )
              })}

              {/* Note group — scrolls via translateY */}
              <g
                transform={`translate(0, ${noteGroupOffset})`}
                style={{ willChange: 'transform' }}
              >
                {notes.map((note) => {
                  if (note.normalizedTime < visibleMin || note.normalizedTime > visibleMax) return null

                  const cx = getNoteX(note.stringIndex, note.position)
                  const cy = -note.normalizedTime * virtualHeight
                  const r = note.accent ? noteRadius * 1.3 : noteRadius
                  const result = resultMap.get(note.eventIndex)
                  const gradeColor = result ? GRADE_COLORS[result.grade] : undefined
                  const isRightHand = note.hand === 'R'
                  const posColor = POSITION_COLORS[note.position] || POSITION_COLORS[0]

                  // Duration tail
                  const beatDuration = 60 / exercise.bpm
                  const tailHeight =
                    note.duration > 0.5
                      ? ((note.duration * beatDuration) / duration) * virtualHeight
                      : 0

                  return (
                    <g key={note.eventIndex} data-event-index={note.eventIndex}>
                      {tailHeight > 4 && (
                        <line
                          x1={cx}
                          y1={cy - tailHeight}
                          x2={cx}
                          y2={cy}
                          stroke={gradeColor || posColor}
                          strokeWidth={3}
                          strokeLinecap="round"
                          opacity={0.5}
                        />
                      )}

                      <circle
                        cx={cx}
                        cy={cy}
                        r={r}
                        fill={gradeColor || (isRightHand ? posColor : 'transparent')}
                        stroke={gradeColor || posColor}
                        strokeWidth={isRightHand ? 0 : 2.5}
                        className={isRightHand ? 'fretboard-note-R' : 'fretboard-note-L'}
                      />

                      {/* Note name label */}
                      {note.expectedNoteName && (
                        <text
                          x={cx}
                          y={cy + 1}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={gradeColor ? '#fff' : (isDark ? '#fff' : '#1a1a1a')}
                          fontSize={10}
                          fontWeight={700}
                          style={{ userSelect: 'none', pointerEvents: 'none' }}
                        >
                          {note.expectedNoteName.replace(/\d/, '')}
                        </text>
                      )}

                      {note.accent && (
                        <text
                          x={cx}
                          y={cy - r - 4}
                          textAnchor="middle"
                          fill={gradeColor || posColor}
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
      {/* Top fade overlay */}
      <div
        className="absolute top-0 left-0 right-0 h-32 pointer-events-none rounded-t-[1rem]"
        style={{
          zIndex: 50,
          background: isDark
            ? 'linear-gradient(rgb(18 18 18) 0%, rgb(18 18 18) 45%, rgb(18 18 18) 60%, transparent 100%)'
            : 'linear-gradient(hsl(35 30% 93%) 0%, hsl(35 30% 93%) 45%, hsl(35 30% 93%) 60%, transparent 100%)',
        }}
      />
    </div>
  )
}
