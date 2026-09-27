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

function hasText(n: Node): boolean {
  if (typeof n.text === 'string') return n.text.trim().length > 0
  return Array.isArray(n.content) && n.content.some(c => c && typeof c === 'object' && hasText(c as Node))
}

function renderText(n: Node): ReactNode {
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

export function BioProse({ doc }: { doc: unknown }) {
  if (!doc || typeof doc !== 'object' || !hasText(doc as Node)) return null
  return <>{renderNode(doc)}</>
}
