'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { usePlaysense } from '@/contexts/playsense-context'
import { getPlaySenseMapping } from '@/lib/play-sense/playsense-mappings'
import type { Instrument, ExerciseDefinition, EventResult } from '@/lib/play-sense/types'
import { beatToTimestamp } from '@/lib/play-sense/exercise-utils'

interface CongaViewProps {
  instrument: Instrument
  isPlaying?: boolean
  showPiezoLabels?: boolean
  showHitCounts?: boolean
  showMicLevel?: boolean
  /** Exercise definition for falling notes */
  exercise?: ExerciseDefinition | null
  /** Current playhead progress 0-1 */
  playheadProgress?: number
  /** Event results for grading display */
  eventResults?: EventResult[]
}

interface SurfaceHitState {
  active: boolean
  value: number
  hitCount: number
  flashKey: number
}

const DRUM_SURFACES = new Set(['quinto', 'conga', 'tumba', 'macho', 'hembra'])

const SURFACE_LABELS: Record<string, string> = {
  quinto: 'Quinto',
  conga: 'Conga',
  tumba: 'Tumba',
  macho: 'Macho',
  hembra: 'Hembra',
  campana: 'Campana',
  cencerro: 'Cencerro',
  jamblock: 'Jam Block',
  cascara: 'Cáscara',
}

const SURFACE_COLORS: Record<string, { ring: string; glow: string; bg: string }> = {
  quinto: { ring: '#f59e0b', glow: 'rgba(245, 158, 11, 0.35)', bg: 'rgba(245, 158, 11, 0.1)' },
  conga:  { ring: '#ef4444', glow: 'rgba(239, 68, 68, 0.35)', bg: 'rgba(239, 68, 68, 0.1)' },
  tumba:  { ring: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.35)', bg: 'rgba(139, 92, 246, 0.1)' },
  macho:  { ring: '#f59e0b', glow: 'rgba(245, 158, 11, 0.35)', bg: 'rgba(245, 158, 11, 0.1)' },
  hembra: { ring: '#ef4444', glow: 'rgba(239, 68, 68, 0.35)', bg: 'rgba(239, 68, 68, 0.1)' },
  campana:  { ring: '#eab308', glow: 'rgba(234, 179, 8, 0.35)', bg: 'rgba(234, 179, 8, 0.1)' },
  cencerro: { ring: '#22c55e', glow: 'rgba(34, 197, 94, 0.35)', bg: 'rgba(34, 197, 94, 0.1)' },
  jamblock: { ring: '#06b6d4', glow: 'rgba(6, 182, 212, 0.35)', bg: 'rgba(6, 182, 212, 0.1)' },
  cascara:  { ring: '#a855f7', glow: 'rgba(168, 85, 247, 0.35)', bg: 'rgba(168, 85, 247, 0.1)' },
}

const DEFAULT_COLORS = { ring: '#22c55e', glow: 'rgba(34, 197, 94, 0.35)', bg: 'rgba(34, 197, 94, 0.1)' }

/** How many seconds of upcoming notes to show in the lane */
const LOOKAHEAD_SECONDS = 3

interface NoteWithTiming {
  eventIndex: number
  surface: string
  timestamp: number
  technique: string
  hand: string
  accent: boolean
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
  const playsense = usePlaysense()
  const mapping = getPlaySenseMapping(instrument)

  const [surfaceStates, setSurfaceStates] = useState<Record<string, SurfaceHitState>>({})
  const [micLevel, setMicLevel] = useState(0)
  const timeoutRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const lastReadingRef = useRef<number>(0)
  const flashCounterRef = useRef(0)

  // Pre-compute all note timestamps with their surface assignments
  const allNotes = useMemo((): NoteWithTiming[] => {
    if (!exercise || !mapping) return []
    const notes: NoteWithTiming[] = []
    const surfaceNames = Object.values(mapping.piezoMap)
    let eventIndex = 0

    for (let loop = 0; loop < exercise.loopCount; loop++) {
      for (const event of exercise.events) {
        const timestamp = beatToTimestamp(
          event,
          exercise.bpm,
          exercise.timeSignature,
          loop,
          exercise.measures,
          exercise.swing
        )
        // Use the event's surface field if set, otherwise assign based on instrument default
        // For exercises without surface data, assign to the first surface (generic hit)
        const surface = event.surface || surfaceNames[0]
        if (surface) {
          notes.push({
            eventIndex,
            surface,
            timestamp,
            technique: event.technique,
            hand: event.hand,
            accent: event.accent,
          })
        }
        eventIndex++
      }
    }
    return notes.sort((a, b) => a.timestamp - b.timestamp)
  }, [exercise, mapping])

  // Compute total exercise duration
  const totalDuration = useMemo(() => {
    if (!exercise) return 0
    const beatsPerMeasure = exercise.timeSignature[0]
    return (exercise.measures * beatsPerMeasure * exercise.loopCount * 60) / exercise.bpm
  }, [exercise])

  // Initialize surface states
  useEffect(() => {
    if (!mapping) return
    const initial: Record<string, SurfaceHitState> = {}
    for (const surface of Object.values(mapping.piezoMap)) {
      initial[surface] = { active: false, value: 0, hitCount: 0, flashKey: 0 }
    }
    setSurfaceStates(initial)
  }, [mapping])

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
        [surface]: {
          active: true,
          value: val,
          hitCount: (prev[surface]?.hitCount || 0) + 1,
          flashKey,
        },
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

  if (!mapping) return null

  const surfaces = Object.entries(mapping.piezoMap)
  const isConga = instrument === 'conga'
  const currentTime = playheadProgress * totalDuration

  // Build set of graded event indices for note coloring
  const gradedEvents = useMemo(() => {
    const map = new Map<number, string>()
    for (const r of eventResults) {
      map.set(r.eventIndex, r.grade)
    }
    return map
  }, [eventResults])

  // Show falling notes during play
  const showLanes = isPlaying && exercise && allNotes.length > 0

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Falling note lanes — only during play */}
      {showLanes && (
        <div className="flex-1 min-h-0 relative">
          {/* Lane columns — one per surface */}
          <div className={cn(
            'flex h-full',
            isConga ? 'justify-center gap-6 sm:gap-8 md:gap-10 px-4' : 'justify-center gap-3 sm:gap-4 px-2'
          )}>
            {surfaces.map(([, surface]) => {
              const colors = SURFACE_COLORS[surface] || DEFAULT_COLORS

              // Get notes for this surface within the visible window
              const visibleNotes = allNotes.filter(n => {
                if (n.surface !== surface) return false
                const timeUntilHit = n.timestamp - currentTime
                // Show notes from slightly past (just hit) to lookahead
                return timeUntilHit > -0.3 && timeUntilHit < LOOKAHEAD_SECONDS
              })

              // Lane width matches drum size
              const laneWidth = isConga
                ? (surface === 'tumba' ? 'w-36 sm:w-40 md:w-44' : surface === 'conga' ? 'w-32 sm:w-36 md:w-40' : 'w-28 sm:w-32 md:w-36')
                : 'w-24 sm:w-28'

              return (
                <div key={surface} className={cn('relative h-full', laneWidth)}>
                  {/* Lane guide line */}
                  <div
                    className="absolute inset-x-1/2 top-0 bottom-0 w-px opacity-10"
                    style={{ backgroundColor: colors.ring }}
                  />

                  {/* Falling notes */}
                  {visibleNotes.map(note => {
                    const timeUntilHit = note.timestamp - currentTime
                    // Position: 0% = hit line (bottom), 100% = top of lane
                    const pct = Math.max(0, (timeUntilHit / LOOKAHEAD_SECONDS) * 100)
                    const grade = gradedEvents.get(note.eventIndex)
                    const isHit = grade && grade !== 'miss'
                    const isMiss = grade === 'miss'
                    const isPast = timeUntilHit < 0

                    return (
                      <div
                        key={note.eventIndex}
                        className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
                        style={{
                          bottom: `${pct}%`,
                          transition: 'bottom 0.05s linear',
                        }}
                      >
                        <div
                          className={cn(
                            'rounded-full flex items-center justify-center font-bold text-xs',
                            note.accent ? 'w-10 h-10 sm:w-12 sm:h-12' : 'w-8 h-8 sm:w-10 sm:h-10',
                            isPast && !isHit && !isMiss && 'opacity-30',
                          )}
                          style={{
                            backgroundColor: isHit
                              ? `${colors.ring}30`
                              : isMiss
                                ? 'rgba(239, 68, 68, 0.2)'
                                : `${colors.ring}20`,
                            border: `2px solid ${isHit ? colors.ring : isMiss ? '#ef4444' : colors.ring}`,
                            boxShadow: (isHit || (!isPast && !isMiss))
                              ? `0 0 12px ${colors.glow}`
                              : 'none',
                            opacity: isPast && !isHit ? 0.2 : 1,
                          }}
                        >
                          <span style={{ color: isMiss ? '#ef4444' : colors.ring, fontSize: '10px' }}>
                            {note.hand}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>

          {/* Hit line at bottom of lanes */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-foreground/20" />

          {/* Fade gradient at top */}
          <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-background to-transparent pointer-events-none z-10" />
        </div>
      )}

      {/* Drums at bottom */}
      <div className={cn(
        'shrink-0 flex items-center justify-center py-4',
        showLanes ? '' : 'flex-1',
        isConga ? 'gap-6 sm:gap-8 md:gap-10' : 'gap-3 sm:gap-4 flex-wrap max-w-[480px] mx-auto'
      )}>
        {surfaces.map(([piezoIdx, surface]) => {
          const state = surfaceStates[surface]
          const isActive = state?.active || false
          const hitCount = state?.hitCount || 0
          const isDrum = DRUM_SURFACES.has(surface)
          const colors = SURFACE_COLORS[surface] || DEFAULT_COLORS
          const label = SURFACE_LABELS[surface] || surface

          let sizeClass: string
          if (isConga) {
            if (surface === 'tumba') sizeClass = isPlaying ? 'w-36 h-36 sm:w-40 sm:h-40 md:w-44 md:h-44' : 'w-28 h-28 sm:w-32 sm:h-32'
            else if (surface === 'conga') sizeClass = isPlaying ? 'w-32 h-32 sm:w-36 sm:h-36 md:w-40 md:h-40' : 'w-24 h-24 sm:w-28 sm:h-28'
            else sizeClass = isPlaying ? 'w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36' : 'w-20 h-20 sm:w-24 sm:h-24'
          } else {
            sizeClass = isPlaying ? 'w-24 h-24 sm:w-28 sm:h-28' : 'w-20 h-20 sm:w-24 sm:h-24'
          }

          return (
            <div key={surface} className="flex flex-col items-center gap-2 relative">
              {/* Expanding ring on hit */}
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    key={state?.flashKey}
                    initial={{ scale: 0.8, opacity: 0.8 }}
                    animate={{ scale: 1.8, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className={cn(
                      'absolute top-0 pointer-events-none',
                      isDrum ? 'rounded-full' : 'rounded-xl',
                      sizeClass
                    )}
                    style={{ border: `2px solid ${colors.ring}` }}
                  />
                )}
              </AnimatePresence>

              {/* Drum body */}
              <motion.div
                animate={isActive ? {
                  scale: 1.1,
                  borderColor: colors.ring,
                  backgroundColor: colors.bg,
                  boxShadow: `0 0 30px ${colors.glow}, 0 0 60px ${colors.glow}`,
                } : {
                  scale: 1,
                  borderColor: '#333',
                  backgroundColor: '#1a1a1a',
                  boxShadow: '0 0 0px rgba(0, 0, 0, 0)',
                }}
                transition={{ duration: isActive ? 0.06 : 0.2 }}
                className={cn(
                  'border-[3px] flex items-center justify-center relative overflow-hidden',
                  isDrum ? 'rounded-full' : 'rounded-xl',
                  sizeClass
                )}
              >
                {isDrum && (
                  <div
                    className="absolute inset-[12%] rounded-full border pointer-events-none"
                    style={{ borderColor: isActive ? `${colors.ring}40` : '#2a2a2a' }}
                  />
                )}
                <div className="text-center z-10">
                  {showPiezoLabels && (
                    <div className={cn(
                      'text-[10px]',
                      isActive ? 'opacity-80' : 'text-muted-foreground'
                    )} style={isActive ? { color: colors.ring } : undefined}>
                      Piezo {Number(piezoIdx) + 1}
                    </div>
                  )}
                  <div className={cn(
                    'font-bold text-foreground',
                    isPlaying ? 'text-base sm:text-lg' : 'text-sm'
                  )}>
                    {label}
                  </div>
                </div>
              </motion.div>

              {showHitCounts && (
                <span className={cn(
                  'text-[11px] font-medium',
                  isActive ? 'font-bold' : hitCount > 0 ? 'text-muted-foreground' : 'text-muted-foreground/50'
                )} style={isActive ? { color: colors.ring } : undefined}>
                  {isActive ? 'HIT!' : hitCount > 0 ? `${hitCount} hits` : 'Idle'}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Mic level bar */}
      {showMicLevel && mapping.useMic && (
        <div className="shrink-0 w-full max-w-xs mx-auto pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Mic</span>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-75"
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
