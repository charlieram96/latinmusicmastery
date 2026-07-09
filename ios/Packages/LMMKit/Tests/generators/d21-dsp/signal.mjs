// Deterministic signal generator shared (by exact-mirror port) with the Swift
// D21 onset-detector parity test. EVERY value is written into a Float32Array with
// `+=` in a defined order so the resulting Float32 quantization is reproducible
// bit-for-bit by the Swift `Signal` generator (which mirrors this file line by line).
//
// The math is done in JS doubles (Math.sin/exp), then stored into Float32 — exactly
// what the Swift port does with `Float(Double expr)`. Accumulation order matters.

export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// A single exponentially-decaying sine "click"/"pluck" grain added in place.
// start: sample index; freq: Hz; amp; durSec; decaySec (tau, 0 => no decay/hold).
export function addGrain(buf, sr, startSample, freq, amp, durSec, decaySec) {
  const dur = Math.round(durSec * sr)
  for (let i = 0; i < dur; i++) {
    const idx = startSample + i
    if (idx < 0 || idx >= buf.length) continue
    const env = decaySec > 0 ? Math.exp(-i / (decaySec * sr)) : 1
    const v = amp * env * Math.sin((2 * Math.PI * freq * i) / sr)
    buf[idx] = Math.fround(buf[idx] + v) // Float32Array assignment already rounds; explicit for clarity
  }
}

// Add band-limited-ish white noise across the whole buffer (mulberry32).
export function addNoise(buf, seed, amp) {
  const rng = mulberry32(seed)
  for (let i = 0; i < buf.length; i++) {
    const v = (rng() * 2 - 1) * amp
    buf[i] = Math.fround(buf[i] + v)
  }
}

// Build a fixture signal from a compact param spec (mirrored in Swift).
export function buildSignal(sr, spec) {
  const n = Math.round(spec.durationSec * sr)
  const buf = new Float32Array(n)
  if (spec.noise) addNoise(buf, spec.noise.seed, spec.noise.amp)
  for (const g of spec.grains ?? []) {
    const start = Math.round(g.atSec * sr)
    // chord = multiple simultaneous freqs summed in listed order
    const freqs = g.freqs ?? [g.freq]
    for (const f of freqs) {
      addGrain(buf, sr, start, f, g.amp, g.durSec, g.decaySec ?? 0)
    }
  }
  return buf
}

// Checksum used to assert JS/Swift input parity (order-independent-ish double sum
// of Float32 values + sum of |.| so sign errors also surface).
export function checksum(buf) {
  let s = 0
  let a = 0
  for (let i = 0; i < buf.length; i++) {
    s += buf[i]
    a += Math.abs(buf[i])
  }
  return { sum: s, absSum: a, length: buf.length }
}
