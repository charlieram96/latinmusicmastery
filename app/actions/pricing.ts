'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { PricingKey } from '@/lib/payments/pricing-types'

const KEYS: PricingKey[] = ['base_monthly', 'base_annual', 'addon_monthly']

/**
 * Updates one or more pricing rows. The form may post any subset of the three
 * known keys; each posted key is updated as one row. Re-checks admin on the
 * server (defence in depth alongside the RLS policy).
 */
export async function updatePricing(formData: FormData): Promise<{ error?: string; success?: true }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) return { error: 'Forbidden' }

  for (const key of KEYS) {
    const dollarsRaw = formData.get(`${key}.dollars`)
    const stripePriceIdRaw = formData.get(`${key}.stripe_price_id`)
    const descriptionRaw = formData.get(`${key}.description`)

    // Skip keys that weren't included in this submission.
    if (dollarsRaw === null && stripePriceIdRaw === null && descriptionRaw === null) continue

    const dollars = parseFloat(String(dollarsRaw ?? '0'))
    if (!Number.isFinite(dollars) || dollars < 0) {
      return { error: `Invalid price for ${key}` }
    }
    const amount_cents = Math.round(dollars * 100)

    const { error } = await supabase
      .from('pricing')
      .update({
        amount_cents,
        stripe_price_id: String(stripePriceIdRaw ?? '').trim(),
        description: descriptionRaw ? String(descriptionRaw) : null,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('key', key)

    if (error) return { error: `${key}: ${error.message}` }
  }

  // Public-facing surfaces that show prices.
  revalidatePath('/admin/pricing')
  revalidatePath('/pricing')
  revalidatePath('/')
  revalidatePath('/dashboard/subscribe')
  return { success: true }
}
