'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Headphones, Speaker, AlertTriangle, Bluetooth } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AudioMode } from '@/hooks/use-exercise-session'
import type { Instrument } from '@/lib/play-sense/types'
import { PLAYSENSE_INSTRUMENTS } from '@/lib/play-sense/playsense-mappings'
import { usePlaysense } from '@/contexts/playsense-context'

interface AudioModePromptProps {
  onSelect: (mode: AudioMode) => void
  instrument?: Instrument | null
}

export function AudioModePrompt({ onSelect, instrument }: AudioModePromptProps) {
  const [showWarning, setShowWarning] = useState(false)
  const [bleError, setBleError] = useState<string | null>(null)
  const [bleConnecting, setBleConnecting] = useState(false)
  const playsense = usePlaysense()

  const showPlaysense = instrument ? PLAYSENSE_INSTRUMENTS.has(instrument) : false

  const handlePlaysenseSelect = async () => {
    setBleError(null)
    if (playsense.connectionStatus === 'connected') {
      onSelect('playsense')
      return
    }
    setBleConnecting(true)
    try {
      await playsense.connect()
    } catch {
      setBleConnecting(false)
      setBleError('Could not connect to PlaySense device.')
    }
  }

  // When BLE connects successfully, auto-select playsense mode
  useEffect(() => {
    if (bleConnecting && playsense.connectionStatus === 'connected') {
      setBleConnecting(false)
      onSelect('playsense')
    } else if (bleConnecting && playsense.connectionStatus === 'error') {
      setBleConnecting(false)
      setBleError(playsense.error || 'Could not connect to PlaySense device.')
    } else if (bleConnecting && playsense.connectionStatus === 'disconnected') {
      // User likely cancelled the BLE dialog
      setBleConnecting(false)
    }
  }, [playsense.connectionStatus, playsense.error, bleConnecting, onSelect])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center gap-6 p-8 max-w-md mx-auto"
    >
      <div className="text-center space-y-2">
        <h3 className="text-lg font-bold text-foreground">How are you listening?</h3>
        <p className="text-sm text-muted-foreground">
          This helps us optimize detection for your setup.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full">
        <Button
          variant="outline"
          onClick={() => onSelect('headphones')}
          className="flex-1 h-auto py-4 px-4 flex flex-col items-center gap-2 border-border hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <Headphones className="w-8 h-8 text-foreground" />
          <span className="text-sm font-semibold">Headphones</span>
          <span className="text-[11px] text-muted-foreground">Best accuracy</span>
        </Button>

        <Button
          variant="outline"
          onClick={() => {
            if (!showWarning) {
              setShowWarning(true)
            } else {
              onSelect('speaker-safe')
            }
          }}
          className="flex-1 h-auto py-4 px-4 flex flex-col items-center gap-2 border-border hover:border-yellow-500/50 hover:bg-yellow-500/5 transition-colors"
        >
          <Speaker className="w-8 h-8 text-foreground" />
          <span className="text-sm font-semibold">Speakers</span>
          <span className="text-[11px] text-muted-foreground">Reduced accuracy</span>
        </Button>

        {showPlaysense && (
          <Button
            variant="outline"
            onClick={handlePlaysenseSelect}
            disabled={bleConnecting || !playsense.isSupported}
            className="flex-1 h-auto py-4 px-4 flex flex-col items-center gap-2 border-border hover:border-blue-500/50 hover:bg-blue-500/5 transition-colors"
          >
            <Bluetooth className={cn('w-8 h-8', playsense.connectionStatus === 'connected' ? 'text-blue-500' : 'text-foreground')} />
            <span className="text-sm font-semibold">
              {bleConnecting ? 'Connecting...' : 'PlaySense'}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {!playsense.isSupported
                ? 'Chrome/Edge only'
                : playsense.connectionStatus === 'connected'
                  ? 'Connected'
                  : 'Direct sensor'}
            </span>
          </Button>
        )}
      </div>

      {showWarning && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="w-full p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Speaker mode reduces backing track volume and raises detection thresholds to minimize mic bleed. Results may be less accurate.
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onSelect('speaker-safe')}
                className="text-xs h-7 px-2 text-yellow-500 hover:text-yellow-400"
              >
                Continue with speakers
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {bleError && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="w-full p-3 rounded-lg border border-red-500/30 bg-red-500/10"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">{bleError}</p>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
