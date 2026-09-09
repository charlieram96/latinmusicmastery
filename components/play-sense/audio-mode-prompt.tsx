'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Headphones, Speaker, AlertTriangle, Bluetooth, Piano } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AudioMode } from '@/hooks/use-exercise-session'
import type { Instrument } from '@/lib/play-sense/types'
import { getInstrumentCategory } from '@/lib/play-sense/types'
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
      if (playsense.isConnected()) onSelect('playsense')
      else setBleError('No PlaySense device connected. Choose your device and try again.')
    } catch {
      setBleError('Could not connect to PlaySense device.')
    } finally {
      setBleConnecting(false)
    }
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
  }
  const itemVariants = {
    hidden: { opacity: 0, y: 14 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 320, damping: 24 } },
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="rounded-2xl bg-card/95 backdrop-blur-xl border border-border shadow-2xl shadow-black/40 p-6 sm:p-8 flex flex-col gap-6"
    >
      <motion.div variants={itemVariants} className="text-center space-y-2">
        <h3 className="text-lg font-bold text-foreground">Choose your input</h3>
        <p className="text-sm text-muted-foreground">
          Connect your instrument or use your microphone.
        </p>
      </motion.div>

      <motion.div variants={itemVariants} className="grid gap-3 sm:grid-cols-2">
        {instrument && getInstrumentCategory(instrument) === 'pitched' && <ModeCard
          icon={<Piano className="w-7 h-7" />}
          label="MIDI instrument"
          hint="Exact notes · no microphone"
          onClick={() => onSelect('midi')}
          accent="hover:border-emerald-400/60 hover:bg-emerald-500/5"
        />}
        <ModeCard
          icon={<Headphones className="w-7 h-7" />}
          label="Microphone + headphones"
          hint="Best accuracy"
          onClick={() => onSelect('headphones')}
          accent="hover:border-primary hover:bg-primary/5"
        />

        <ModeCard
          icon={<Speaker className="w-7 h-7" />}
          label="Microphone + speakers"
          hint="Reduced accuracy"
          onClick={() => {
            if (!showWarning) {
              setShowWarning(true)
            } else {
              onSelect('speaker-safe')
            }
          }}
          accent="hover:border-yellow-500/50 hover:bg-yellow-500/5"
        />

        {showPlaysense && (
          <ModeCard
            icon={
              <div className="relative">
                <Bluetooth className={cn(
                  'w-7 h-7',
                  playsense.connectionStatus === 'connected' ? 'text-blue-400' : '',
                )} />
                {bleConnecting && (
                  <motion.span
                    initial={{ scale: 0.5, opacity: 0.6 }}
                    animate={{ scale: 1.7, opacity: 0 }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
                    className="absolute inset-0 rounded-full border-2 border-blue-400"
                  />
                )}
              </div>
            }
            label={bleConnecting ? 'Connecting…' : 'PlaySense'}
            hint={
              !playsense.isSupported
                ? 'Chrome / Edge'
                : playsense.connectionStatus === 'connected'
                  ? 'Connected'
                  : 'Direct sensor'
            }
            onClick={handlePlaysenseSelect}
            disabled={bleConnecting || !playsense.isSupported}
            accent="hover:border-blue-400/60 hover:bg-blue-500/5"
          />
        )}
      </motion.div>

      <AnimatePresence>
        {showWarning && (
          <motion.div
            key="speaker-warn"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                <div className="space-y-1.5 text-left">
                  <p className="text-xs text-muted-foreground">
                    Speaker mode reduces backing-track volume and raises detection thresholds to fight mic bleed. Results may be less accurate.
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bleError && (
          <motion.div
            key="ble-err"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">{bleError}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

interface ModeCardProps {
  icon: React.ReactNode
  label: string
  hint: string
  onClick: () => void
  disabled?: boolean
  accent: string
}

function ModeCard({ icon, label, hint, onClick, disabled, accent }: ModeCardProps) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-auto py-5 px-3 flex flex-col items-center gap-2 border-border bg-background/60 transition-colors',
        accent,
      )}
    >
      <div className="text-foreground">{icon}</div>
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <span className="text-[11px] text-muted-foreground">{hint}</span>
    </Button>
  )
}
