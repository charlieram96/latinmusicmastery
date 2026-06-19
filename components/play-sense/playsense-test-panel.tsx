'use client'

import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Bluetooth, ArrowLeft, Mic, CheckCircle2 } from 'lucide-react'
import { usePlaysense } from '@/contexts/playsense-context'
import { getPlaySenseMapping } from '@/lib/play-sense/playsense-mappings'
import type { Instrument } from '@/lib/play-sense/types'

interface PlaysenseTestPanelProps {
  instrument: Instrument
  onReady: () => void
  onBack: () => void
}

const SURFACE_LABELS: Record<string, string> = {
  quinto: 'Quinto', conga: 'Conga', tumba: 'Tumba',
  macho: 'Macho', hembra: 'Hembra', campana: 'Campana',
  cencerro: 'Cencerro', jamblock: 'Jam Block', cascara: 'Cáscara',
}

// Neon hex colors that visually match the PixiJS LANE_COLORS palette
const SURFACE_NEON: Record<string, string> = {
  quinto: '#ff1744',
  conga: '#2979ff',
  tumba: '#00e676',
  macho: '#ff1744',
  hembra: '#2979ff',
  campana: '#ffea00',
  cencerro: '#ff9100',
  jamblock: '#d500f9',
  cascara: '#00e5ff',
}

interface PiezoState {
  active: boolean
  hitCount: number
  flashKey: number
}

export function PlaysenseTestPanel({ instrument, onReady, onBack }: PlaysenseTestPanelProps) {
  const playsense = usePlaysense()
  const mapping = getPlaySenseMapping(instrument)

  const hasStartedRef = useRef(false)
  const startConnection = useCallback(async () => {
    if (hasStartedRef.current) return
    hasStartedRef.current = true
    if (playsense.connectionStatus !== 'connected') {
      await playsense.connect()
    }
  }, [playsense])

  useEffect(() => {
    startConnection()
  }, [startConnection])

  const surfaces = useMemo(() => {
    if (!mapping) return [] as Array<[string, string]>
    return Object.entries(mapping.piezoMap)
  }, [mapping])

  const [states, setStates] = useState<Record<string, PiezoState>>({})
  const [micLevel, setMicLevel] = useState(0)
  const lastReadingAtRef = useRef(0)
  const timeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const flashCounterRef = useRef(0)

  // Initialize per-surface state when mapping changes
  useEffect(() => {
    if (!mapping) return
    const initial: Record<string, PiezoState> = {}
    for (const surface of Object.values(mapping.piezoMap)) {
      initial[surface] = { active: false, hitCount: 0, flashKey: 0 }
    }
    setStates(initial)
    flashCounterRef.current = 0
  }, [mapping])

  // Process BLE readings — flash matching piezo and bump counters
  useEffect(() => {
    if (!playsense.lastReading || !mapping) return
    const reading = playsense.lastReading
    if (reading.receivedAt <= lastReadingAtRef.current) return
    lastReadingAtRef.current = reading.receivedAt

    setMicLevel(Math.min((reading.mic || 0) / 4095, 1))

    for (let i = 0; i < reading.piezos.length; i++) {
      const val = reading.piezos[i]
      const surface = mapping.piezoMap[i]
      if (surface === undefined || val <= 0) continue

      const flashKey = ++flashCounterRef.current
      setStates(prev => ({
        ...prev,
        [surface]: {
          active: true,
          hitCount: (prev[surface]?.hitCount || 0) + 1,
          flashKey,
        },
      }))
      if (timeoutsRef.current[surface]) clearTimeout(timeoutsRef.current[surface])
      timeoutsRef.current[surface] = setTimeout(() => {
        setStates(prev => ({
          ...prev,
          [surface]: { ...prev[surface], active: false },
        }))
      }, 220)
    }
  }, [playsense.lastReading, mapping])

  useEffect(() => {
    return () => {
      for (const t of Object.values(timeoutsRef.current)) clearTimeout(t)
    }
  }, [])

  if (!mapping) return null

  const allHit = surfaces.length > 0 && surfaces.every(([, s]) => (states[s]?.hitCount ?? 0) > 0)
  const isConga = instrument === 'conga'
  const connected = playsense.connectionStatus === 'connected'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 240, damping: 24 }}
      className="rounded-2xl bg-card/95 backdrop-blur-xl border border-border shadow-2xl shadow-black/40 p-6 flex flex-col gap-5"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground hover:text-foreground -ml-2">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Bluetooth className={cn(
            'w-4 h-4 transition-colors',
            connected ? 'text-blue-400' : 'text-muted-foreground',
          )} />
          <span className={cn(
            'text-xs',
            connected ? 'text-blue-400' : 'text-muted-foreground',
          )}>
            {connected ? 'Connected' : 'Connecting…'}
          </span>
        </div>
      </div>

      <div className="text-center space-y-1">
        <h3 className="text-lg font-bold text-foreground">Test Your Setup</h3>
        <p className="text-sm text-muted-foreground">
          Hit each {isConga ? 'drum' : 'surface'} once to confirm your sensors are working.
        </p>
      </div>

      {/* Neon piezo grid — matches canvas aesthetic without a second WebGL context */}
      <div className={cn(
        'flex flex-wrap items-end justify-center gap-4',
        isConga ? 'sm:gap-8' : ''
      )}>
        {surfaces.map(([piezoIdx, surface]) => {
          const state = states[surface]
          const isActive = state?.active ?? false
          const hitCount = state?.hitCount ?? 0
          const everHit = hitCount > 0
          const color = SURFACE_NEON[surface] ?? '#2979ff'
          const label = SURFACE_LABELS[surface] ?? surface
          const sizeClass = isConga
            ? (surface === 'tumba' ? 'w-24 h-24 sm:w-28 sm:h-28' : surface === 'conga' ? 'w-20 h-20 sm:w-24 sm:h-24' : 'w-[72px] h-[72px] sm:w-20 sm:h-20')
            : 'w-[68px] h-[68px] sm:w-20 sm:h-20'

          return (
            <div key={surface} className="flex flex-col items-center gap-2">
              <motion.div
                animate={{
                  scale: isActive ? 1.12 : 1,
                  boxShadow: isActive
                    ? `0 0 30px ${color}aa, 0 0 70px ${color}44, inset 0 0 18px ${color}55`
                    : `0 0 0px ${color}00`,
                }}
                transition={{ type: 'spring', stiffness: 600, damping: 20 }}
                className={cn(
                  'relative rounded-full flex items-center justify-center border-2',
                  sizeClass,
                )}
                style={{
                  borderColor: isActive ? color : everHit ? `${color}77` : 'hsl(var(--border))',
                  backgroundColor: isActive ? `${color}1a` : 'hsl(var(--secondary))',
                }}
              >
                <div className="text-center">
                  <div className="text-[10px] tracking-wide" style={{ color: isActive ? color : 'hsl(var(--muted-foreground))' }}>
                    Piezo {Number(piezoIdx) + 1}
                  </div>
                  <div className={cn(
                    'text-sm font-bold',
                    isActive ? 'text-white' : 'text-foreground',
                  )}>
                    {label}
                  </div>
                </div>
                {everHit && !isActive && (
                  <CheckCircle2 className="absolute -top-1 -right-1 w-4 h-4" style={{ color }} />
                )}
              </motion.div>
              <span
                className={cn(
                  'text-[11px] font-medium tabular-nums',
                  isActive ? 'font-bold' : everHit ? 'text-muted-foreground' : 'text-muted-foreground/50',
                )}
                style={isActive ? { color } : undefined}
              >
                {isActive ? 'HIT' : everHit ? `${hitCount} hits` : 'idle'}
              </span>
            </div>
          )
        })}
      </div>

      {/* Mic level (when device exposes it) */}
      {mapping.useMic && (
        <div className="w-full max-w-xs mx-auto flex items-center gap-2">
          <Mic className="w-3.5 h-3.5 text-muted-foreground" />
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-75"
              style={{
                width: `${Math.min(micLevel * 100, 100)}%`,
                backgroundColor:
                  micLevel > 0.8 ? '#ef4444' : micLevel > 0.5 ? '#eab308' : '#22c55e',
              }}
            />
          </div>
        </div>
      )}

      {/* Ready button */}
      <div className="flex flex-col items-center gap-2">
        <Button
          onClick={onReady}
          disabled={!connected}
          className={cn(
            'px-8 transition-all',
            allHit
              ? 'bg-blue-500 hover:bg-blue-400 text-white shadow-[0_0_30px_rgba(41,121,255,0.5)]'
              : 'bg-primary hover:bg-primary/90 text-white',
          )}
        >
          {allHit ? 'Ready — Start Exercise' : 'Skip & Start Exercise'}
        </Button>
        {!allHit && (
          <span className="text-[11px] text-muted-foreground">
            Hit each pad to verify, or skip if you trust your setup.
          </span>
        )}
      </div>
    </motion.div>
  )
}
