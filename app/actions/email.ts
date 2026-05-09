'use server'

import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/sendgrid'
import { wrapBrandedEmail } from '@/lib/email/templates'

export type SendWaitlistEmailInput = {
  mode: 'single' | 'selected' | 'all'
  ids?: string[]
  subject: string
  body: string
}

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
  const body = (input.body ?? '').trim()

  if (subject.length < 1 || subject.length > 200) {
    return { error: 'Subject must be between 1 and 200 characters.' }
  }
  if (body.length < 1 || body.length > 20000) {
    return { error: 'Body must be between 1 and 20000 characters.' }
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

  const { html, text } = wrapBrandedEmail({ subject, body })

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
