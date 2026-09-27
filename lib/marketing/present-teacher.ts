import { monogramDataUri } from './monogram'
import { splitNickname } from './teacher-name'

/** `Patricio "el chino" Diaz` → `Patricio “El Chino” Diaz`. */
export function displayName(name: string): string {
  const { before, nickname, after } = splitNickname(name)
  return nickname ? `${before} “${nickname}” ${after}`.trim() : name
}

/** `["salsa", "and classical music."]` → `["Salsa", "Classical music"]`: specialties are free text typed by admins. */
export function tidySpecialties(list: readonly string[] | null | undefined): string[] {
  const out: string[] = []
  for (const raw of list ?? []) {
    const s = raw.trim().replace(/^and\s+/i, '').replace(/[.,;]+$/, '').trim()
    if (!s) continue
    const v = s.charAt(0).toUpperCase() + s.slice(1)
    if (!out.some(o => o.toLowerCase() === v.toLowerCase())) out.push(v)
  }
  return out
}

/** A teacher ready for display: tidy specialties and, without a photo, their initials monogram in the photo slot. */
export function presentTeacher<T extends { name: string; imageUrl: string | null; specialties: string[] }>(t: T): Omit<T, 'imageUrl'> & { imageUrl: string } {
  return { ...t, imageUrl: t.imageUrl || monogramDataUri(t.name), specialties: tidySpecialties(t.specialties) }
}
