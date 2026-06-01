'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ExerciseDefinition, HitGrade, SessionState } from '@/lib/play-sense/types'
import { HighwayApp } from './HighwayApp'

interface RhythmHighwayProps {
  exercise: ExerciseDefinition
  sessionState: SessionState
  playheadProgress: number
  currentScore: number
  currentCombo: number
  currentAccuracy: number
  metronomeBeat: number
  countdownBeat?: number
  eventResultsLength: number
  eventResults: Array<{ eventIndex: number; grade: HitGrade }>
  /** Optional dim layer alpha (0..1) — used while a modal overlay is on top */
  dimAlpha?: number
  /** Render the in-canvas stats HUD. Default true; pass false when DOM chrome owns stats. */
  showHud?: boolean
  /** Hide the built-in countdown overlay (e.g. when the immersive stage shows its own). */
  hideCountdown?: boolean
}

/**
 * React wrapper for the PixiJS rhythm highway.
 * Stays mounted across selecting / countdown / playing — pauses when not playing
 * so countdown numbers feel like they're being shown ON the canvas, not next to it.
 */
export function RhythmHighway({
  exercise,
  sessionState,
  playheadProgress,
  currentScore,
  currentCombo,
  currentAccuracy,
  metronomeBeat,
  countdownBeat,
  eventResultsLength,
  eventResults,
  dimAlpha = 0,
  showHud = true,
  hideCountdown = false,
}: RhythmHighwayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<HighwayApp | null>(null)
  const prevEventCountRef = useRef(0)

  // Mount PixiJS app — re-init only when the exercise itself changes
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let app: HighwayApp | null = null
    let mounted = true

    prevEventCountRef.current = 0

    HighwayApp.create(container, { showHud }).then((instance) => {
      if (!mounted) {
        instance.destroy()
        return
      }
      app = instance
      appRef.current = instance
      instance.init(exercise)
    }).catch((err) => {
      console.error('Failed to create PixiJS highway:', err)
    })

    return () => {
      mounted = false
      if (app) {
        app.destroy()
        appRef.current = null
      }
    }
  }, [exercise, showHud])

  // Sync reactive values to PixiJS refs every render — paused gates note scrolling
  useEffect(() => {
    const app = appRef.current
    if (!app) return
    app.paused = sessionState !== 'playing'
    app.playheadProgress = playheadProgress
    app.currentScore = currentScore
    app.currentCombo = currentCombo
    app.currentAccuracy = currentAccuracy
    app.metronomeBeat = metronomeBeat
  })

  // Reset internal note counter when sessionState transitions away from playing
  // so the next play does not replay stale hit effects.
  useEffect(() => {
    if (sessionState !== 'playing') {
      prevEventCountRef.current = 0
    }
  }, [sessionState])

  // Trigger hit effects when new event results arrive
  useEffect(() => {
    const app = appRef.current
    if (!app || sessionState !== 'playing') return

    const newCount = eventResultsLength
    if (newCount > prevEventCountRef.current) {
      for (let i = prevEventCountRef.current; i < newCount; i++) {
        const result = eventResults[i]
        if (result) {
          if (result.grade === 'miss') {
            app.triggerMiss(result.eventIndex)
          } else {
            app.triggerHitEffect(result.eventIndex, result.grade)
          }
        }
      }
      prevEventCountRef.current = newCount
    }
  }, [eventResultsLength, eventResults, sessionState])

  return (
    <div className="flex-1 min-h-0 relative bg-black rounded-lg overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Soft dim layer for when a modal overlay is on top of the canvas */}
      <AnimatePresence>
        {dimAlpha > 0 && (
          <motion.div
            key="dim"
            initial={{ opacity: 0 }}
            animate={{ opacity: dimAlpha }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-[2px] pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Countdown overlay — drawn on top of the canvas */}
      <AnimatePresence>
        {sessionState === 'countdown' && !hideCountdown && (
          <motion.div
            key="countdown"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
          >
            <div className="text-center relative">
              <AnimatePresence mode="wait">
                <motion.p
                  key={countdownBeat ?? 0}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 1.4, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 18 }}
                  className="text-[140px] leading-none font-black tracking-tight"
                  style={{
                    color: 'white',
                    textShadow:
                      '0 0 40px rgba(237,138,44,0.6), 0 0 100px rgba(213,78,63,0.3)',
                  }}
                >
                  {countdownBeat || '...'}
                </motion.p>
              </AnimatePresence>
              <p className="text-xs uppercase tracking-[0.4em] text-white/60 mt-2">
                Get ready
              </p>
              <motion.div
                key={`ring-${countdownBeat ?? 0}`}
                initial={{ scale: 0.6, opacity: 0.7 }}
                animate={{ scale: 3, opacity: 0 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-2 border-white/40"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
