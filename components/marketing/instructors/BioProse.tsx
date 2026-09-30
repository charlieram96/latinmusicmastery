import { Fragment, type ReactNode } from 'react'

/**
 * Read-only render of a teacher bio stored as TipTap JSON, on the server,
 * without mounting an editor. Headings are demoted one level because the
 * teacher's name is the page's h1. Unknown nodes fall through to their
 * children so new editor features never blank a bio.
 */
type Mark = { type?: string; attrs?: { href?: unknown } }
type Node = { type?: string; text?: string; attrs?: { level?: unknown }; content?: unknown[]; marks?: Mark[] }

const SAFE_HREF = /^(https?:|mailto:)/i

/** True when a TipTap node holds any visible text (an editor-cleared doc does not). */
export function hasText(n: Node | unknown): boolean {
  if (!n || typeof n !== 'object') return false
  return nodeHasText(n as Node)
}

function nodeHasText(n: Node): boolean {
  if (typeof n.text === 'string') return n.text.trim().length > 0
  return Array.isArray(n.content) && n.content.some(c => c && typeof c === 'object' && nodeHasText(c as Node))
}

function renderText(n: Node): ReactNode {
  if (typeof n.text !== 'string') return null
  let out: ReactNode = n.text
  for (const m of n.marks ?? []) {
    if (m.type === 'bold') out = <strong>{out}</strong>
    else if (m.type === 'italic') out = <em>{out}</em>
    else if (m.type === 'strike') out = <s>{out}</s>
    else if (m.type === 'code') out = <code>{out}</code>
    else if (m.type === 'link' && typeof m.attrs?.href === 'string' && SAFE_HREF.test(m.attrs.href)) {
      out = <a href={m.attrs.href} target="_blank" rel="noopener noreferrer nofollow">{out}</a>
    }
  }
  return out
}

function renderNodes(nodes: unknown[] | undefined): ReactNode {
  if (!Array.isArray(nodes)) return null
  return nodes.map((c, i) => <Fragment key={i}>{renderNode(c)}</Fragment>)
}

function renderNode(raw: unknown): ReactNode {
  if (!raw || typeof raw !== 'object') return null
  const n = raw as Node
  const kids = () => renderNodes(n.content)
  switch (n.type) {
    case 'text': return renderText(n)
    case 'hardBreak': return <br />
    case 'horizontalRule': return <hr />
    case 'paragraph': return hasText(n) ? <p>{kids()}</p> : null
    case 'heading': {
      if (!hasText(n)) return null
      const level = typeof n.attrs?.level === 'number' ? n.attrs.level : 2
      const Tag = (['h2', 'h3', 'h4', 'h5'] as const)[Math.min(Math.max(level, 1), 4) - 1]
      return <Tag>{kids()}</Tag>
    }
    case 'bulletList': return <ul>{kids()}</ul>
    case 'orderedList': return <ol>{kids()}</ol>
    case 'listItem': return hasText(n) ? <li>{kids()}</li> : null
    case 'blockquote': return <blockquote>{kids()}</blockquote>
    default: return kids()
  }
}

function plain(n: Node): string {
  if (typeof n.text === 'string') return n.text
  return Array.isArray(n.content) ? n.content.map(c => (c && typeof c === 'object' ? plain(c as Node) : '')).join('') : ''
}

const WRAPPED_LINE_MIN = 60
const ENDS_SENTENCE = /[.!?:;”"’')\]]\s*$/

/**
 * Some bios were pasted from PDFs, one paragraph per printed line. Rejoin a
 * top-level paragraph with the next one when it is line-length and stops
 * mid-sentence, so the text reads as prose. Short lines (titles, names) and
 * finished sentences are left alone.
 */
export function reflowParagraphs(doc: unknown): unknown {
  if (!doc || typeof doc !== 'object') return doc
  const d = doc as Node
  if (!Array.isArray(d.content)) return doc
  const out: unknown[] = []
  for (const raw of d.content) {
    const n = raw as Node
    const prev = out[out.length - 1] as Node | undefined
    const prevText = prev?.type === 'paragraph' ? plain(prev).trim() : ''
    if (n?.type === 'paragraph' && hasText(n) && prev && prevText.length >= WRAPPED_LINE_MIN && !ENDS_SENTENCE.test(prevText)) {
      out[out.length - 1] = { ...prev, content: [...(prev.content ?? []), { type: 'text', text: ' ' }, ...(n.content ?? [])] }
    } else {
      out.push(raw)
    }
  }
  return { ...d, content: out }
}

export function BioProse({ doc }: { doc: unknown }) {
  if (!hasText(doc)) return null
  return <>{renderNode(reflowParagraphs(doc))}</>
}
