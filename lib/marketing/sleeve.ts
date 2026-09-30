/**
 * Record-sleeve covers: a deterministic palette + geometric motif per seed
 * (course, style, post), in place of stock photography.
 */
export const SLEEVE_PALETTES = [
  { bg: '#FFA524', ink: '#1A0B0F' }, { bg: '#FF324D', ink: '#FFF3E6' }, { bg: '#2FD1B5', ink: '#0B1A17' }, { bg: '#A58BFF', ink: '#140A26' },
  { bg: '#F6EBDD', ink: '#1A0B0F' }, { bg: '#2C1E31', ink: '#FFA524' }, { bg: '#1F3B63', ink: '#FFC94D' }, { bg: '#7A1E2E', ink: '#F6EBDD' }, { bg: '#FFC94D', ink: '#2A120C' },
]

const MOTIFS: ((mc: string) => string)[] = [
  mc => `radial-gradient(circle at 78% 30%,transparent 0 16%,${mc} 16% 17.5%,transparent 17.5% 25%,${mc} 25% 26.5%,transparent 26.5% 34%,${mc} 34% 35.5%,transparent 35.5%)`,
  mc => `linear-gradient(180deg,transparent 52%,var(--bg) 52%),repeating-linear-gradient(90deg,${mc} 0 7%,transparent 7% 12.5%)`,
  mc => `radial-gradient(circle at 50% 108%,${mc} 0 44%,transparent 44.5%)`,
  mc => `radial-gradient(circle,${mc} 0 7px,transparent 7.5px) 12px 12px/34px 34px`,
  mc => `repeating-linear-gradient(-35deg,${mc} 0 12px,transparent 12px 30px)`,
  mc => `radial-gradient(circle at 70% 32%,${mc} 0 28%,transparent 28.5%),radial-gradient(circle at 70% 32%,transparent 0 34%,${mc} 34% 35%,transparent 35.5%)`,
]

function hash(s: string): number {
  let h = 7
  for (const ch of s) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0
  return h
}

export function sleeveLook(seed: string): { bg: string; ink: string; motif: string } {
  const h = hash(seed)
  const p = SLEEVE_PALETTES[h % SLEEVE_PALETTES.length]
  const motif = MOTIFS[(h >>> 4) % MOTIFS.length](`color-mix(in srgb,${p.ink} 16%,transparent)`)
  return { bg: p.bg, ink: p.ink, motif }
}
