export interface AcousticProfile {
  version: 3
  noise: number
  floor: number
  mode: 'rhythm-only' | 'dynamics'
  soft?: number[]
  medium?: number[]
  strong?: number[]
  at: string
  deviceLabel?: string
  timing?: { latencyMs: number; iqrMs: number }
}

/** Keep completed measurements only; an interrupted replacement never erases a profile. */
export function saveAcousticProfile(key: string, profile: AcousticProfile) {
  const previous = readAcousticProfile(key)
  let history: AcousticProfile[] = []
  try { const parsed = JSON.parse(localStorage.getItem(`${key}.history`) || '[]'); if (Array.isArray(parsed)) history = parsed } catch { /* Recover damaged history. */ }
  if (previous && !history.some(item => item.at === previous.at)) history.push(previous)
  history.push(profile)
  localStorage.setItem(`${key}.history`, JSON.stringify(history.slice(-30)))
  localStorage.setItem(key, JSON.stringify(profile))
}
export const acousticProfileKey = (user: string, device: string, instrument: string, mode: string) =>
  `lmm.acoustic.v3.${encodeURIComponent(user)}.${encodeURIComponent(device)}.${instrument}.${mode}`
export function readAcousticProfile(key: string): AcousticProfile | null {
  try {
    const p = JSON.parse(localStorage.getItem(key) || 'null')
    if (p?.version !== 3 || !Number.isFinite(p.noise) || p.noise < 0 || !Number.isFinite(p.floor) || p.floor <= 0 || p.floor > .05 || !['rhythm-only','dynamics'].includes(p.mode)) return null
    return p
  } catch { return null }
}
