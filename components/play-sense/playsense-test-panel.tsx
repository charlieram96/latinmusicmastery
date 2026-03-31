'use client'

import { useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Bluetooth, ArrowLeft } from 'lucide-react'
import { usePlaysense } from '@/contexts/playsense-context'
import { getPlaySenseMapping } from '@/lib/play-sense/playsense-mappings'
import type { Instrument } from '@/lib/play-sense/types'
import { CongaView } from './conga-view'

interface PlaysenseTestPanelProps {
  instrument: Instrument
  onReady: () => void
  onBack: () => void
}

export function PlaysenseTestPanel({ instrument, onReady, onBack }: PlaysenseTestPanelProps) {
  const playsense = usePlaysense()
  const mapping = getPlaySenseMapping(instrument)

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

      {/* Drum visualization with test mode features */}
      <CongaView
        instrument={instrument}
        isPlaying={false}
        showPiezoLabels
        showHitCounts
        showMicLevel
      />

      {/* Ready button */}
      <div className="text-center">
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
