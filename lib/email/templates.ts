const SITE_URL = 'https://latinmusicmastery.com'
const BRAND_NAME = 'Latin Music Mastery'
const LOGO_URL = `${SITE_URL}/lmm-horizontal-logo.png`
// Solid brand color (warm amber). Kept solid — Outlook ignores CSS gradients.
const BRAND_COLOR = '#D8943C'

export interface BrandedEmailInput {
  subject: string
  /** Plain text from the admin. Paragraph breaks via blank lines. */
  body: string
  /** Optional hero/header image shown at the top of the email. Absolute https URL. */
  imageUrl?: string
  /** Optional signature appended below the body. Plain text, blank-line paragraphs. */
  signature?: string
}

export interface BrandedEmail {
  html: string
  text: string
}

export function wrapBrandedEmail({ subject, body, imageUrl, signature }: BrandedEmailInput): BrandedEmail {
  const safeImageUrl = sanitizeImageUrl(imageUrl)
  const sig = (signature ?? '').trim()
  const html = renderHtml({ subject, body, imageUrl: safeImageUrl, signature: sig })
  const text = renderText(body, sig)
  return { html, text }
}

function renderHtml({
  subject,
  body,
  imageUrl,
  signature,
}: {
  subject: string
  body: string
  imageUrl: string | null
  signature: string
}): string {
  const bodyHtml = renderParagraphs(body, '#1f2937', '15px')

  const heroHtml = imageUrl
    ? `<tr>
              <td style="padding:0;">
                <img src="${escapeHtml(imageUrl)}" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />
              </td>
            </tr>`
    : ''

  const signatureHtml = signature
    ? `<tr>
              <td style="padding:4px 32px 28px 32px;">
                <div style="border-top:1px solid #e5e7eb;padding-top:20px;">
                  ${renderParagraphs(signature, '#374151', '14px')}
                </div>
              </td>
            </tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
            <tr>
              <td style="height:4px;line-height:4px;font-size:0;background:${BRAND_COLOR};">&nbsp;</td>
            </tr>
            <tr>
              <td align="center" style="padding:28px 32px 24px 32px;border-bottom:1px solid #f0f0f0;">
                <a href="${SITE_URL}" style="text-decoration:none;display:inline-block;">
                  <img src="${LOGO_URL}" alt="${BRAND_NAME}" width="220" style="display:block;width:220px;max-width:60%;height:auto;border:0;" />
                </a>
              </td>
            </tr>
            ${heroHtml}
            <tr>
              <td style="padding:32px 32px ${signature ? '8px' : '32px'} 32px;">
                ${bodyHtml}
              </td>
            </tr>
            ${signatureHtml}
            <tr>
              <td style="padding:20px 32px 28px 32px;border-top:1px solid #e5e7eb;background:#fafafa;">
                <p style="margin:0 0 6px 0;font-size:12px;color:#6b7280;line-height:1.5;">You received this email because you joined the ${BRAND_NAME} waitlist.</p>
                <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.5;"><a href="${SITE_URL}" style="color:#6b7280;text-decoration:underline;">${SITE_URL.replace(/^https?:\/\//, '')}</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function renderParagraphs(text: string, color: string, fontSize: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 16px 0;line-height:1.6;color:${color};font-size:${fontSize};">${linkify(escapeHtml(p)).replace(/\n/g, '<br />')}</p>`
    )
    .join('')
}

function renderText(body: string, signature: string): string {
  const sigBlock = signature ? `\n\n${signature.trim()}` : ''
  return `${body.trim()}${sigBlock}\n\n—\nYou received this email because you joined the ${BRAND_NAME} waitlist.\n${SITE_URL}\n`
}

/** Only allow absolute https URLs as image sources; anything else is dropped. */
function sanitizeImageUrl(url?: string): string | null {
  const trimmed = (url ?? '').trim()
  if (!trimmed) return null
  return /^https:\/\/\S+$/i.test(trimmed) ? trimmed : null
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function linkify(escaped: string): string {
  // Operates on already-escaped text; matches http(s) URLs up to whitespace or common trailing punctuation.
  return escaped.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, (url) => {
    return `<a href="${url}" style="color:#2563eb;text-decoration:underline;">${url}</a>`
  })
}
