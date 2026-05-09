const SITE_URL = 'https://latinmusicmastery.com'
const BRAND_NAME = 'Latin Music Mastery'

export interface BrandedEmailInput {
  subject: string
  /** Plain text from the admin. Paragraph breaks via blank lines. */
  body: string
}

export interface BrandedEmail {
  html: string
  text: string
}

export function wrapBrandedEmail({ subject, body }: BrandedEmailInput): BrandedEmail {
  const html = renderHtml({ subject, body })
  const text = renderText(body)
  return { html, text }
}

function renderHtml({ subject, body }: BrandedEmailInput): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 16px 0;line-height:1.6;color:#1f2937;font-size:15px;">${linkify(escapeHtml(p)).replace(/\n/g, '<br />')}</p>`)
    .join('')

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
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
            <tr>
              <td style="padding:28px 32px 20px 32px;border-bottom:1px solid #e5e7eb;">
                <a href="${SITE_URL}" style="text-decoration:none;color:#111827;font-size:18px;font-weight:700;letter-spacing:-0.01em;">${BRAND_NAME}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                ${paragraphs}
              </td>
            </tr>
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

function renderText(body: string): string {
  return `${body.trim()}\n\n—\nYou received this email because you joined the ${BRAND_NAME} waitlist.\n${SITE_URL}\n`
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
