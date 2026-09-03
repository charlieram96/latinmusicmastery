/**
 * AudioWorklet processor for the tuner: McLeod Pitch Method off the main thread.
 * Must be plain JS for addModule().
 *
 * The block between @mpm-begin and @mpm-end is a verbatim copy of
 * lib/tuner/pitch-engine.ts (a vitest test keeps them identical).
 *
 * Messages in:  { type: 'config', rms?: number, clarity?: number }
 * Messages out: { hz: number | null, clarity: number, rms: number, peak: number }
 *   hz is null when the block is below the RMS gate or the clarity floor.
 */

// @mpm-begin
function mpmImpl(buf, sampleRate, minHz, maxHz, kMax) {
  const n = buf.length
  const maxTau = Math.min(n >> 1, Math.floor(sampleRate / minHz))
  const minTau = Math.max(2, Math.floor(sampleRate / maxHz))
  // Fixed correlation window so NSDF values are comparable across lags.
  const W = n - maxTau
  const prefix = new Float32Array(n + 1)
  const nsdf = new Float32Array(maxTau + 2)
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + buf[i] * buf[i]
  if (prefix[n] === 0) return null
  for (let tau = 1; tau <= maxTau; tau++) {
    let r = 0
    for (let i = 0; i < W; i++) r += buf[i] * buf[i + tau]
    const m = prefix[W] + (prefix[W + tau] - prefix[tau])
    nsdf[tau] = m > 0 ? (2 * r) / m : 0
  }
  // Skip the lobe around tau = 0, then collect the maximum of every positive lobe.
  let tau = 1
  while (tau < maxTau && nsdf[tau] > 0) tau++
  const peaks = []
  let inPeak = false
  let pMax = 0
  let pTau = 0
  for (; tau < maxTau; tau++) {
    const v = nsdf[tau]
    if (v > 0) {
      if (!inPeak) {
        inPeak = true
        pMax = v
        pTau = tau
      } else if (v > pMax) {
        pMax = v
        pTau = tau
      }
    } else if (inPeak) {
      if (pTau >= minTau) peaks.push([pTau, pMax])
      inPeak = false
    }
  }
  if (inPeak && pTau >= minTau) peaks.push([pTau, pMax])
  if (!peaks.length) return null
  // Key-max picking: the first peak within kMax of the global maximum wins,
  // which prefers the true fundamental over a stronger harmonic peak.
  let g = 0
  for (let i = 0; i < peaks.length; i++) if (peaks[i][1] > g) g = peaks[i][1]
  const thr = kMax * g
  let chosen = peaks[0]
  for (let i = 0; i < peaks.length; i++) {
    if (peaks[i][1] >= thr) {
      chosen = peaks[i]
      break
    }
  }
  const t = chosen[0]
  const a = nsdf[t - 1]
  const b = nsdf[t]
  const c = nsdf[t + 1]
  const d = a - 2 * b + c
  const shift = d !== 0 ? (0.5 * (a - c)) / d : 0
  return { hz: sampleRate / (t + shift), clarity: b }
}
// @mpm-end

class PitchDetectorProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.config = {
      rms: 0.01,
      clarity: 0.88,
      minHz: 27,
      maxHz: 1400,
      kMax: 0.93,
      bufferSize: 4096,
      hop: 1024,
    }
    this.ring = new Float32Array(this.config.bufferSize)
    this.window = new Float32Array(this.config.bufferSize)
    this.writePos = 0
    this.sinceHop = 0
    this.port.onmessage = (event) => {
      const msg = event.data
      if (!msg || msg.type !== 'config') return
      if (typeof msg.rms === 'number') this.config.rms = msg.rms
      if (typeof msg.clarity === 'number') this.config.clarity = msg.clarity
    }
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
    if (!channel) return true
    const size = this.config.bufferSize
    for (let i = 0; i < channel.length; i++) {
      this.ring[this.writePos] = channel[i]
      this.writePos = (this.writePos + 1) % size
      this.sinceHop++
      if (this.sinceHop >= this.config.hop) {
        this.sinceHop = 0
        this.analyze()
      }
    }
    return true
  }

  analyze() {
    const size = this.config.bufferSize
    const w = this.window
    // Linearize the ring buffer, oldest sample first.
    const head = size - this.writePos
    w.set(this.ring.subarray(this.writePos), 0)
    w.set(this.ring.subarray(0, this.writePos), head)
    let sum = 0
    let peak = 0
    for (let i = 0; i < size; i++) {
      const v = w[i]
      sum += v * v
      const a = v < 0 ? -v : v
      if (a > peak) peak = a
    }
    const rms = Math.sqrt(sum / size)
    let hz = null
    let clarity = 0
    if (rms >= this.config.rms) {
      const r = mpmImpl(w, sampleRate, this.config.minHz, this.config.maxHz, this.config.kMax)
      if (r) {
        clarity = r.clarity
        if (r.clarity >= this.config.clarity) hz = r.hz
      }
    }
    this.port.postMessage({ hz, clarity, rms, peak })
  }
}

registerProcessor('pitch-detector-processor', PitchDetectorProcessor)
