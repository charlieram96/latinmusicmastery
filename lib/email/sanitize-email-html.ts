import sanitizeHtml from 'sanitize-html'

// On-brand colors (kept solid — Outlook ignores gradients).
const BODY_COLOR = '#374151'
const HEADING_COLOR = '#1f2937'
const LINK_COLOR = '#D8943C'
const QUOTE_BORDER = '#D8943C'
const MUTED_COLOR = '#6b7280'

// Inline styles injected per tag so the WYSIWYG output renders consistently in
// email clients (Gmail/Outlook strip <style> blocks and CSS classes).
const TAG_STYLES: Record<string, string> = {
  p: `margin:0 0 16px 0;line-height:1.65;color:${BODY_COLOR};font-size:16px;`,
  h1: `margin:24px 0 12px 0;line-height:1.3;color:${HEADING_COLOR};font-size:22px;font-weight:700;`,
  h2: `margin:22px 0 10px 0;line-height:1.3;color:${HEADING_COLOR};font-size:19px;font-weight:700;`,
  h3: `margin:18px 0 8px 0;line-height:1.35;color:${HEADING_COLOR};font-size:16px;font-weight:700;`,
  ul: `margin:0 0 16px 0;padding-left:24px;color:${BODY_COLOR};font-size:16px;line-height:1.65;`,
  ol: `margin:0 0 16px 0;padding-left:24px;color:${BODY_COLOR};font-size:16px;line-height:1.65;`,
  li: `margin:0 0 6px 0;`,
  blockquote: `margin:0 0 16px 0;padding:4px 0 4px 16px;border-left:3px solid ${QUOTE_BORDER};color:${MUTED_COLOR};font-style:italic;`,
}

function styledTag(tagName: string): sanitizeHtml.Transformer {
  return () => ({ tagName, attribs: { style: TAG_STYLES[tagName] } })
}

const transformTags: Record<string, sanitizeHtml.Transformer> = {
  p: styledTag('p'),
  h1: styledTag('h1'),
  h2: styledTag('h2'),
  h3: styledTag('h3'),
  ul: styledTag('ul'),
  ol: styledTag('ol'),
  li: styledTag('li'),
  blockquote: styledTag('blockquote'),
  // Links: keep only href, force a safe target + on-brand styling.
  a: (_tagName, attribs) => ({
    tagName: 'a',
    attribs: {
      href: attribs.href ?? '',
      target: '_blank',
      rel: 'noopener noreferrer',
      style: `color:${LINK_COLOR};text-decoration:underline;`,
    },
  }),
}

/**
 * Sanitize WYSIWYG (Tiptap) HTML and inject email-safe inline styles.
 * Drops everything outside the allowlist (scripts, classes, pasted styles,
 * event handlers) and rebuilds the allowed tags with our own inline styles.
 */
export function sanitizeEmailHtml(html: string): string {
  if (!html) return ''
  return sanitizeHtml(html, {
    allowedTags: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
      'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'blockquote', 'span',
    ],
    // `style` is only retained where transformTags re-adds it, so pasted inline
    // styles on other tags are stripped.
    allowedAttributes: {
      a: ['href', 'target', 'rel', 'style'],
      p: ['style'],
      h1: ['style'], h2: ['style'], h3: ['style'],
      ul: ['style'], ol: ['style'], li: ['style'],
      blockquote: ['style'],
    },
    allowedSchemes: ['https', 'mailto'],
    allowProtocolRelative: false,
    transformTags,
  }).trim()
}

/** Plain-text fallback derived from the sanitized HTML. */
export function emailHtmlToText(html: string): string {
  if (!html) return ''
  let text = html
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/(p|h1|h2|h3|li|ul|ol|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')

  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&')

  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
