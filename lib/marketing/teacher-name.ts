/** Split `Patricio "el chino" Diaz` into its parts so the nickname can be set in the serif accent. */
export function splitNickname(name: string): { before: string; nickname: string | null; after: string } {
  const m = name.match(/^(.*?)\s*["“]([^"”]+)["”]\s*(.*)$/)
  if (!m) return { before: name, nickname: null, after: '' }
  const nickname = m[2].trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  return { before: m[1].trim(), nickname, after: m[3].trim() }
}
