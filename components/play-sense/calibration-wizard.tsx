'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CalibrationData } from '@/lib/play-sense/types'
import { scaleIn, standardTransition } from '@/lib/play-sense/animations'
import { Mic, RotateCcw, Check, AlertTriangle, Bluetooth } from 'lucide-react'
import type { AudioMode } from '@/hooks/use-exercise-session'

interface CalibrationWizardProps {
  isCalibrating: boolean
  calibrationData: CalibrationData | null
  calibrationBeat: number
  totalCalibrationBeats: number
  calibrationError: string | null
  onStartCalibration: () => void
  onSkip: () => void
  onClearCalibration: () => void
  audioMode?: AudioMode | null
}

export function CalibrationWizard({
  isCalibrating,
  calibrationData,
  calibrationBeat,
  totalCalibrationBeats,
  calibrationError,
  onStartCalibration,
  onSkip,
  onClearCalibration,
  audioMode,
}: CalibrationWizardProps) {
  const progress = totalCalibrationBeats > 0
    ? (calibrationBeat / totalCalibrationBeats) * 100
    : 0

  const isApproximate = calibrationData && calibrationData.iqrMs > 30
  const isBle = audioMode === 'playsense'

  return (
    <div className="max-w-lg mx-auto bg-card rounded-2xl border border-border p-6 md:p-8">
      <div className="text-center space-y-5">
        {/* Source chip */}
        <div className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border mx-auto',
          isBle
            ? 'border-blue-500/40 bg-blue-500/10 text-blue-400'
            : 'border-primary/40 bg-primary/10 text-primary',
        )}>
          {isBle ? <Bluetooth className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
          {isBle ? 'Calibrating: PlaySense' : 'Calibrating: Microphone'}
        </div>

        {/* Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className={cn(
            'w-14 h-14 rounded-full border flex items-center justify-center mx-auto',
            isBle ? 'bg-blue-500/10 border-blue-500/30' : 'bg-primary/10 border-primary/20',
          )}
        >
          {isBle
            ? <Bluetooth className="w-6 h-6 text-blue-400" />
            : <Mic className="w-6 h-6 text-primary" />}
        </motion.div>

        <div>
          <h3 className="text-lg font-semibold text-foreground">Audio Calibration</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {isBle
              ? 'Calibrate your PlaySense device latency. Tap a pad along to the metronome clicks.'
              : 'Calibrate your mic latency for accurate scoring. Tap along to the metronome clicks.'}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {isCalibrating ? (
            <motion.div
              key="calibrating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <p className="text-sm font-medium text-foreground dark:text-slate-300">
                {calibrationBeat === 0
                  ? 'Count-in... get ready to tap!'
                  : `Tap along! ${calibrationBeat} / ${totalCalibrationBeats}`}
              </p>

              {/* Progress bar */}
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-[hsl(14,52%,53%)]"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Beat pulse ring */}
              <div className="flex justify-center relative h-20">
                <div className="relative">
                  {/* Static center dot */}
                  <div className="w-10 h-10 rounded-full bg-primary/30 flex items-center justify-center absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="w-5 h-5 rounded-full bg-primary" />
                  </div>

                  {/* Expanding ring on each beat */}
                  <AnimatePresence>
                    {calibrationBeat > 0 && (
                      <motion.div
                        key={calibrationBeat}
                        initial={{ scale: 0.5, opacity: 0.8 }}
                        animate={{ scale: 3, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="w-10 h-10 rounded-full border-2 border-primary/60 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                      />
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Progress dots */}
              <div className="flex justify-center gap-1.5 flex-wrap max-w-xs mx-auto">
                {Array.from({ length: totalCalibrationBeats }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0 }}
                    animate={{
                      scale: 1,
                      backgroundColor: i < calibrationBeat ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                    }}
                    transition={{ delay: i * 0.02 }}
                    className="w-2.5 h-2.5 rounded-full"
                  />
                ))}
              </div>
            </motion.div>
          ) : calibrationData ? (
            <motion.div
              key="calibrated"
              variants={scaleIn}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={standardTransition}
              className="space-y-4"
            >
              {/* Success animation */}
              <div className="relative flex items-center justify-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="w-14 h-14 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center"
                >
                  <Check className="w-7 h-7 text-green-400" />
                </motion.div>
                {/* Expanding ring */}
                <motion.div
                  initial={{ scale: 0.5, opacity: 0.6 }}
                  animate={{ scale: 2.5, opacity: 0 }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="absolute w-14 h-14 rounded-full border-2 border-green-400"
                />
              </div>

              <p className="font-medium text-green-400">Calibrated</p>

              <div className="text-sm text-muted-foreground space-y-1">
                <p>Latency: <span className="font-mono text-foreground dark:text-slate-300">{calibrationData.latencyMs.toFixed(1)}ms</span></p>
                <p>Consistency: <span className="font-mono text-foreground dark:text-slate-300">{calibrationData.iqrMs.toFixed(1)}ms IQR</span></p>
              </div>

              {isApproximate && (
                <div className="flex items-center gap-2 text-xs text-yellow-400 justify-center">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Calibration approximate — tolerance windows widened</span>
                </div>
              )}

              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClearCalibration}
                  className="border-border text-foreground dark:text-slate-300 hover:bg-secondary"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Recalibrate
                </Button>
                <Button
                  size="sm"
                  onClick={onSkip}
                  className="bg-gradient-to-r from-primary to-[hsl(14,52%,48%)] hover:from-primary/90 hover:to-[hsl(14,52%,53%)] text-white border-0"
                >
                  Continue
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="initial"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {calibrationError ? (
                <div className="flex items-start gap-2 text-left p-3 rounded-lg bg-red-100 dark:bg-red-950/30 border border-red-500/20">
                  <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-600 dark:text-red-300">{calibrationError}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Use headphones for best results. The calibration takes about 15 seconds.
                </p>
              )}
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSkip}
                  className="border-border text-foreground dark:text-slate-300 hover:bg-secondary"
                >
                  Skip
                </Button>
                <Button
                  size="sm"
                  onClick={onStartCalibration}
                  className="bg-gradient-to-r from-primary to-[hsl(14,52%,48%)] hover:from-primary/90 hover:to-[hsl(14,52%,53%)] text-white border-0"
                >
                  {calibrationError ? 'Try Again' : 'Start Calibration'}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
