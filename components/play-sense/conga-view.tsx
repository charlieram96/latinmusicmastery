'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { usePlaysense } from '@/contexts/playsense-context'
import { getPlaySenseMapping } from '@/lib/play-sense/playsense-mappings'
import type { Instrument, ExerciseDefinition, EventResult, HitGrade } from '@/lib/play-sense/types'
import { GRADE_COLORS } from '@/lib/play-sense/types'
import { beatToTimestamp, getExerciseDuration } from '@/lib/play-sense/exercise-utils'
import { useTheme } from '@/components/theme-provider'

interface CongaViewProps {
  instrument: Instrument
  isPlaying?: boolean
  showPiezoLabels?: boolean
  showHitCounts?: boolean
  showMicLevel?: boolean
  exercise?: ExerciseDefinition | null
  playheadProgress?: number
  eventResults?: EventResult[]
}

interface SurfaceHitState {
  active: boolean
  flashKey: number
  hitCount: number
}

const SURFACE_LABELS: Record<string, string> = {
  quinto: 'Quinto', conga: 'Conga', tumba: 'Tumba',
  macho: 'Macho', hembra: 'Hembra', campana: 'Campana',
  cencerro: 'Cencerro', jamblock: 'Jam Block', cascara: 'Cáscara',
}

const SURFACE_COLORS: Record<string, string> = {
  quinto: '#f59e0b', conga: '#ef4444', tumba: '#8b5cf6',
  macho: '#f59e0b', hembra: '#ef4444',
  campana: '#eab308', cencerro: '#22c55e', jamblock: '#06b6d4', cascara: '#a855f7',
}

const HIT_LINE_RATIO = 0.92
const LOOK_AHEAD_SEC = 4
const BOARD_HEIGHT = 2500
const BOARD_HEIGHT_MOBILE = 2000
const LOOK_BEHIND_SEC = 0.4

interface NoteData {
  eventIndex: number
  normalizedTime: number
  surface: string
  hand: string
  accent: boolean
  technique: string
}

export function CongaView({
  instrument,
  isPlaying = false,
  showPiezoLabels = false,
  showHitCounts = false,
  showMicLevel = false,
  exercise,
  playheadProgress = 0,
  eventResults = [],
}: CongaViewProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const playsense = usePlaysense()
  const mapping = getPlaySenseMapping(instrument)
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ width: 400, height: 500 })
  const gradedRef = useRef<Set<number>>(new Set())

  const [surfaceStates, setSurfaceStates] = useState<Record<string, SurfaceHitState>>({})
  const [micLevel, setMicLevel] = useState(0)
  const timeoutRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const lastReadingRef = useRef<number>(0)
  const flashCounterRef = useRef(0)

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

  // Initialize surface states
  useEffect(() => {
    if (!mapping) return
    const initial: Record<string, SurfaceHitState> = {}
    for (const surface of Object.values(mapping.piezoMap)) {
      initial[surface] = { active: false, flashKey: 0, hitCount: 0 }
    }
    setSurfaceStates(initial)
  }, [mapping])

  // Reset graded set when results clear
  useEffect(() => {
    if (eventResults.length === 0) gradedRef.current.clear()
  }, [eventResults.length])

  // Process BLE readings
  useEffect(() => {
    if (!playsense.lastReading || !mapping) return
    const reading = playsense.lastReading
    if (reading.receivedAt <= lastReadingRef.current) return
    lastReadingRef.current = reading.receivedAt

    setMicLevel(Math.min((reading.mic || 0) / 4095, 1))

    for (let i = 0; i < reading.piezos.length; i++) {
      const val = reading.piezos[i]
      const surface = mapping.piezoMap[i]
      if (surface === undefined || val <= 0) continue

      const flashKey = ++flashCounterRef.current
      setSurfaceStates(prev => ({
        ...prev,
        [surface]: { active: true, flashKey, hitCount: (prev[surface]?.hitCount || 0) + 1 },
      }))

      if (timeoutRefs.current[surface]) clearTimeout(timeoutRefs.current[surface])
      timeoutRefs.current[surface] = setTimeout(() => {
        setSurfaceStates(prev => ({
          ...prev,
          [surface]: { ...prev[surface], active: false },
        }))
      }, 180)
    }
  }, [playsense.lastReading, mapping])

  useEffect(() => {
    return () => {
      for (const timeout of Object.values(timeoutRefs.current)) clearTimeout(timeout)
    }
  }, [])

  // Surfaces as ordered array
  const surfaces = useMemo(() => {
    if (!mapping) return []
    return Object.entries(mapping.piezoMap)
  }, [mapping])

  // Exercise data
  const duration = useMemo(() => exercise ? getExerciseDuration(exercise) : 0, [exercise])

  const notes = useMemo((): NoteData[] => {
    if (!exercise || !mapping) return []
    const result: NoteData[] = []
    const surfaceNames = Object.values(mapping.piezoMap)
    let eventIndex = 0

    for (let loop = 0; loop < exercise.loopCount; loop++) {
      for (const event of exercise.events) {
        const timestamp = beatToTimestamp(event, exercise.bpm, exercise.timeSignature, loop, exercise.measures, exercise.swing)
        const surface = event.surface || surfaceNames[0]
        result.push({
          eventIndex,
          normalizedTime: duration > 0 ? timestamp / duration : 0,
          surface,
          hand: event.hand,
          accent: event.accent,
          technique: event.technique,
        })
        eventIndex++
      }
    }
    return result.sort((a, b) => a.normalizedTime - b.normalizedTime)
  }, [exercise, mapping, duration])

  // Result lookup
  const resultMap = useMemo(() => {
    const map = new Map<number, EventResult>()
    for (const r of eventResults) map.set(r.eventIndex, r)
    return map
  }, [eventResults])

  // Board dimensions
  const boardHeight = size.width < 640 ? BOARD_HEIGHT_MOBILE : BOARD_HEIGHT
  const hitLineY = boardHeight * HIT_LINE_RATIO
  const lookAheadFraction = duration > 0 ? LOOK_AHEAD_SEC / duration : 0.3
  const virtualHeight = lookAheadFraction > 0 ? hitLineY / lookAheadFraction : boardHeight * 3
  const noteGroupOffset = hitLineY + playheadProgress * virtualHeight
  const lookBehindFraction = duration > 0 ? LOOK_BEHIND_SEC / duration : 0.05
  const visibleMin = playheadProgress - lookBehindFraction
  const visibleMax = playheadProgress + lookAheadFraction * 1.2

  const laneCount = surfaces.length
  const laneWidth = laneCount > 0 ? size.width / laneCount : size.width

  const getLaneX = useCallback((surface: string) => {
    const idx = surfaces.findIndex(([, s]) => s === surface)
    if (idx === -1) return size.width / 2
    return (idx + 0.5) * laneWidth
  }, [surfaces, laneWidth, size.width])

  // Receiver sizes — congas are bigger
  const isConga = instrument === 'conga'
  const receiverRadius = isConga
    ? (size.width < 500 ? 36 : 48)
    : (size.width < 500 ? 28 : 36)
  const noteRadius = size.width < 500 ? 16 : 20

  // Measure lines
  const measureLines = useMemo(() => {
    if (!exercise) return []
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

  // Grade coloring via DOM
  useEffect(() => {
    if (!svgRef.current) return
    if (eventResults.length === 0) {
      svgRef.current.querySelectorAll('[data-graded]').forEach(el => {
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
  }, [eventResults])

  // Proximity glow for receivers
  const proximityPerSurface = useMemo(() => {
    const proximityFraction = duration > 0 ? 0.5 / duration : 0.05
    const closest = new Map<string, number>()
    for (const note of notes) {
      const dist = note.normalizedTime - playheadProgress
      if (dist < 0 || dist > proximityFraction) continue
      const current = closest.get(note.surface)
      if (current === undefined || dist < current) closest.set(note.surface, dist)
    }
    return closest
  }, [notes, playheadProgress, duration])

  const showBoard = isPlaying && exercise && notes.length > 0

  if (!mapping) return null

  // Colors
  const staffLineColor = isDark ? 'hsl(25, 8%, 25%)' : 'hsl(25, 12%, 72%)'
  const measureLineColor = isDark ? 'hsl(25, 6%, 30%)' : 'hsl(25, 8%, 78%)'

  // ── Test mode (no exercise / not playing) ──
  if (!showBoard) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 h-full">
        <div className={cn(
          'flex items-end justify-center',
          isConga ? 'gap-6 sm:gap-8 md:gap-10' : 'gap-3 sm:gap-4 flex-wrap max-w-[480px]'
        )}>
          {surfaces.map(([piezoIdx, surface]) => {
            const state = surfaceStates[surface]
            const isActive = state?.active || false
            const hitCount = state?.hitCount || 0
            const color = SURFACE_COLORS[surface] || '#22c55e'
            const label = SURFACE_LABELS[surface] || surface
            const testSize = isConga
              ? (surface === 'tumba' ? 'w-28 h-28 sm:w-32 sm:h-32' : surface === 'conga' ? 'w-24 h-24 sm:w-28 sm:h-28' : 'w-20 h-20 sm:w-24 sm:h-24')
              : 'w-20 h-20 sm:w-24 sm:h-24'

            return (
              <div key={surface} className="flex flex-col items-center gap-2">
                <div
                  className={cn('border-[3px] rounded-full flex items-center justify-center transition-all duration-75', testSize)}
                  style={{
                    borderColor: isActive ? color : '#333',
                    backgroundColor: isActive ? `${color}18` : '#1a1a1a',
                    boxShadow: isActive ? `0 0 30px ${color}50, 0 0 60px ${color}30` : 'none',
                    transform: isActive ? 'scale(1.1)' : 'scale(1)',
                  }}
                >
                  <div className="text-center">
                    {showPiezoLabels && (
                      <div className="text-[10px] text-muted-foreground" style={isActive ? { color } : undefined}>
                        Piezo {Number(piezoIdx) + 1}
                      </div>
                    )}
                    <div className="text-sm font-bold text-foreground">{label}</div>
                  </div>
                </div>
                {showHitCounts && (
                  <span className={cn('text-[11px] font-medium', isActive ? 'font-bold' : hitCount > 0 ? 'text-muted-foreground' : 'text-muted-foreground/50')}
                    style={isActive ? { color } : undefined}>
                    {isActive ? 'HIT!' : hitCount > 0 ? `${hitCount} hits` : 'Idle'}
                  </span>
                )}
              </div>
            )
          })}
        </div>
        {showMicLevel && mapping.useMic && (
          <div className="w-full max-w-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Mic</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-75"
                  style={{
                    width: `${Math.min(micLevel * 100, 100)}%`,
                    backgroundColor: micLevel > 0.8 ? '#ef4444' : micLevel > 0.5 ? '#eab308' : '#22c55e',
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Play mode: angled board with falling notes ──
  return (
    <div ref={containerRef} className="relative w-full h-full fretboard-outer shadow-md">
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
              {/* Vertical lane lines */}
              {surfaces.map(([, surface], i) => {
                const x = (i + 0.5) * laneWidth
                return (
                  <line key={`lane-${i}`} x1={x} y1={0} x2={x} y2={boardHeight}
                    stroke={staffLineColor} strokeWidth={1} opacity={0.5} />
                )
              })}

              {/* Measure lines — scrolling with notes */}
              <g transform={`translate(0, ${noteGroupOffset})`} style={{ willChange: 'transform' }}>
                {measureLines.map((t, i) => {
                  const y = -t * virtualHeight
                  return (
                    <line key={`m-${i}`} x1={0} y1={y} x2={size.width} y2={y}
                      stroke={measureLineColor} strokeWidth={1} strokeDasharray="6 4" opacity={0.5} />
                  )
                })}
              </g>

              {/* Hit line */}
              <defs>
                <linearGradient id="congaHitLineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="hsl(30, 85%, 55%)" stopOpacity={0} />
                  <stop offset="15%" stopColor="hsl(30, 85%, 55%)" stopOpacity={1} />
                  <stop offset="85%" stopColor="hsl(14, 52%, 53%)" stopOpacity={1} />
                  <stop offset="100%" stopColor="hsl(14, 52%, 53%)" stopOpacity={0} />
                </linearGradient>
                <filter id="congaHitLineGlow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <rect x={0} y={hitLineY - 2} width={size.width} height={4}
                fill="url(#congaHitLineGrad)" filter="url(#congaHitLineGlow)" />

              {/* Receiver drums at hit line */}
              {surfaces.map(([, surface], i) => {
                const cx = (i + 0.5) * laneWidth
                const cy = hitLineY
                const color = SURFACE_COLORS[surface] || '#22c55e'
                const label = SURFACE_LABELS[surface] || surface
                const isActive = surfaceStates[surface]?.active || false
                const proximityDist = proximityPerSurface.get(surface)
                const proximityFraction = duration > 0 ? 0.5 / duration : 0.05
                const glowOpacity = isActive ? 1
                  : proximityDist !== undefined ? 0.3 + 0.6 * (1 - proximityDist / proximityFraction)
                  : 0.25
                const r = isActive ? receiverRadius * 1.1 : receiverRadius

                return (
                  <g key={`recv-${surface}`}>
                    {/* Outer glow ring */}
                    <circle cx={cx} cy={cy} r={r + 6}
                      fill="none" stroke={color} strokeWidth={isActive ? 3 : 2}
                      opacity={glowOpacity}
                      style={{ transition: 'opacity 0.1s, r 0.08s' }} />
                    {/* Hit flash ring */}
                    {isActive && (
                      <circle cx={cx} cy={cy} r={r + 16}
                        fill="none" stroke={color} strokeWidth={2} opacity={0.4}>
                        <animate attributeName="r" from={`${r + 6}`} to={`${r + 40}`} dur="0.4s" fill="freeze" />
                        <animate attributeName="opacity" from="0.6" to="0" dur="0.4s" fill="freeze" />
                      </circle>
                    )}
                    {/* Inner ring for drum feel */}
                    <circle cx={cx} cy={cy} r={r * 0.7}
                      fill="none"
                      stroke={isActive ? color : (isDark ? 'hsl(20, 8%, 25%)' : 'hsl(35, 15%, 80%)')}
                      strokeWidth={1} opacity={isActive ? 0.5 : 0.4} />
                    {/* Drum body */}
                    <circle cx={cx} cy={cy} r={r}
                      fill={isActive ? `${color}20` : (isDark ? 'hsl(20, 8%, 14%)' : 'hsl(35, 25%, 90%)')}
                      stroke={color} strokeWidth={isActive ? 3 : 2}
                      opacity={isActive ? 1 : 0.8}
                      style={{ transition: 'all 0.08s' }} />
                    {/* Label */}
                    <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="central"
                      fill={isActive ? color : (isDark ? '#ccc' : '#333')}
                      fontSize={receiverRadius > 40 ? 14 : 12} fontWeight={700}
                      style={{ userSelect: 'none', pointerEvents: 'none' }}>
                      {label}
                    </text>
                  </g>
                )
              })}

              {/* Falling notes */}
              <g transform={`translate(0, ${noteGroupOffset})`} style={{ willChange: 'transform' }}>
                {notes.map(note => {
                  if (note.normalizedTime < visibleMin || note.normalizedTime > visibleMax) return null

                  const cx = getLaneX(note.surface)
                  const cy = -note.normalizedTime * virtualHeight
                  const color = SURFACE_COLORS[note.surface] || '#22c55e'
                  const r = note.accent ? noteRadius * 1.35 : noteRadius
                  const result = resultMap.get(note.eventIndex)
                  const gradeColor = result ? GRADE_COLORS[result.grade] : undefined

                  return (
                    <g key={note.eventIndex} data-event-index={note.eventIndex}>
                      <circle cx={cx} cy={cy} r={r}
                        fill={gradeColor || `${color}30`}
                        stroke={gradeColor || color}
                        strokeWidth={note.accent ? 3 : 2}
                        className={note.hand === 'R' ? 'fretboard-note-R' : 'fretboard-note-L'}
                      />
                      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="central"
                        fill={gradeColor || color} fontSize={11} fontWeight={700}
                        style={{ userSelect: 'none', pointerEvents: 'none' }}>
                        {note.hand}
                      </text>
                      {note.accent && (
                        <text x={cx} y={cy - r - 5} textAnchor="middle"
                          fill={gradeColor || color} fontSize={14} fontWeight={700}>
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
      {/* Top fade */}
      <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none rounded-t-[1rem]"
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
