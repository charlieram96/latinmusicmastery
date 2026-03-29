'use client'

import { useEffect, useRef } from 'react'
import type { ExerciseDefinition, HitGrade } from '@/lib/play-sense/types'
import { HighwayApp } from './HighwayApp'

interface RhythmHighwayProps {
  exercise: ExerciseDefinition
  playheadProgress: number
  currentScore: number
  currentCombo: number
  currentAccuracy: number
  metronomeBeat: number
  lastHitGrade: string | null
  eventResultsLength: number
  eventResults: Array<{ eventIndex: number; grade: HitGrade }>
}

/**
 * React wrapper for the PixiJS rhythm highway.
 * Mounts a full-bleed canvas and bridges session state via refs.
 */
export function RhythmHighway({
  exercise,
  playheadProgress,
  currentScore,
  currentCombo,
  currentAccuracy,
  metronomeBeat,
  lastHitGrade,
  eventResultsLength,
  eventResults,
}: RhythmHighwayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<HighwayApp | null>(null)
  const prevEventCountRef = useRef(0)

  // Mount PixiJS app
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let app: HighwayApp | null = null
    let mounted = true

    HighwayApp.create(container).then((instance) => {
      if (!mounted) {
        instance.destroy()
        return
      }
      app = instance
      appRef.current = instance
      instance.init(exercise)
    })

    return () => {
      mounted = false
      if (app) {
        app.destroy()
        appRef.current = null
      }
    }
  }, [exercise])

  // Sync reactive values to PixiJS refs (every render, no re-mount)
  useEffect(() => {
    const app = appRef.current
    if (!app) return
    app.playheadProgress = playheadProgress
    app.currentScore = currentScore
    app.currentCombo = currentCombo
    app.currentAccuracy = currentAccuracy
    app.metronomeBeat = metronomeBeat
  })

  // Trigger hit effects when new event results arrive
  useEffect(() => {
    const app = appRef.current
    if (!app) return

    const newCount = eventResultsLength
    if (newCount > prevEventCountRef.current) {
      // Process new results
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
  }, [eventResultsLength, eventResults])

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 relative bg-black rounded-lg overflow-hidden"
    />
  )
}
