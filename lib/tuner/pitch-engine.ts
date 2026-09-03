/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * McLeod Pitch Method (MPM): normalized square difference function with
 * key-maximum peak picking and parabolic interpolation.
 *
 * The block between the @mpm-begin / @mpm-end markers is plain JavaScript on
 * purpose: it is copied verbatim (minus the `: any` annotations) into
 * public/audio-worklets/pitch-detector-processor.js, and a test asserts the
 * two copies stay identical. Keep it free of imports and TypeScript syntax.
 */

export interface PitchReading {
  hz: number
  /** NSDF peak height, 0..1. Higher = cleaner periodic signal. */
  clarity: number
}

export const MPM_DEFAULTS = { minHz: 27, maxHz: 1400, kMax: 0.93, bufferSize: 4096 } as const

// @mpm-begin
function mpmImpl(buf: any, sampleRate: any, minHz: any, maxHz: any, kMax: any): any {
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

/** Detect the fundamental frequency of a mono time-domain buffer. */
export function mpm(
  buf: Float32Array,
  sampleRate: number,
  minHz: number,
  maxHz: number,
  kMax: number
): PitchReading | null {
  return mpmImpl(buf, sampleRate, minHz, maxHz, kMax)
}
