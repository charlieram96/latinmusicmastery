type Node = { type?: string; text?: string; content?: Node[]; marks?: { type?: string }[] }

const MIN_WORDS = 8

function textOf(n: Node): string {
  if (typeof n.text === 'string') return n.text
  return (n.content ?? []).map(textOf).join('')
}
const allBold = (n: Node) => {
  const texts = (n.content ?? []).filter(c => typeof c.text === 'string' && c.text.trim())
  return texts.length > 0 && texts.every(c => c.marks?.some(m => m.type === 'bold'))
}

/**
 * A short plain-text excerpt of a TipTap bio for cards. Teacher bios open with
 * headings, bold name lines and labels, so the excerpt starts at the first
 * real sentence-length paragraph and keeps going (bios are often hard-wrapped
 * into one paragraph per line) until `max` characters.
 */
export function bioExcerpt(doc: unknown, max = 220): string {
  if (!doc || typeof doc !== 'object') return ''
  const blocks = ((doc as Node).content ?? []).filter(n => n.type === 'paragraph')
  const start = blocks.findIndex(n => !allBold(n) && textOf(n).trim().split(/\s+/).length >= MIN_WORDS)
  if (start < 0) return ''
  let out = ''
  for (const n of blocks.slice(start)) {
    const t = textOf(n).replace(/\s+/g, ' ').trim()
    if (!t) continue
    out = out ? `${out} ${t}` : t
    if (out.length >= max) break
  }
  if (out.length <= max) return out
  const cut = out.slice(0, max + 1)
  const at = cut.lastIndexOf(' ')
  return `${(at > 0 ? cut.slice(0, at) : out.slice(0, max)).replace(/[\s,;:.]+$/, '')}…`
}
