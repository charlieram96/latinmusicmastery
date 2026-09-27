'use client'

/**
 * WebAudio synthesis for the home page: the groove's five parts and the hero
 * piano keys. Ported from the prototype (`initAudio`, `SOUND`, the lookahead
 * scheduler and the key-click synth). The AudioContext is created lazily on
 * the first call, which always comes from a click, so nothing ever sounds on
 * its own.
 */
import { INST_IDS, VOICE, antic, vel, type InstId, type Pattern } from './patterns'

type Ctx = { ac: AudioContext; noise: AudioBuffer; bus: Record<InstId, GainNode> }
let ctx: Ctx | null = null

const PANS: Record<InstId, number> = { clave: 0.32, campana: -0.38, conga: 0.45, bajo: 0, piano: -0.22 }
const SENDS: Record<InstId, number> = { clave: 0.25, campana: 0.2, conga: 0.22, bajo: 0.05, piano: 0.28 }

/** Create (once) and resume the shared AudioContext. Call only from a user gesture. */
export function ensureAudio(): Ctx {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ac = new AC()
    const comp = ac.createDynamicsCompressor()
    comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2
    const master = ac.createGain(); master.gain.value = 0.85; master.connect(comp); comp.connect(ac.destination)
    const noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate)
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    const len = Math.floor(ac.sampleRate * 1.9), ir = ac.createBuffer(2, len, ac.sampleRate)
    for (let ch = 0; ch < 2; ch++) { const x = ir.getChannelData(ch); for (let i = 0; i < len; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) }
    const rev = ac.createConvolver(); rev.buffer = ir
    const revIn = ac.createGain(); revIn.gain.value = 0.9; revIn.connect(rev); rev.connect(master)
    const bus = {} as Record<InstId, GainNode>
    for (const id of INST_IDS) {
      const g = ac.createGain()
      const p = ac.createStereoPanner ? ac.createStereoPanner() : null
      if (p) { p.pan.value = PANS[id]; g.connect(p); p.connect(master) } else g.connect(master)
      const s = ac.createGain(); s.gain.value = SENDS[id]; g.connect(s); s.connect(revIn)
      bus[id] = g
    }
    ctx = { ac, noise, bus }
  }
  if (ctx.ac.state === 'suspended') void ctx.ac.resume()
  return ctx
}

function env(g: GainNode, t: number, peak: number, dec: number, att = 0.002) {
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + att)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dec)
}
function osc(c: Ctx, type: OscillatorType, f: number, t: number, peak: number, dec: number, dest: AudioNode, f2?: number) {
  const o = c.ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t)
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + 0.04)
  const g = c.ac.createGain(); env(g, t, peak, dec); o.connect(g); g.connect(dest); o.start(t); o.stop(t + dec + 0.05)
}
function noise(c: Ctx, t: number, dec: number, peak: number, type: BiquadFilterType, f: number, q: number, dest: AudioNode) {
  const s = c.ac.createBufferSource(); s.buffer = c.noise
  const fl = c.ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q
  const g = c.ac.createGain(); env(g, t, peak, dec, 0.001); s.connect(fl); fl.connect(g); g.connect(dest)
  s.start(t, Math.random() * 0.5); s.stop(t + dec + 0.05)
}
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

type Voice = (c: Ctx, t: number, v: number, s: number, p: Pattern, stepDur: number) => void
const SOUND: Record<InstId, Voice> = {
  clave(c, t, v) { const b = c.bus.clave; osc(c, 'sine', 2480, t, 0.42 * v, 0.07, b); osc(c, 'triangle', 1650, t, 0.08 * v, 0.035, b); noise(c, t, 0.012, 0.12, 'bandpass', 4200, 2, b) },
  campana(c, t, v) {
    const b = c.bus.campana, bp = c.ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.9
    const g = c.ac.createGain(); env(g, t, 0.2 * v, v > 0.8 ? 0.32 : 0.16); bp.connect(g); g.connect(b)
    for (const f of [587, 845]) { const o = c.ac.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(bp); o.start(t); o.stop(t + 0.4) }
  },
  conga(c, t, _v, s, p) {
    const b = c.bus.conga, k = p.conga[s]
    if (k === 'h') osc(c, 'sine', 118, t, 0.16, 0.07, b)
    else if (k === 's') { noise(c, t, 0.07, 0.5, 'bandpass', 1900, 1, b); osc(c, 'sine', 390, t, 0.28, 0.06, b) }
    else { const f = k === 'O' ? 196 : 262; osc(c, 'sine', f * 1.12, t, 0.72, 0.42, b, f); noise(c, t, 0.02, 0.08, 'bandpass', 900, 1, b) }
  },
  bajo(c, t, _v, s, p, stepDur) {
    const b = c.bus.bajo, f = hz(p.bajo[s]), dur = stepDur * 2.6
    osc(c, 'sine', f, t, 0.62, dur + 0.25, b); osc(c, 'triangle', f * 2, t, 0.1, dur * 0.6, b)
    const lp = c.ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(1100, t); lp.frequency.exponentialRampToValueAtTime(260, t + 0.15); lp.connect(b)
    osc(c, 'sawtooth', f, t, 0.09, 0.18, lp)
  },
  piano(c, t, v, s, p) {
    const b = c.bus.piano, grip = p.piano[s], voice = VOICE[antic(s)]
    const notes = grip ? voice[grip] : voice.h
    notes.forEach((m, i) => { const f = hz(m); osc(c, 'triangle', f, t + i * 0.004, 0.075 * v, 0.95, b); osc(c, 'sine', f * 2, t + i * 0.004, 0.025 * v, 0.45, b) })
    noise(c, t, 0.01, 0.04, 'highpass', 5000, 0.7, b)
  },
}

/** One synthesized piano note (the hero keys), through the piano bus. */
export function playPianoNote(midi: number) {
  const c = ensureAudio()
  const t = c.ac.currentTime + 0.02, f = hz(midi), b = c.bus.piano
  osc(c, 'triangle', f, t, 0.16, 1.8, b); osc(c, 'sine', f * 2, t, 0.05, 0.9, b); osc(c, 'sine', f * 3, t, 0.018, 0.5, b)
  noise(c, t, 0.012, 0.05, 'highpass', 4000, 0.7, b)
}

export interface GrooveHost {
  /** Latest pattern (read at schedule time so edits are heard on the next pass). */
  pattern(): Pattern
  isMuted(id: InstId): boolean
  /** Called in step with the audio clock; -1 when stopped. */
  onStep(step: number): void
}

export interface Groove { start(): void; stop(): void; setBpm(bpm: number): void; hit(id: InstId, step: number): void; playing(): boolean }

/** Lookahead scheduler: a 25ms timer queues notes 120ms ahead; rAF reports the step being heard. */
export function createGroove(host: GrooveHost, initialBpm: number): Groove {
  let bpm = initialBpm, playing = false, next = 0, nextTime = 0
  let timer: ReturnType<typeof setInterval> | null = null, raf = 0
  let queue: { s: number; t: number }[] = []
  const stepDur = () => 60 / bpm / 2

  const schedule = () => {
    const c = ensureAudio(), p = host.pattern()
    while (nextTime < c.ac.currentTime + 0.12) {
      const s = next, t = nextTime
      for (const id of INST_IDS) { const v = vel(p, id, s); if (v && !host.isMuted(id)) SOUND[id](c, t, v, s, p, stepDur()) }
      queue.push({ s, t })
      nextTime += stepDur(); next = (s + 1) % 16
    }
  }
  const pump = () => {
    if (!playing || !ctx) return
    let step = -1
    while (queue.length && queue[0].t <= ctx.ac.currentTime) step = queue.shift()!.s
    if (step >= 0) host.onStep(step)
    raf = requestAnimationFrame(pump)
  }

  return {
    start() {
      const c = ensureAudio()
      playing = true; queue = []; next = 0; nextTime = c.ac.currentTime + 0.08
      if (timer) clearInterval(timer)
      timer = setInterval(schedule, 25); schedule()
      cancelAnimationFrame(raf); raf = requestAnimationFrame(pump)
    },
    stop() {
      playing = false; queue = []
      if (timer) clearInterval(timer); timer = null
      cancelAnimationFrame(raf)
      if (ctx) void ctx.ac.suspend()
      host.onStep(-1)
    },
    setBpm(n) { bpm = n },
    hit(id, step) {
      if (!playing || !ctx) return
      const p = host.pattern(), v = vel(p, id, step)
      if (v && !host.isMuted(id)) SOUND[id](ctx, ctx.ac.currentTime + 0.01, v, step, p, stepDur())
    },
    playing: () => playing,
  }
}
