'use client'

import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import { useTheme } from '@/components/theme-provider'
import type { ExerciseDefinition, EventResult, HitGrade } from '@/lib/play-sense/types'
import { GRADE_COLORS } from '@/lib/play-sense/types'
import { eventToNormalizedTime, getTechniqueColor } from '@/lib/play-sense/fretboard-utils'
import { getExerciseDuration } from '@/lib/play-sense/exercise-utils'

interface PianoKeyboardViewProps {
  exercise: ExerciseDefinition
  eventResults: EventResult[]
  playheadProgress: number
  isPlaying: boolean
  detectedMidiNote?: number | null
}

const HIT_LINE_RATIO = 0.96
const LOOK_AHEAD_SEC = 9
const BOARD_HEIGHT = 2500
const BOARD_HEIGHT_MOBILE = 2000
const LOOK_BEHIND_SEC = 0.5
const PROXIMITY_THRESHOLD = 0.5

// Base key dimensions — scaled dynamically in component to fit 52 white keys
const BASE_WHITE_KEY_WIDTH = 36
const BASE_BLACK_KEY_WIDTH = 22
const BASE_WHITE_KEY_HEIGHT = 80
const BASE_BLACK_KEY_HEIGHT = 50

// Standard piano layout: which notes in an octave are white keys
// C=0, C#=1, D=2, D#=3, E=4, F=5, F#=6, G=7, G#=8, A=9, A#=10, B=11
const IS_BLACK = [false, true, false, true, false, false, true, false, true, false, true, false]
// White key index within octave (for C,D,E,F,G,A,B = 0,1,2,3,4,5,6)
const WHITE_KEY_INDEX = [0, -1, 1, -1, 2, 3, -1, 4, -1, 5, -1, 6]

/** Map a MIDI note to its key position relative to a range start */
function midiToKeyPosition(midi: number, rangeStart: number, whiteKeyWidth: number): { x: number; isBlack: boolean; whiteKeyIndex: number } {
  const noteInOctave = ((midi % 12) + 12) % 12
  const isBlack = IS_BLACK[noteInOctave]

  // Count white keys from rangeStart to this note
  let whiteCount = 0
  const lo = Math.min(midi, rangeStart)
  const hi = Math.max(midi, rangeStart)
  for (let n = lo; n < hi; n++) {
    if (!IS_BLACK[((n % 12) + 12) % 12]) whiteCount++
  }
  if (midi < rangeStart) whiteCount = -whiteCount

  // X position: center of the white key, or center of the black key (between whites)
  let x: number
  if (!isBlack) {
    x = whiteCount * whiteKeyWidth + whiteKeyWidth / 2
  } else {
    // Black key sits between the previous and next white keys
    // Find the white key just below this note
    let belowWhiteCount = 0
    for (let n = rangeStart; n < midi; n++) {
      if (!IS_BLACK[((n % 12) + 12) % 12]) belowWhiteCount++
    }
    x = belowWhiteCount * whiteKeyWidth
  }

  return { x, isBlack, whiteKeyIndex: whiteCount }
}


export function PianoKeyboardView({ exercise, eventResults, playheadProgress, isPlaying, detectedMidiNote }: PianoKeyboardViewProps) {
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

  // Full 88-key piano range: A0 (MIDI 21) to C8 (MIDI 108)
  const rangeStart = 21
  const rangeEnd = 108
  const whiteKeyCount = 52 // 52 white keys on a standard 88-key piano

  // Scale key dimensions to fit container width
  const WHITE_KEY_WIDTH = size.width / whiteKeyCount
  const scale = WHITE_KEY_WIDTH / BASE_WHITE_KEY_WIDTH
  const BLACK_KEY_WIDTH = BASE_BLACK_KEY_WIDTH * scale
  const WHITE_KEY_HEIGHT = BASE_WHITE_KEY_HEIGHT * scale
  const BLACK_KEY_HEIGHT = BASE_BLACK_KEY_HEIGHT * scale
  const keyboardWidth = size.width
  const duration = useMemo(() => getExerciseDuration(exercise), [exercise])
  const boardHeight = size.width < 640 ? BOARD_HEIGHT_MOBILE : BOARD_HEIGHT
  const keyboardY = boardHeight * HIT_LINE_RATIO
  const hitLineY = keyboardY

  // Center keyboard horizontally
  const keyboardOffsetX = Math.max(0, (size.width - keyboardWidth) / 2)

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
    }> = []

    for (let loop = 0; loop < exercise.loopCount; loop++) {
      for (const event of exercise.events) {
        const t = eventToNormalizedTime(event, exercise, loop)
        result.push({
          normalizedTime: t,
          hand: event.hand,
          accent: event.accent,
          duration: event.duration,
          eventIndex: result.length,
          expectedPitch: event.expectedPitch || 60,
          expectedNoteName: event.expectedNoteName,
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

  // Closest note per key for receiver glow
  const closestNotes = useMemo(() => {
    const proximityFraction = duration > 0 ? PROXIMITY_THRESHOLD / duration : 0.05
    const closest = new Map<number, number>() // midi -> min distance

    for (const note of notes) {
      const dist = note.normalizedTime - playheadProgress
      if (dist < 0 || dist > proximityFraction) continue
      const current = closest.get(note.expectedPitch)
      if (current === undefined || dist < current) {
        closest.set(note.expectedPitch, dist)
      }
    }
    return closest
  }, [notes, playheadProgress, duration])

  // Get position and dimensions for a MIDI note (matches its target key)
  const getNotePos = useCallback(
    (midi: number) => {
      const pos = midiToKeyPosition(midi, rangeStart, WHITE_KEY_WIDTH)
      const cx = keyboardOffsetX + pos.x
      const noteW = pos.isBlack ? BLACK_KEY_WIDTH : WHITE_KEY_WIDTH
      const noteH = pos.isBlack ? BLACK_KEY_HEIGHT : WHITE_KEY_HEIGHT
      return { cx, isBlack: pos.isBlack, noteW, noteH }
    },
    [rangeStart, keyboardOffsetX, WHITE_KEY_WIDTH, BLACK_KEY_WIDTH, WHITE_KEY_HEIGHT, BLACK_KEY_HEIGHT]
  )

  // Colors
  const measureLineColor = isDark ? 'hsl(25, 6%, 30%)' : 'hsl(25, 8%, 78%)'
  const noteStroke = isDark ? 'hsl(30, 15%, 85%)' : 'hsl(20, 25%, 12%)'

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
    }
  }, [eventResults, notes])

  // Build keyboard keys
  const keyboardKeys = useMemo(() => {
    const whites: Array<{ midi: number; x: number }> = []
    const blacks: Array<{ midi: number; x: number }> = []

    let whiteIdx = 0
    for (let midi = rangeStart; midi <= rangeEnd; midi++) {
      const noteInOctave = ((midi % 12) + 12) % 12
      if (IS_BLACK[noteInOctave]) {
        // Black key: position between previous and next white key
        const x = keyboardOffsetX + whiteIdx * WHITE_KEY_WIDTH
        blacks.push({ midi, x: x - BLACK_KEY_WIDTH / 2 })
      } else {
        const x = keyboardOffsetX + whiteIdx * WHITE_KEY_WIDTH
        whites.push({ midi, x })
        whiteIdx++
      }
    }

    return { whites, blacks }
  }, [rangeStart, rangeEnd, keyboardOffsetX, WHITE_KEY_WIDTH, BLACK_KEY_WIDTH])

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
              {/* Vertical guide lines for each white key */}
              {keyboardKeys.whites.map((key, i) => {
                const cx = key.x + WHITE_KEY_WIDTH / 2
                return (
                  <line
                    key={`guide-${i}`}
                    x1={cx}
                    y1={0}
                    x2={cx}
                    y2={hitLineY}
                    stroke={isDark ? 'hsl(25, 8%, 25%)' : 'hsl(25, 12%, 82%)'}
                    strokeWidth={0.5}
                    opacity={0.4}
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
                      x1={keyboardOffsetX}
                      y1={y}
                      x2={keyboardOffsetX + keyboardWidth}
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
                <linearGradient id="pianoHitLineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="hsl(30, 85%, 55%)" stopOpacity={0} />
                  <stop offset="15%" stopColor="hsl(30, 85%, 55%)" stopOpacity={1} />
                  <stop offset="85%" stopColor="hsl(14, 52%, 53%)" stopOpacity={1} />
                  <stop offset="100%" stopColor="hsl(14, 52%, 53%)" stopOpacity={0} />
                </linearGradient>
                <filter id="pianoHitLineGlow">
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
                fill="url(#pianoHitLineGrad)"
                filter="url(#pianoHitLineGlow)"
              />

              {/* Piano keyboard at bottom */}
              {/* White keys */}
              {keyboardKeys.whites.map((key) => {
                const proximityDist = closestNotes.get(key.midi)
                const proximityFraction = duration > 0 ? PROXIMITY_THRESHOLD / duration : 0.05
                const glowOpacity = proximityDist !== undefined
                  ? 0.3 + 0.7 * (1 - proximityDist / proximityFraction)
                  : 0

                return (
                  <g key={`wk-${key.midi}`}>
                    <rect
                      x={key.x + 1}
                      y={keyboardY}
                      width={WHITE_KEY_WIDTH - 2}
                      height={WHITE_KEY_HEIGHT}
                      rx={3}
                      fill={isDark ? 'hsl(35, 15%, 85%)' : 'hsl(0, 0%, 97%)'}
                      stroke={isDark ? 'hsl(25, 10%, 50%)' : 'hsl(25, 10%, 70%)'}
                      strokeWidth={1}
                    />
                    {glowOpacity > 0 && (
                      <rect
                        x={key.x + 1}
                        y={keyboardY}
                        width={WHITE_KEY_WIDTH - 2}
                        height={WHITE_KEY_HEIGHT}
                        rx={3}
                        fill="hsl(30, 85%, 55%)"
                        opacity={glowOpacity * 0.3}
                      />
                    )}
                    {key.midi === detectedMidiNote && (
                      <rect
                        x={key.x + 1}
                        y={keyboardY}
                        width={WHITE_KEY_WIDTH - 2}
                        height={WHITE_KEY_HEIGHT}
                        rx={3}
                        fill="hsl(190, 95%, 55%)"
                        opacity={0.75}
                      />
                    )}
                  </g>
                )
              })}
              {/* Black keys */}
              {keyboardKeys.blacks.map((key) => {
                const proximityDist = closestNotes.get(key.midi)
                const proximityFraction = duration > 0 ? PROXIMITY_THRESHOLD / duration : 0.05
                const glowOpacity = proximityDist !== undefined
                  ? 0.3 + 0.7 * (1 - proximityDist / proximityFraction)
                  : 0

                return (
                  <g key={`bk-${key.midi}`}>
                    <rect
                      x={key.x}
                      y={keyboardY}
                      width={BLACK_KEY_WIDTH}
                      height={BLACK_KEY_HEIGHT}
                      rx={2}
                      fill={isDark ? 'hsl(20, 8%, 15%)' : 'hsl(20, 8%, 12%)'}
                      stroke={isDark ? 'hsl(25, 10%, 30%)' : 'hsl(25, 10%, 25%)'}
                      strokeWidth={1}
                    />
                    {glowOpacity > 0 && (
                      <rect
                        x={key.x}
                        y={keyboardY}
                        width={BLACK_KEY_WIDTH}
                        height={BLACK_KEY_HEIGHT}
                        rx={2}
                        fill="hsl(30, 85%, 55%)"
                        opacity={glowOpacity * 0.4}
                      />
                    )}
                    {key.midi === detectedMidiNote && (
                      <rect
                        x={key.x}
                        y={keyboardY}
                        width={BLACK_KEY_WIDTH}
                        height={BLACK_KEY_HEIGHT}
                        rx={2}
                        fill="hsl(190, 95%, 55%)"
                        opacity={0.75}
                      />
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
                  if (note.normalizedTime < visibleMin || note.normalizedTime > visibleMax) return null

                  const { cx, isBlack, noteW, noteH } = getNotePos(note.expectedPitch)
                  const noteX = cx - noteW / 2
                  // Bottom edge of the rect lands at cy (the hit/keyboard line)
                  const cy = -note.normalizedTime * virtualHeight
                  const noteY = cy - noteH
                  const result = resultMap.get(note.eventIndex)
                  const gradeColor = result ? GRADE_COLORS[result.grade] : undefined
                  const isRightHand = note.hand === 'R'
                  const defaultColor = 'hsl(30, 60%, 55%)'

                  // Duration tail — extends upward from the note
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
                          y1={noteY - tailHeight}
                          x2={cx}
                          y2={noteY}
                          stroke={gradeColor || defaultColor}
                          strokeWidth={3}
                          strokeLinecap="round"
                          opacity={0.5}
                        />
                      )}

                      <rect
                        x={noteX}
                        y={noteY}
                        width={noteW}
                        height={noteH}
                        rx={2}
                        fill={gradeColor || (isRightHand ? defaultColor : 'transparent')}
                        stroke={gradeColor || defaultColor}
                        strokeWidth={isRightHand ? 0 : 2}
                        className={isRightHand ? 'fretboard-note-R' : 'fretboard-note-L'}
                      />

                      {/* Note name label */}
                      {note.expectedNoteName && (
                        <text
                          x={cx}
                          y={noteY + noteH / 2}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={gradeColor ? '#fff' : (isDark ? '#fff' : '#1a1a1a')}
                          fontSize={Math.max(8, noteW * 0.4)}
                          fontWeight={700}
                          style={{ userSelect: 'none', pointerEvents: 'none' }}
                        >
                          {note.expectedNoteName.replace(/\d/, '')}
                        </text>
                      )}

                      {note.accent && (
                        <text
                          x={cx}
                          y={noteY - 4}
                          textAnchor="middle"
                          fill={gradeColor || defaultColor}
                          fontSize={Math.max(10, noteW * 0.5)}
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
