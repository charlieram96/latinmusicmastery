import type { LiveAudioInput } from './live-audio-input'
import { microphoneTiming } from '@/lib/play-sense/microphone-timing'

export const TIMING_BPM = 100
export const timingPresets = (bpm: number) => [0, 1 / 16, 1 / 32, 1 / 8, 1 / 4].map(beats => 60000 / bpm * beats)
export type TimingHit = { beat: number; offsetMs: number }
export function assessTiming(hits: TimingHit[], compensationMs: number) {
  const valid = hits.filter(h => Number.isInteger(h.beat) && h.beat >= 0 && h.beat < 16 && Number.isFinite(h.offsetMs))
  const offsets = [...new Map(valid.map(h => [h.beat, h.offsetMs])).values()].sort((a, b) => a - b)
  const median = offsets.length ? offsets[Math.floor(offsets.length / 2)] : 0
  const iqr = offsets.length ? offsets[Math.floor(offsets.length * .75)] - offsets[Math.floor(offsets.length * .25)] : Infinity
  const window = microphoneTiming('beginner')
  const score = offsets.reduce((sum, value) => {
    const error = Math.abs(value - compensationMs)
    return sum + (error <= window.perfect ? 100 : error <= window.good ? 90 : error <= window.ok ? 75 : 0)
  }, 0) / 16
  const stable = offsets.length === 16 && valid.length === 16 && iqr <= 40
  return { score, median, iqr, stable, passed: stable && score >= 97 }
}

function key(live: LiveAudioInput | null | undefined, mode: string | null) {
  if (!live || !['headphones', 'speaker-safe'].includes(mode ?? '')) return null
  const device = live.stream.getAudioTracks?.()[0]?.getSettings().deviceId
  if (!device) return null
  return `lmm.timing-compensation.v1.${JSON.stringify([device, mode, live.context.sampleRate, (live.context as AudioContext & {sinkId?: string}).sinkId ?? 'default', navigator.userAgent])}`
}
export function readTimingCompensation(live: LiveAudioInput | null | undefined, mode: string | null): number | null {
  const storageKey = key(live, mode)
  if (!storageKey) return null
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    return value?.version === 1 && Number.isFinite(value.ms) && value.ms >= 0 && value.ms <= 500 ? value.ms : null
  } catch { return null }
}
export function saveTimingCompensation(live: LiveAudioInput | null | undefined, mode: string | null, ms: number): boolean {
  const storageKey = key(live, mode)
  if (!storageKey || !Number.isFinite(ms) || ms < 0 || ms > 500) return false
  try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, ms })); return true } catch { return false }
}
