'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Bluetooth, ArrowLeft } from 'lucide-react'
import { usePlaysense } from '@/contexts/playsense-context'
import { getPlaySenseMapping } from '@/lib/play-sense/playsense-mappings'
import type { Instrument } from '@/lib/play-sense/types'

interface PlaysenseTestPanelProps {
  instrument: Instrument
  onReady: () => void
  onBack: () => void
}

interface SurfaceHitState {
  active: boolean
  value: number
  hitCount: number
}

export function PlaysenseTestPanel({ instrument, onReady, onBack }: PlaysenseTestPanelProps) {
  const playsense = usePlaysense()
  const mapping = getPlaySenseMapping(instrument)

  const [surfaceStates, setSurfaceStates] = useState<Record<string, SurfaceHitState>>({})
  const [micLevel, setMicLevel] = useState(0)
  const timeoutRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const lastReadingRef = useRef<number>(0)

  // Initialize surface states from mapping
  useEffect(() => {
    if (!mapping) return
    const initial: Record<string, SurfaceHitState> = {}
    for (const surface of Object.values(mapping.piezoMap)) {
      initial[surface] = { active: false, value: 0, hitCount: 0 }
    }
    setSurfaceStates(initial)
  }, [mapping])

  // Process BLE readings for hit feedback
  useEffect(() => {
    if (!playsense.lastReading || !mapping) return

    const reading = playsense.lastReading
    if (reading.receivedAt <= lastReadingRef.current) return
    lastReadingRef.current = reading.receivedAt

    // Update mic level
    setMicLevel(Math.min((reading.mic || 0) / 4095, 1))

    // Check each piezo for hits
    for (let i = 0; i < reading.piezos.length; i++) {
      const val = reading.piezos[i]
      const surface = mapping.piezoMap[i]
      if (surface === undefined) continue

      if (val > 0) {
        setSurfaceStates(prev => ({
          ...prev,
          [surface]: { active: true, value: val, hitCount: (prev[surface]?.hitCount || 0) + 1 },
        }))

        // Clear hit after 150ms
        if (timeoutRefs.current[surface]) {
          clearTimeout(timeoutRefs.current[surface])
        }
        timeoutRefs.current[surface] = setTimeout(() => {
          setSurfaceStates(prev => ({
            ...prev,
            [surface]: { ...prev[surface], active: false },
          }))
        }, 150)
      }
    }
  }, [playsense.lastReading, mapping])

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      for (const timeout of Object.values(timeoutRefs.current)) {
        clearTimeout(timeout)
      }
    }
  }, [])

  // Start listening for BLE data when panel mounts
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

  if (!mapping) return null

  const surfaces = Object.entries(mapping.piezoMap)
  const detectedCount = Object.values(surfaceStates).filter(s => s.hitCount > 0).length
  const totalSurfaces = surfaces.length
  const allDetected = detectedCount === totalSurfaces

  // Drums (congas: macho/hembra) get circles, accessories get rounded squares
  const drumSurfaces = new Set(['quinto', 'conga', 'tumba', 'macho', 'hembra'])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center gap-6 p-6 max-w-lg mx-auto"
    >
      {/* Header */}
      <div className="w-full flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Bluetooth className={cn(
            'w-4 h-4',
            playsense.connectionStatus === 'connected' ? 'text-blue-500' : 'text-muted-foreground'
          )} />
          <span className="text-xs text-muted-foreground">
            {playsense.connectionStatus === 'connected' ? 'Connected' : 'Connecting...'}
          </span>
        </div>
      </div>

      <div className="text-center space-y-1">
        <h3 className="text-lg font-bold text-foreground">Test Your Setup</h3>
        <p className="text-sm text-muted-foreground">
          Hit each {instrument === 'conga' ? 'drum' : 'surface'} to verify your sensors are working
        </p>
      </div>

      {/* Surface grid */}
      <div className="flex flex-wrap justify-center gap-4">
        {surfaces.map(([piezoIdx, surface]) => {
          const state = surfaceStates[surface]
          const isActive = state?.active || false
          const hitCount = state?.hitCount || 0
          const isDrum = drumSurfaces.has(surface)

          return (
            <div key={surface} className="flex flex-col items-center gap-2">
              <motion.div
                animate={isActive ? {
                  scale: 1.08,
                  borderColor: '#22c55e',
                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                  boxShadow: '0 0 24px rgba(34, 197, 94, 0.3)',
                } : {
                  scale: 1,
                  borderColor: '#333',
                  backgroundColor: '#1a1a1a',
                  boxShadow: '0 0 0px rgba(0, 0, 0, 0)',
                }}
                transition={{ duration: 0.08 }}
                className={cn(
                  'w-24 h-24 border-[3px] flex items-center justify-center',
                  isDrum ? 'rounded-full' : 'rounded-xl'
                )}
              >
                <div className="text-center">
                  <div className={cn(
                    'text-[10px]',
                    isActive ? 'text-green-400' : 'text-muted-foreground'
                  )}>
                    Piezo {Number(piezoIdx) + 1}
                  </div>
                  <div className="text-sm font-bold text-foreground capitalize">
                    {surface === 'jamblock' ? 'Jam Block' : surface === 'cascara' ? 'Cáscara' : surface.charAt(0).toUpperCase() + surface.slice(1)}
                  </div>
                </div>
              </motion.div>
              <span className={cn(
                'text-[11px] font-medium',
                isActive ? 'text-green-400' : hitCount > 0 ? 'text-muted-foreground' : 'text-muted-foreground/50'
              )}>
                {isActive ? 'HIT!' : hitCount > 0 ? `${hitCount} hits` : 'Idle'}
              </span>
            </div>
          )
        })}
      </div>

      {/* Mic level (shown for instruments that use mic) */}
      {mapping.useMic && (
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

      {/* Status + Ready */}
      <div className="text-center space-y-3">
        <div className={cn(
          'text-xs',
          allDetected ? 'text-green-500' : 'text-muted-foreground'
        )}>
          {allDetected
            ? `All ${totalSurfaces} sensors detected`
            : `${detectedCount} of ${totalSurfaces} sensors detected — hit each to test`}
        </div>
        <Button
          onClick={onReady}
          className="bg-primary hover:bg-primary/90 text-white px-8"
          disabled={playsense.connectionStatus !== 'connected'}
        >
          Ready — Start Exercise
        </Button>
      </div>
    </motion.div>
  )
}
