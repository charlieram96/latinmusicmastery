/** Deterministic synthetic signals for engine tests. */
export function synth(
  hz: number,
  partials: number[] = [1, 0.5, 0.25],
  sr = 48000,
  n = 4096,
  amp = 0.5
): Float32Array {
  const b = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / sr
    let v = 0
    partials.forEach((a, k) => {
      v += a * Math.sin(2 * Math.PI * hz * (k + 1) * t)
    })
    b[i] = v * amp
  }
  return b
}

/** Seeded uniform noise so the test is reproducible. */
export function noise(n = 4096, amp = 0.3, seed = 1): Float32Array {
  let s = seed
  const b = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0
    b[i] = ((s / 4294967296) * 2 - 1) * amp
  }
  return b
}
