/**
 * The student's own mix over the exercise's backing tracks: a level and a mute
 * per track, on top of the level the admin authored. Effective gain is
 * `authored × level`, or 0 while muted, so muting never disturbs the balance
 * the student set — the same separation the studio mixer keeps.
 */
export interface BackingMixEntry {
  /** 0..1, multiplied into the authored level. */
  level: number
  muted: boolean
}

export type BackingMix = Record<string, BackingMixEntry>

export const DEFAULT_MIX_ENTRY: BackingMixEntry = { level: 1, muted: false }

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

export function effectiveBackingGain(authored: number | undefined, entry: BackingMixEntry | undefined): number {
  const mix = entry ?? DEFAULT_MIX_ENTRY
  if (mix.muted) return 0
  return clamp01(clamp01(authored ?? 1) * clamp01(mix.level))
}

/** Per viewer, keyed by track id, so the mix follows the student between visits. */
export const BACKING_MIX_STORAGE_KEY = 'playsense.backingMix'

export function readStoredBackingMix(): BackingMix {
  try {
    const raw = window.localStorage.getItem(BACKING_MIX_STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const mix: BackingMix = {}
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue
      const { level, muted } = value as { level?: unknown; muted?: unknown }
      if (typeof level !== 'number' || !Number.isFinite(level)) continue
      mix[id] = { level: clamp01(level), muted: muted === true }
    }
    return mix
  } catch {
    return {}
  }
}

export function writeStoredBackingMix(mix: BackingMix): void {
  try {
    window.localStorage.setItem(BACKING_MIX_STORAGE_KEY, JSON.stringify(mix))
  } catch {
    /* not persisting is fine */
  }
}
