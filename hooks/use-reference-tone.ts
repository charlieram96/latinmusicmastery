'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const ATTACK_S = 0.02
const RELEASE_S = 0.15
const LEVEL = 0.22
// Warm additive timbre: fundamental plus four softer partials.
const REAL = new Float32Array([0, 0, 0, 0, 0, 0])
const IMAG = new Float32Array([0, 1, 0.45, 0.22, 0.11, 0.05])

/** Plays a sustained reference pitch through a shared AudioContext. */
export function useReferenceTone(getCtx: () => AudioContext) {
  const oscRef = useRef<OscillatorNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const waveRef = useRef<PeriodicWave | null>(null)
  const waveCtxRef = useRef<AudioContext | null>(null)
  const [playingHz, setPlayingHz] = useState<number | null>(null)

  const silence = useCallback((fast: boolean) => {
    const osc = oscRef.current
    const gain = gainRef.current
    oscRef.current = null
    gainRef.current = null
    if (!osc || !gain) return
    const ctx = osc.context
    if (ctx.state === 'closed') return
    const now = ctx.currentTime
    gain.gain.cancelScheduledValues(now)
    gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (fast ? 0.03 : RELEASE_S))
    osc.stop(now + RELEASE_S + 0.05)
  }, [])

  const play = useCallback(
    (hz: number) => {
      const ctx = getCtx()
      silence(true)
      if (!waveRef.current || waveCtxRef.current !== ctx) {
        waveRef.current = ctx.createPeriodicWave(REAL, IMAG)
        waveCtxRef.current = ctx
      }
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.setPeriodicWave(waveRef.current)
      osc.frequency.value = hz
      const now = ctx.currentTime
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(LEVEL, now + ATTACK_S)
      osc.connect(gain).connect(ctx.destination)
      osc.start()
      oscRef.current = osc
      gainRef.current = gain
      setPlayingHz(hz)
    },
    [getCtx, silence]
  )

  const stop = useCallback(() => {
    silence(false)
    setPlayingHz(null)
  }, [silence])

  useEffect(() => () => silence(true), [silence])

  return { play, stop, playing: playingHz != null, playingHz }
}
