'use server'

import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/sendgrid'
import { wrapBrandedEmail } from '@/lib/email/templates'
import { sanitizeEmailHtml, emailHtmlToText } from '@/lib/email/sanitize-email-html'

export type SendWaitlistEmailInput = {
  mode: 'single' | 'selected' | 'all'
  ids?: string[]
  subject: string
  /** Email body as HTML from the WYSIWYG composer. */
  body: string
  signature?: string
}

const SIGNATURE_MAX = 2000
const BODY_HTML_MAX = 100000
const BODY_TEXT_MAX = 20000

export type SendWaitlistEmailResult =
  | { success: true; count: number; failed: number }
  | { error: string }

export async function sendWaitlistEmail(
  input: SendWaitlistEmailInput
): Promise<SendWaitlistEmailResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return { error: 'Unauthorized' }
  }

  const subject = (input.subject ?? '').trim()
  const rawBody = (input.body ?? '').trim()
  const signature = (input.signature ?? '').trim()

  if (subject.length < 1 || subject.length > 200) {
    return { error: 'Subject must be between 1 and 200 characters.' }
  }
  if (rawBody.length > BODY_HTML_MAX) {
    return { error: 'Message is too long.' }
  }
  if (signature.length > SIGNATURE_MAX) {
    return { error: `Signature must be ${SIGNATURE_MAX} characters or fewer.` }
  }

  // Sanitize the WYSIWYG HTML and inline-style it for email clients.
  const bodyHtml = sanitizeEmailHtml(rawBody)
  const bodyText = emailHtmlToText(bodyHtml)
  if (bodyText.length < 1) {
    return { error: 'Message cannot be empty.' }
  }
  if (bodyText.length > BODY_TEXT_MAX) {
    return { error: 'Message is too long.' }
  }

  if (input.mode === 'single' || input.mode === 'selected') {
    if (!input.ids || input.ids.length === 0) {
      return { error: 'No recipients selected.' }
    }
    if (input.mode === 'single' && input.ids.length !== 1) {
      return { error: 'Single mode requires exactly one recipient.' }
    }
  }

  let query = supabase.from('waitlist').select('email')
  if (input.mode === 'single' || input.mode === 'selected') {
    query = query.in('id', input.ids!)
  }

  const { data: rows, error: fetchError } = await query

  if (fetchError) {
    return { error: 'Failed to load recipients.' }
  }

  const recipients = (rows ?? [])
    .map((r) => r.email)
    .filter((e): e is string => typeof e === 'string' && e.length > 0)

  if (recipients.length === 0) {
    return { error: 'No matching waitlist recipients found.' }
  }

  const { html, text } = wrapBrandedEmail({
    subject,
    bodyHtml,
    signature: signature || undefined,
  })

  try {
    const result = await sendEmail({
      to: recipients,
      subject,
      html,
      text,
    })

    if (result.sent === 0) {
      return { error: 'Failed to send. Please check the SendGrid configuration.' }
    }

    return { success: true, count: result.sent, failed: result.failed }
  } catch (err) {
    console.error('[sendWaitlistEmail] send failed', err)
    return { error: 'Failed to send. Please try again.' }
  }
}
