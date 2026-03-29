'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { usePlaysense } from '@/contexts/playsense-context'
import { getPlaySenseMapping, type DrumSurface } from '@/lib/play-sense/playsense-mappings'
import type { Instrument } from '@/lib/play-sense/types'

interface CongaViewProps {
  instrument: Instrument
  /** Whether the view is in active playing mode (shows larger drums, hit grade overlay) */
  isPlaying?: boolean
  /** Show piezo labels (for test mode) */
  showPiezoLabels?: boolean
  /** Show hit counts per surface (for test mode) */
  showHitCounts?: boolean
  /** Show mic level bar (for test mode on instruments that use mic) */
  showMicLevel?: boolean
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

/** Colors for each drum - warm tones to match latin music vibe */
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

export function CongaView({
  instrument,
  isPlaying = false,
  showPiezoLabels = false,
  showHitCounts = false,
  showMicLevel = false,
}: CongaViewProps) {
  const playsense = usePlaysense()
  const mapping = getPlaySenseMapping(instrument)

  const [surfaceStates, setSurfaceStates] = useState<Record<string, SurfaceHitState>>({})
  const [micLevel, setMicLevel] = useState(0)
  const timeoutRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const lastReadingRef = useRef<number>(0)
  const flashCounterRef = useRef(0)

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

      if (timeoutRefs.current[surface]) {
        clearTimeout(timeoutRefs.current[surface])
      }
      timeoutRefs.current[surface] = setTimeout(() => {
        setSurfaceStates(prev => ({
          ...prev,
          [surface]: { ...prev[surface], active: false },
        }))
      }, 180)
    }
  }, [playsense.lastReading, mapping])

  // Cleanup
  useEffect(() => {
    return () => {
      for (const timeout of Object.values(timeoutRefs.current)) {
        clearTimeout(timeout)
      }
    }
  }, [])

  if (!mapping) return null

  const surfaces = Object.entries(mapping.piezoMap)
  const isConga = instrument === 'conga'
  const drumSize = isPlaying
    ? (isConga ? 'w-32 h-32 sm:w-36 sm:h-36 md:w-40 md:h-40' : 'w-24 h-24 sm:w-28 sm:h-28')
    : (isConga ? 'w-24 h-24 sm:w-28 sm:h-28' : 'w-20 h-20 sm:w-24 sm:h-24')

  return (
    <div className="flex flex-col items-center justify-center gap-6 h-full">
      {/* Drum surfaces */}
      <div className={cn(
        'flex items-end justify-center',
        isConga ? 'gap-6 sm:gap-8 md:gap-10' : 'gap-3 sm:gap-4 flex-wrap max-w-[480px]'
      )}>
        {surfaces.map(([piezoIdx, surface]) => {
          const state = surfaceStates[surface]
          const isActive = state?.active || false
          const hitCount = state?.hitCount || 0
          const isDrum = DRUM_SURFACES.has(surface)
          const colors = SURFACE_COLORS[surface] || DEFAULT_COLORS
          const label = SURFACE_LABELS[surface] || surface

          // Congas have different sizes: tumba > conga > quinto
          let sizeClass = drumSize
          if (isConga && isPlaying) {
            if (surface === 'tumba') sizeClass = 'w-36 h-36 sm:w-40 sm:h-40 md:w-44 md:h-44'
            else if (surface === 'conga') sizeClass = 'w-32 h-32 sm:w-36 sm:h-36 md:w-40 md:h-40'
            else if (surface === 'quinto') sizeClass = 'w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36'
          } else if (isConga && !isPlaying) {
            if (surface === 'tumba') sizeClass = 'w-28 h-28 sm:w-32 sm:h-32'
            else if (surface === 'conga') sizeClass = 'w-24 h-24 sm:w-28 sm:h-28'
            else if (surface === 'quinto') sizeClass = 'w-20 h-20 sm:w-24 sm:h-24'
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
                {/* Inner ring for drum feel */}
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

              {/* Status text below */}
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
        <div className="w-full max-w-xs">
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
