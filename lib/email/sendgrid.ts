import sgMail from '@sendgrid/mail'

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'support@latinmusicmastery.com'
const FROM_NAME = process.env.SENDGRID_FROM_NAME || 'Latin Music Mastery'

// SendGrid caps personalizations at 1000 per request.
const MAX_PERSONALIZATIONS_PER_REQUEST = 1000

let initialized = false
function ensureInitialized() {
  if (initialized) return
  const apiKey = process.env.SENDGRID_API_KEY
  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY is not set')
  }
  sgMail.setApiKey(apiKey)
  initialized = true
}

export interface SendEmailInput {
  to: string[]
  subject: string
  html: string
  text: string
}

export interface SendEmailResult {
  sent: number
  failed: number
  errors: { email: string; reason: string }[]
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  ensureInitialized()

  const recipients = Array.from(new Set(input.to.map((e) => e.trim()).filter(Boolean)))

  if (recipients.length === 0) {
    return { sent: 0, failed: 0, errors: [] }
  }

  const result: SendEmailResult = { sent: 0, failed: 0, errors: [] }

  for (let i = 0; i < recipients.length; i += MAX_PERSONALIZATIONS_PER_REQUEST) {
    const batch = recipients.slice(i, i + MAX_PERSONALIZATIONS_PER_REQUEST)

    console.log('[sendgrid] sending', {
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      recipients: batch,
      subject: input.subject,
      subjectLength: input.subject.length,
      textLength: input.text.length,
      htmlLength: input.html.length,
    })

    try {
      const response = await sgMail.send({
        from: { email: FROM_EMAIL, name: FROM_NAME },
        subject: input.subject,
        html: input.html,
        text: input.text,
        // Each personalization gets its own `to` so recipients never see each other.
        personalizations: batch.map((email) => ({ to: [{ email }] })),
      })
      const first = Array.isArray(response) ? response[0] : response
      console.log('[sendgrid] response', {
        statusCode: first?.statusCode,
        messageId: first?.headers?.['x-message-id'],
      })
      result.sent += batch.length
    } catch (err) {
      const reason = extractSendGridError(err)
      console.error('[sendgrid] batch send failed', { batchSize: batch.length, reason })
      result.failed += batch.length
      for (const email of batch) {
        result.errors.push({ email, reason })
      }
    }
  }

  return result
}

function extractSendGridError(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const anyErr = err as {
      response?: { body?: { errors?: { message?: string }[] } }
      message?: string
    }
    const sgErrors = anyErr.response?.body?.errors
    if (sgErrors && sgErrors.length > 0) {
      return sgErrors.map((e) => e.message ?? 'unknown').join('; ')
    }
    if (anyErr.message) return anyErr.message
  }
  return String(err)
}
