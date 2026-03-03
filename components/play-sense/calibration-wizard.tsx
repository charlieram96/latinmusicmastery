'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import type { CalibrationData } from '@/lib/play-sense/types'
import { scaleIn, standardTransition } from '@/lib/play-sense/animations'
import { Mic, RotateCcw, Check, AlertTriangle } from 'lucide-react'

interface CalibrationWizardProps {
  isCalibrating: boolean
  calibrationData: CalibrationData | null
  calibrationBeat: number
  totalCalibrationBeats: number
  onStartCalibration: () => void
  onSkip: () => void
  onClearCalibration: () => void
}

export function CalibrationWizard({
  isCalibrating,
  calibrationData,
  calibrationBeat,
  totalCalibrationBeats,
  onStartCalibration,
  onSkip,
  onClearCalibration,
}: CalibrationWizardProps) {
  const progress = totalCalibrationBeats > 0
    ? (calibrationBeat / totalCalibrationBeats) * 100
    : 0

  const isApproximate = calibrationData && calibrationData.iqrMs > 30

  return (
    <div className="max-w-lg mx-auto bg-slate-900 rounded-2xl border border-slate-700/50 p-6 md:p-8">
      <div className="text-center space-y-5">
        {/* Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="w-14 h-14 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto"
        >
          <Mic className="w-6 h-6 text-blue-400" />
        </motion.div>

        <div>
          <h3 className="text-lg font-semibold text-slate-200">Audio Calibration</h3>
          <p className="text-sm text-slate-500 mt-1">
            Calibrate your mic latency for accurate scoring. Tap along to the metronome clicks.
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
              <p className="text-sm font-medium text-slate-300">
                {calibrationBeat === 0
                  ? 'Count-in... get ready to tap!'
                  : `Tap along! ${calibrationBeat} / ${totalCalibrationBeats}`}
              </p>

              {/* Progress bar */}
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Beat pulse ring */}
              <div className="flex justify-center relative h-20">
                <div className="relative">
                  {/* Static center dot */}
                  <div className="w-10 h-10 rounded-full bg-blue-500/30 flex items-center justify-center absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="w-5 h-5 rounded-full bg-blue-500" />
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
                        className="w-10 h-10 rounded-full border-2 border-blue-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
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
                      backgroundColor: i < calibrationBeat ? '#3b82f6' : '#334155',
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

              <div className="text-sm text-slate-500 space-y-1">
                <p>Latency: <span className="font-mono text-slate-300">{calibrationData.latencyMs.toFixed(1)}ms</span></p>
                <p>Consistency: <span className="font-mono text-slate-300">{calibrationData.iqrMs.toFixed(1)}ms IQR</span></p>
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
                  className="border-slate-600 text-slate-300 hover:bg-slate-800"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Recalibrate
                </Button>
                <Button
                  size="sm"
                  onClick={onSkip}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-0"
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
              <p className="text-sm text-slate-500">
                Use headphones for best results. The calibration takes about 15 seconds.
              </p>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSkip}
                  className="border-slate-600 text-slate-300 hover:bg-slate-800"
                >
                  Skip
                </Button>
                <Button
                  size="sm"
                  onClick={onStartCalibration}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-0"
                >
                  Start Calibration
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
