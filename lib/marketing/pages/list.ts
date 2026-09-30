import type { Locale } from '@/lib/i18n'

/** Spanish writes "e" instead of "y" before an /i/ sound ("i-", "hi-", but not "hie-"/"hia-"). */
function esConjunction(next: string): string {
  const w = next.trim().toLowerCase()
  return /^(i|í|hi|hí)/.test(w) && !/^hi[aeoué]/.test(w) ? 'e' : 'y'
}

/** "A, B and C" / "A, B y C", with no serial comma in either language. */
export function joinNames(names: readonly string[], locale: Locale): string {
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  const last = names[names.length - 1]
  const and = locale === 'es' ? esConjunction(last) : 'and'
  return `${names.slice(0, -1).join(', ')} ${and} ${last}`
}
