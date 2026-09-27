/** Split a display title so its last word can be set in the serif accent. One word is all accent. */
export function splitTitleAccent(text: string): { lead: string; accent: string } {
  const words = text.trim().split(/\s+/)
  if (words.length < 2) return { lead: '', accent: words[0] ?? '' }
  return { lead: words.slice(0, -1).join(' '), accent: words[words.length - 1] }
}
