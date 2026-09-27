/** A run of inline text; `bold` for `**...**`. */
export interface Run { text: string; bold?: true }
export type PostBlock =
  | { type: 'h2'; runs: Run[] }
  | { type: 'p'; runs: Run[] }
  | { type: 'ol'; items: Run[][] }

/** Split `**bold**` runs out of a line. */
export function parseInline(text: string): Run[] {
  const runs: Run[] = []
  const re = /\*\*(.+?)\*\*/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index) })
    runs.push({ text: m[1], bold: true })
    last = re.lastIndex
  }
  if (last < text.length) runs.push({ text: text.slice(last) })
  return runs.length ? runs : [{ text }]
}

const NUMBERED = /^\d+\.\s/

/**
 * The blog's plain-text body format (the same rules the post page has always used):
 * `## ` lines are headings, runs of `1. ` lines are ordered lists, every other
 * non-blank line is a paragraph.
 */
export function parsePostBody(content: string): PostBlock[] {
  const lines = content.split('\n')
  const blocks: PostBlock[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    if (line === '') { i++; continue }
    if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', runs: parseInline(line.replace(/^##\s+/, '')) })
      i++
      continue
    }
    if (NUMBERED.test(line)) {
      const items: Run[][] = []
      while (i < lines.length && NUMBERED.test(lines[i].trim())) {
        items.push(parseInline(lines[i].trim().replace(/^\d+\.\s+/, '')))
        i++
      }
      blocks.push({ type: 'ol', items })
      continue
    }
    blocks.push({ type: 'p', runs: parseInline(lines[i]) })
    i++
  }
  return blocks
}

/** Rough reading time: one minute per thousand characters, at least one. */
export function readingMinutes(content: string | null | undefined): number {
  return Math.max(1, Math.ceil((content ?? '').length / 1000))
}

/** Distinct non-empty categories, in the order they first appear. */
export function postCategories(posts: readonly { category: string | null }[]): string[] {
  const seen: string[] = []
  for (const p of posts) if (p.category && !seen.includes(p.category)) seen.push(p.category)
  return seen
}
