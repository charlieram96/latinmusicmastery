// Seeded art for the dashboard's faint background: wavy staves, scattered
// note shapes and a 2-3 clave figure. Pure so it renders identically on the
// server and the client (no hydration mismatch) and can be unit-tested.

export interface BackgroundNote {
  x: number
  y: number
  scale: number
  rotate: number
  kind: 'quarter' | 'eighth' | 'beamed'
}

export interface BackgroundArt {
  width: number
  height: number
  staves: string[]
  notes: BackgroundNote[]
  clave: { cx: number; cy: number }[]
}

function mulberry32(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round = (n: number) => Math.round(n * 10) / 10

export function buildBackgroundArt(seed: number, width = 1600, height = 1200): BackgroundArt {
  const r = mulberry32(seed)
  const staves: string[] = []
  const bundles: [number, number, number][] = [[0.15, 38, 0], [0.47, 54, 2.1], [0.8, 30, 4.2]]
  for (const [fy, amp, phase] of bundles) {
    for (let line = 0; line < 5; line++) {
      const y0 = height * fy + line * 9
      let d = `M-50 ${round(y0)}`
      for (let x = 0; x <= width + 100; x += 50) d += ` L${x} ${round(y0 + Math.sin(x / 260 + phase) * amp)}`
      staves.push(d)
    }
  }
  const kinds: BackgroundNote['kind'][] = ['quarter', 'eighth', 'beamed']
  const notes: BackgroundNote[] = Array.from({ length: 16 }, () => ({
    x: round(r() * width),
    y: round(r() * height),
    scale: round(0.8 + r() * 0.9),
    rotate: round((r() - 0.5) * 40),
    kind: kinds[Math.floor(r() * kinds.length)],
  }))
  // 2-3 son clave: two strokes, a longer rest, then three.
  const cx0 = width * 0.11
  const clave = [0, 46, 138, 184, 230].map((dx) => ({ cx: round(cx0 + dx), cy: round(height - 140) }))
  return { width, height, staves, notes, clave }
}
