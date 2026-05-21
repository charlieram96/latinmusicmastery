import { emailHtmlToText } from './sanitize-email-html'

const SITE_URL = 'https://latinmusicmastery.com'
const BRAND_NAME = 'Latin Music Mastery'
const LOGO_URL = `${SITE_URL}/lmm-horizontal-logo.png`
const CONTACT_EMAIL = 'support@latinmusicmastery.com'
// Solid brand colors — Outlook ignores CSS gradients.
const BRAND_AMBER = '#D8943C'
const BRAND_TERRACOTTA = '#BB5A3C'

export interface BrandedEmailInput {
  subject: string
  /** Email body as sanitized, inline-styled HTML (from the WYSIWYG composer). */
  bodyHtml: string
  /** Optional signature appended below the body. Plain text, blank-line paragraphs. */
  signature?: string
}

export interface BrandedEmail {
  html: string
  text: string
}

export function wrapBrandedEmail({ subject, bodyHtml, signature }: BrandedEmailInput): BrandedEmail {
  const sig = (signature ?? '').trim()
  const html = renderHtml({ subject, bodyHtml, signature: sig })
  const text = renderText(bodyHtml, sig)
  return { html, text }
}

function renderHtml({
  subject,
  bodyHtml,
  signature,
}: {
  subject: string
  bodyHtml: string
  signature: string
}): string {
  const signatureHtml = signature
    ? `<tr>
              <td style="padding:0 32px 28px 32px;">
                <div style="border-top:1px solid #e5e7eb;padding-top:18px;">
                  ${renderParagraphs(signature, '#4b5563', '14px')}
                </div>
              </td>
            </tr>`
    : ''

  const siteHost = SITE_URL.replace(/^https?:\/\//, '')

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3ede6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3ede6;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(31,24,25,0.08);">
            <tr>
              <td align="center" style="padding:36px 32px 18px 32px;">
                <a href="${SITE_URL}" style="text-decoration:none;display:inline-block;">
                  <img src="${LOGO_URL}" alt="${BRAND_NAME}" width="190" style="display:block;width:190px;max-width:70%;height:auto;border:0;" />
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px;">
                <div style="height:2px;line-height:2px;font-size:0;background:${BRAND_AMBER};">&nbsp;</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 8px 32px;">
                ${bodyHtml}
              </td>
            </tr>
            ${signatureHtml}
            <tr>
              <td style="padding:24px 32px 26px 32px;background:${BRAND_TERRACOTTA};">
                <p style="margin:0 0 6px 0;font-size:13px;color:#ffffff;line-height:1.6;">
                  <a href="mailto:${CONTACT_EMAIL}" style="color:#ffffff;text-decoration:underline;">${CONTACT_EMAIL}</a>
                  &nbsp;&nbsp;·&nbsp;&nbsp;
                  <a href="${SITE_URL}" style="color:#ffffff;text-decoration:underline;">${siteHost}</a>
                </p>
                <p style="margin:0 0 4px 0;font-size:12px;color:rgba(255,255,255,0.85);line-height:1.5;">You received this email because you joined the ${BRAND_NAME} waitlist.</p>
                <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.85);line-height:1.5;">© ${new Date().getFullYear()} ${BRAND_NAME}</p>
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
        `<p style="margin:0 0 12px 0;line-height:1.6;color:${color};font-size:${fontSize};">${linkify(escapeHtml(p)).replace(/\n/g, '<br />')}</p>`
    )
    .join('')
}

function renderText(bodyHtml: string, signature: string): string {
  const body = emailHtmlToText(bodyHtml)
  const sigBlock = signature ? `\n\n${signature.trim()}` : ''
  return `${body}${sigBlock}\n\n—\n${CONTACT_EMAIL} · ${SITE_URL}\nYou received this email because you joined the ${BRAND_NAME} waitlist.\n`
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
    return `<a href="${url}" style="color:${BRAND_AMBER};text-decoration:underline;">${url}</a>`
  })
}
