'use server'

import { createClient } from '@/lib/supabase/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EXPERTISE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const

export async function joinWaitlist(formData: FormData) {
  const email = formData.get('email') as string

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Please enter a valid email address.' }
  }

  const instrumentIds = (formData.getAll('instrument_ids') as string[]).filter(
    (v) => UUID_RE.test(v)
  )
  const styleIds = (formData.getAll('style_ids') as string[]).filter((v) =>
    UUID_RE.test(v)
  )
  const rawLevel = (formData.get('expertise_level') as string) || ''
  const expertiseLevel = (EXPERTISE_LEVELS as readonly string[]).includes(rawLevel)
    ? (rawLevel as (typeof EXPERTISE_LEVELS)[number])
    : null

  const supabase = await createClient()

  const { error } = await supabase.from('waitlist').insert({
    email,
    instrument_ids: instrumentIds,
    style_ids: styleIds,
    expertise_level: expertiseLevel,
  })

  if (error) {
    if (error.code === '23505') {
      return { error: "You're already on the waiting list!" }
    }
    return { error: 'Something went wrong. Please try again.' }
  }

  return { success: true }
}
