/** Remove editorial language prefixes, never language names inside prose. */
export function stripLanguageLabels(text: string): string {
  return text.replace(/^[\t ]*(?:English|Spanish|Español|Ingl[eé]s)[\t ]*:[\t ]*/gim, '')
}

/** Preserve rich-text marks and media while removing prefixes across text runs. */
export function stripRichLanguageLabels(document: Record<string, unknown>): Record<string, unknown> {
  const visit = (node: Record<string, unknown>): Record<string, unknown> => {
    if (!Array.isArray(node.content)) return node
    let content = node.content.map(child => visit(child as Record<string, unknown>))
    if (node.type === 'paragraph' || node.type === 'heading') {
      const text = content.map(child => typeof child.text === 'string' ? child.text : '\uFFFC').join('')
      const prefix = text.match(/^[\t ]*(?:English|Spanish|Español|Ingl[eé]s)[\t ]*:[\t ]*/i)
      let remaining = prefix?.[0].length ?? 0
      content = content.map(child => {
        if (!remaining || typeof child.text !== 'string') return child
        const count = Math.min(remaining, child.text.length)
        remaining -= count
        return { ...child, text: child.text.slice(count) }
      }).filter(child => child.type !== 'text' || child.text !== '')
    }
    return { ...node, content }
  }
  return visit(document)
}
