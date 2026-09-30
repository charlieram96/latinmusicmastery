/**
 * Instrument families for the /instructors filter. A teacher belongs to every
 * family one of their seat keys (see `teacherSeatKeys`) falls in.
 */
export type FamilyKey = 'perc' | 'keys' | 'bass' | 'strings' | 'horns' | 'voice'

export const FAMILIES: readonly { key: FamilyKey; seats: readonly string[] }[] = [
  { key: 'perc', seats: ['Timbal', 'Conga', 'Minor Percussion', 'Drums'] },
  { key: 'keys', seats: ['Piano'] },
  { key: 'bass', seats: ['Bass'] },
  { key: 'strings', seats: ['Tres', 'Guitar', 'Violin'] },
  { key: 'horns', seats: ['Trumpet', 'Saxophone'] },
  { key: 'voice', seats: ['Voice'] },
]

/** Families for a teacher's seat keys, in `FAMILIES` order, without repeats. */
export function teacherFamilies(seatKeys: readonly string[]): FamilyKey[] {
  return FAMILIES.filter(f => f.seats.some(s => seatKeys.includes(s))).map(f => f.key)
}

/** Teachers per family, plus `all`. */
export function familyCounts(teachers: readonly { seatKeys: readonly string[] }[]): Record<FamilyKey | 'all', number> {
  const counts = { all: teachers.length, perc: 0, keys: 0, bass: 0, strings: 0, horns: 0, voice: 0 }
  for (const t of teachers) for (const f of teacherFamilies(t.seatKeys)) counts[f]++
  return counts
}
