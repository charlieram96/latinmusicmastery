/** Persisted tuner preferences: schema, defaults, and storage helpers. */
import { z } from 'zod'

export const PREFS_KEY = 'lmm-tuner-prefs'

export const tunerPrefsSchema = z.object({
  instrument: z.enum(['guitar', 'bass', 'tres', 'cuatro', 'ukulele', 'violin', 'chromatic']),
  tuning: z.string().min(1),
  a4: z.number().int().min(415).max(466),
  sensitivity: z.enum(['low', 'med', 'high']),
  tolerance: z.union([z.literal(1), z.literal(3), z.literal(5)]),
  names: z.enum(['letters', 'solfege']),
  transpose: z.union([z.literal(0), z.literal(2), z.literal(7), z.literal(9)]),
  holdSec: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  meter: z.enum(['needle', 'strobe']),
})

export type TunerPrefs = z.infer<typeof tunerPrefsSchema>

export const DEFAULT_PREFS: TunerPrefs = {
  instrument: 'guitar',
  tuning: 'standard',
  a4: 440,
  sensitivity: 'med',
  tolerance: 3,
  names: 'letters',
  transpose: 0,
  holdSec: 1,
  meter: 'needle',
}

/** Parse stored JSON. Partial objects merge over defaults; anything invalid → defaults. */
export function parsePrefs(raw: string | null): TunerPrefs {
  if (!raw) return DEFAULT_PREFS
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return DEFAULT_PREFS
    const result = tunerPrefsSchema.safeParse({ ...DEFAULT_PREFS, ...(parsed as Record<string, unknown>) })
    return result.success ? result.data : DEFAULT_PREFS
  } catch {
    return DEFAULT_PREFS
  }
}

export function loadPrefs(storage: Pick<Storage, 'getItem'> | null): TunerPrefs {
  if (!storage) return DEFAULT_PREFS
  try {
    return parsePrefs(storage.getItem(PREFS_KEY))
  } catch {
    return DEFAULT_PREFS
  }
}

export function savePrefs(storage: Pick<Storage, 'setItem'> | null, prefs: TunerPrefs): void {
  if (!storage) return
  try {
    storage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // Private mode / quota: preferences simply do not persist.
  }
}
