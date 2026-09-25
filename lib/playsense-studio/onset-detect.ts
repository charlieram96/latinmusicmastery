// Offline hit (onset) detection for the Watch timing tools (spec §7). Runs on
// the same 8 kHz mono mixdown the waveform peaks come from. Log-energy flux
// with an adaptive (local-median) threshold picks each attack; the reported
// time is then refined back to the first sample that reaches 30% of the
// attack's local peak, which lands within a few ms of the true onset.

export const FRAME_S = 0.016;
export const HOP_S = 0.004;
export const MIN_GAP_S = 0.045;
export const REFINE_FRACTION = 0.3;
const MEDIAN_WINDOW_S = 0.3;
/** Minimum rise over the local median, in log10-energy units (≈ 3 dB). */
const THRESHOLD_DELTA = 0.3;
/** Frames quieter than this far below the loudest frame never start a hit (≈ −45 dB). */
const FLOOR_BELOW_PEAK = 4.5;

export function detectHits(samples: Float32Array, sampleRate: number): number[] {
  const frame = Math.max(8, Math.round(FRAME_S * sampleRate));
  const hop = Math.max(1, Math.round(HOP_S * sampleRate));
  const nFrames = samples.length >= frame ? Math.floor((samples.length - frame) / hop) + 1 : 0;
  if (nFrames < 3) return [];

  const logE = new Float64Array(nFrames);
  let maxLog = -Infinity;
  for (let f = 0; f < nFrames; f++) {
    let e = 0;
    const start = f * hop;
    for (let i = start; i < start + frame; i++) e += samples[i] * samples[i];
    logE[f] = Math.log10(e / frame + 1e-12);
    if (logE[f] > maxLog) maxLog = logE[f];
  }
  if (maxLog < -9) return []; // digital silence

  // Positive flux against the quietest of the previous few frames, so a
  // rise spread over several hops still reads as one strong step.
  const flux = new Float64Array(nFrames);
  for (let f = 1; f < nFrames; f++) {
    const prev = Math.min(logE[f - 1], logE[Math.max(0, f - 2)], logE[Math.max(0, f - 3)]);
    flux[f] = Math.max(0, logE[f] - prev);
  }

  // Block-median grid: the local median is computed once per coarse block
  // (rather than per frame) and reused for every frame inside it. This
  // keeps a 10-minute buffer's analysis well under the perf budget without
  // sorting a sliding window at every hop.
  const half = Math.max(1, Math.round(MEDIAN_WINDOW_S / HOP_S / 2));
  const blockSize = Math.max(1, half);
  const nBlocks = Math.ceil(nFrames / blockSize);
  const blockMedian = new Float64Array(nBlocks);
  const win: number[] = [];
  for (let b = 0; b < nBlocks; b++) {
    const center = Math.min(nFrames - 1, b * blockSize + (blockSize >> 1));
    win.length = 0;
    for (let k = Math.max(0, center - half); k <= Math.min(nFrames - 1, center + half); k++) win.push(flux[k]);
    win.sort((a, b2) => a - b2);
    blockMedian[b] = win[win.length >> 1];
  }

  const floor = maxLog - FLOOR_BELOW_PEAK;
  const minGapFrames = Math.max(1, Math.round(MIN_GAP_S / HOP_S));
  const peaks: number[] = [];
  for (let f = 1; f < nFrames - 1; f++) {
    if (logE[f] < floor) continue;
    if (!(flux[f] >= flux[f - 1] && flux[f] > flux[f + 1])) continue;
    const median = blockMedian[(f / blockSize) | 0];
    if (flux[f] < median + THRESHOLD_DELTA) continue;
    const last = peaks[peaks.length - 1];
    if (last !== undefined && f - last < minGapFrames) {
      if (flux[f] > flux[last]) peaks[peaks.length - 1] = f;
      continue;
    }
    peaks.push(f);
  }

  // Refine: the first sample reaching REFINE_FRACTION of the attack's peak.
  // The search window never starts before the previous reported hit, so a
  // refined onset can't drift backwards past an earlier one.
  const out: number[] = [];
  for (const f of peaks) {
    const prevSample = out.length ? Math.round(out[out.length - 1] * sampleRate) : 0;
    const lo = Math.max(0, prevSample, (f - 3) * hop);
    const hi = Math.min(samples.length, f * hop + frame + Math.round(0.02 * sampleRate));
    if (lo >= hi) continue;
    let peak = 0;
    for (let i = lo; i < hi; i++) peak = Math.max(peak, Math.abs(samples[i]));
    const target = peak * REFINE_FRACTION;
    let at = lo;
    for (let i = lo; i < hi; i++) {
      if (Math.abs(samples[i]) >= target) { at = i; break; }
    }
    const t = at / sampleRate;
    if (!out.length || t - out[out.length - 1] >= MIN_GAP_S - 0.005) out.push(t);
  }
  return out;
}
