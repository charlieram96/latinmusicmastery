import type { SoundCue } from './engine'

export type { SoundCue }

export interface Note {
  freq: number
  /** seconds after the cue start */
  at: number
  /** seconds to decay to silence */
  dur: number
  gain: number
  type: 'sine' | 'triangle'
}

const n = (freq: number, at: number, dur: number, gain = 0.2, type: Note['type'] = 'sine'): Note => ({ freq, at, dur, gain, type })

/** Envelopes from the approved prototype. Short, bright, on the quiet side. */
export const CUES: Record<SoundCue, Note[]> = {
  ok: [n(1046.5, 0, 0.3), n(2093, 0, 0.16, 0.05), n(1568, 0.09, 0.38), n(3136, 0.09, 0.14, 0.04)],
  part: [n(880, 0, 0.3), n(1108.7, 0.1, 0.32)],
  bad: [n(196, 0, 0.26, 0.16, 'triangle'), n(174.6, 0.11, 0.3, 0.14, 'triangle')],
  streak: [n(1318.5, 0, 0.18, 0.12), n(1568, 0.07, 0.18, 0.12), n(2093, 0.14, 0.34, 0.14)],
  fanfare: [n(523.25, 0, 0.45, 0.18), n(659.25, 0.09, 0.45, 0.18), n(783.99, 0.18, 0.45, 0.18), n(1046.5, 0.27, 0.45, 0.18), n(1318.5, 0.36, 0.7, 0.1)],
  soft: [n(523.25, 0, 0.4, 0.14), n(659.25, 0.12, 0.5, 0.11)],
}

export const ATTACK_SECONDS = 0.012
const LEAD_SECONDS = 0.01

/** The slice of AudioContext we touch, so tests can pass a fake. */
export interface CueContext {
  currentTime: number
  state: string
  destination: AudioNode
  resume(): Promise<void>
  createOscillator(): OscillatorNode
  createGain(): GainNode
}

/** Schedule every note of a cue on the given context. Returns the note count. */
export function scheduleCue(cue: SoundCue, ctx: CueContext): number {
  if (ctx.state === 'suspended') void ctx.resume()
  const t0 = ctx.currentTime + LEAD_SECONDS
  for (const note of CUES[cue]) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = note.type
    osc.frequency.setValueAtTime(note.freq, t0 + note.at)
    gain.gain.setValueAtTime(0.0001, t0 + note.at)
    gain.gain.exponentialRampToValueAtTime(note.gain, t0 + note.at + ATTACK_SECONDS)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.at + note.dur)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t0 + note.at)
    osc.stop(t0 + note.at + note.dur + 0.05)
  }
  return CUES[cue].length
}

let shared: AudioContext | null = null

/** Lazily create one AudioContext per page. Null on the server or when unsupported. */
export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (shared) return shared
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
  const Ctor = w.AudioContext ?? w.webkitAudioContext
  if (!Ctor) return null
  try {
    shared = new Ctor()
  } catch {
    return null
  }
  return shared
}

/** Play a cue if sound is enabled. Safe to call anywhere; silently no-ops without Web Audio. */
export function playCue(cue: SoundCue, enabled: boolean): void {
  if (!enabled) return
  const ctx = getAudioContext()
  if (!ctx) return
  scheduleCue(cue, ctx)
}
