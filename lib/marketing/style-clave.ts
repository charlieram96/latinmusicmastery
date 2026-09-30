/**
 * Static clave shown on a style page. Steps are eighth notes over two bars
 * (16 cells), the same grid as the home page groove.
 */
export type ClaveKey = 'son32' | 'rumba32'

export const CLAVE_HITS: Record<ClaveKey, number[]> = {
  son32: [0, 3, 6, 10, 12],
  rumba32: [0, 3, 7, 10, 12],
}

/** Bongó bell on every downbeat eighth and the bass tumbao (anticipating on the & of 2 and on 4). */
export const BONGO_HITS = [0, 2, 4, 6, 8, 10, 12, 14]
export const BASS_HITS = [3, 6, 11, 14]

const SON_FAMILY = new Set(['son-cubano', 'salsa-cubana', 'mambo', 'timba', 'guaracha', 'guajira'])

export function claveForStyle(slug: string): { key: ClaveKey; hits: number[] } | null {
  if (SON_FAMILY.has(slug)) return { key: 'son32', hits: CLAVE_HITS.son32 }
  if (slug === 'rumba') return { key: 'rumba32', hits: CLAVE_HITS.rumba32 }
  return null
}
