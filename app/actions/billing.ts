'use server'

// Per-course subscription lifecycle actions for logged-in users. These mutate
// the user's own subscription only, then sync to Stripe. The webhook keeps the
// DB in lockstep afterward (period ends, cancellations).

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe'
import { getStripePriceId } from '@/lib/payments/pricing-source'

type Result = { error?: string; success?: true }

interface OwnedSub {
  id: string
  instrument: string
  billing_interval: 'month' | 'year'
  stripe_customer_id: string | null
  stripe_base_subscription_id: string | null
  stripe_addon_subscription_id: string | null
  status: string
  genre_count: number
}

async function loadOwnedSubForCourse(userId: string, courseId: string): Promise<{
  course?: { id: string; instrument: string | null; is_fundamentals: boolean; is_published: boolean | null }
  sub?: OwnedSub
  error?: string
}> {
  const supabase = await createClient()

  const { data: course } = await supabase
    .from('courses')
    .select('id, instrument, is_fundamentals, is_published')
    .eq('id', courseId)
    .single()
  if (!course) return { error: 'Course not found' }
  if (course.is_fundamentals) return { error: 'The fundamentals course is included with the base subscription' }
  if (!course.instrument) return { error: 'This course has no instrument; cannot add to an instrument plan' }
  if (course.is_published === false) return { error: 'Course is not available' }

  const { data: subRow } = await supabase
    .from('instrument_subscriptions')
    .select('id, instrument, billing_interval, stripe_customer_id, stripe_base_subscription_id, stripe_addon_subscription_id, status')
    .eq('user_id', userId)
    .eq('instrument', course.instrument)
    .single()
  if (!subRow) {
    return { course, error: 'You do not have an active subscription for this instrument yet.' }
  }

  const { count } = await supabase
    .from('subscription_courses')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('instrument_subscription_id', subRow.id)

  return {
    course,
    sub: {
      id: subRow.id,
      instrument: subRow.instrument,
      billing_interval: subRow.billing_interval as 'month' | 'year',
      stripe_customer_id: subRow.stripe_customer_id,
      stripe_base_subscription_id: subRow.stripe_base_subscription_id,
      stripe_addon_subscription_id: subRow.stripe_addon_subscription_id,
      status: subRow.status,
      genre_count: count ?? 0,
    },
  }
}

/**
 * Add a genre course to the user's existing instrument subscription. Charges
 * +$9.99/mo via Stripe. Two topologies:
 *   - Monthly base: add (or bump) the addon line item on the base subscription.
 *   - Annual base:  ensure a separate monthly addon Stripe subscription exists,
 *                   then add (or bump) its line item.
 */
export async function addCourseToSubscription(courseId: string): Promise<Result> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const loaded = await loadOwnedSubForCourse(user.id, courseId)
  if (loaded.error || !loaded.sub || !loaded.course) return { error: loaded.error ?? 'Subscription not found' }
  const { sub } = loaded

  if (sub.status !== 'active' && sub.status !== 'past_due') {
    return { error: `Subscription is ${sub.status}; cannot add courses` }
  }

  // Already entitled?
  const { data: existing } = await supabase
    .from('subscription_courses')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .maybeSingle()
  if (existing) return { error: 'This course is already on your plan' }

  const addonPriceId = await getStripePriceId('addon_monthly')
  if (!addonPriceId) {
    return { error: 'Add-on price is not configured. Ask an admin to set it in /admin/pricing.' }
  }

  const stripe = getStripe()
  const admin = getSupabaseAdmin()
  // newCount = current entitled genres + 1
  const newCount = sub.genre_count + 1
  // addon qty = (genres - 1); the first genre is free with the base.
  const newAddonQty = Math.max(0, newCount - 1)

  try {
    if (sub.billing_interval === 'month') {
      if (!sub.stripe_base_subscription_id) {
        return { error: 'Subscription is missing its Stripe id; please contact support.' }
      }
      const baseSub = await stripe.subscriptions.retrieve(sub.stripe_base_subscription_id)
      const addonItem = baseSub.items.data.find((i) => i.price?.id === addonPriceId)

      if (addonItem) {
        await stripe.subscriptionItems.update(addonItem.id, { quantity: newAddonQty, proration_behavior: 'create_prorations' })
      } else {
        // newAddonQty must be ≥ 1 here (we just went from 1 → 2 genres).
        await stripe.subscriptionItems.create({
          subscription: sub.stripe_base_subscription_id,
          price: addonPriceId,
          quantity: newAddonQty,
          proration_behavior: 'create_prorations',
        })
      }
    } else {
      // Annual base — add-ons live on a separate monthly subscription.
      if (!sub.stripe_customer_id) {
        return { error: 'Subscription is missing its Stripe customer; please contact support.' }
      }
      if (!sub.stripe_addon_subscription_id) {
        // First add-on for this annual instrument — create the addon sub.
        const addonSub = await stripe.subscriptions.create({
          customer: sub.stripe_customer_id,
          items: [{ price: addonPriceId, quantity: newAddonQty }],
          metadata: {
            flow: 'per_course',
            user_id: user.id,
            instrument: sub.instrument,
            role: 'addon',
          },
        })
        const { error: linkErr } = await admin
          .from('instrument_subscriptions')
          .update({ stripe_addon_subscription_id: addonSub.id, updated_at: new Date().toISOString() })
          .eq('id', sub.id)
        if (linkErr) return { error: `Stripe created but DB link failed: ${linkErr.message}` }
      } else {
        const addonSub = await stripe.subscriptions.retrieve(sub.stripe_addon_subscription_id)
        const addonItem = addonSub.items.data.find((i) => i.price?.id === addonPriceId)
        if (!addonItem) {
          // Defensive: addon sub exists but no item with our price — recreate the item.
          await stripe.subscriptionItems.create({
            subscription: sub.stripe_addon_subscription_id,
            price: addonPriceId,
            quantity: newAddonQty,
            proration_behavior: 'create_prorations',
          })
        } else {
          await stripe.subscriptionItems.update(addonItem.id, { quantity: newAddonQty, proration_behavior: 'create_prorations' })
        }
      }
    }
  } catch (e: any) {
    console.error('[billing.addCourse] Stripe error:', e)
    return { error: e?.message ?? 'Stripe error' }
  }

  // Stripe is now in the desired state — record entitlement.
  const { error: insErr } = await admin
    .from('subscription_courses')
    .insert({
      instrument_subscription_id: sub.id,
      user_id: user.id,
      course_id: courseId,
    })
  if (insErr) {
    // Drift: Stripe charged but DB row missing. Log loudly.
    console.error('[billing.addCourse] DB insert failed AFTER Stripe success:', insErr)
    return { error: `Charged but failed to record entitlement: ${insErr.message}` }
  }

  revalidatePath('/dashboard/subscription')
  revalidatePath(`/dashboard/course/${courseId}`)
  return { success: true }
}

/**
 * Remove a genre course from the user's subscription. Decrements the addon
 * qty in Stripe (and removes/cancels the addon item/sub when qty hits 0).
 * Removing the LAST genre cancels the base subscription at period end —
 * fundamentals access ends with it.
 */
export async function removeCourseFromSubscription(courseId: string): Promise<Result> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const loaded = await loadOwnedSubForCourse(user.id, courseId)
  if (loaded.error || !loaded.sub) return { error: loaded.error ?? 'Subscription not found' }
  const { sub } = loaded

  // Entitlement must exist.
  const { data: entitlement } = await supabase
    .from('subscription_courses')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .maybeSingle()
  if (!entitlement) return { error: 'This course is not on your plan' }

  const newCount = sub.genre_count - 1
  const newAddonQty = Math.max(0, newCount - 1)
  const addonPriceId = await getStripePriceId('addon_monthly')
  const stripe = getStripe()
  const admin = getSupabaseAdmin()

  try {
    if (newCount === 0) {
      // Removing the last genre — cancel the whole instrument at period end.
      if (sub.stripe_base_subscription_id) {
        await stripe.subscriptions.update(sub.stripe_base_subscription_id, { cancel_at_period_end: true })
      }
      if (sub.stripe_addon_subscription_id) {
        // Annual case: also cancel the addon sub at period end.
        await stripe.subscriptions.update(sub.stripe_addon_subscription_id, { cancel_at_period_end: true })
      }
      await admin
        .from('instrument_subscriptions')
        .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
        .eq('id', sub.id)
    } else if (sub.billing_interval === 'month') {
      if (!sub.stripe_base_subscription_id) return { error: 'Subscription is missing its Stripe id.' }
      const baseSub = await stripe.subscriptions.retrieve(sub.stripe_base_subscription_id)
      const addonItem = baseSub.items.data.find((i) => i.price?.id === addonPriceId)
      if (addonItem) {
        if (newAddonQty === 0) {
          await stripe.subscriptionItems.del(addonItem.id, { proration_behavior: 'create_prorations' })
        } else {
          await stripe.subscriptionItems.update(addonItem.id, { quantity: newAddonQty, proration_behavior: 'create_prorations' })
        }
      }
    } else {
      // Annual base — modify the addon sub.
      if (sub.stripe_addon_subscription_id) {
        if (newAddonQty === 0) {
          await stripe.subscriptions.cancel(sub.stripe_addon_subscription_id)
          await admin
            .from('instrument_subscriptions')
            .update({ stripe_addon_subscription_id: null, updated_at: new Date().toISOString() })
            .eq('id', sub.id)
        } else {
          const addonSub = await stripe.subscriptions.retrieve(sub.stripe_addon_subscription_id)
          const addonItem = addonSub.items.data.find((i) => i.price?.id === addonPriceId)
          if (addonItem) {
            await stripe.subscriptionItems.update(addonItem.id, { quantity: newAddonQty, proration_behavior: 'create_prorations' })
          }
        }
      }
    }
  } catch (e: any) {
    console.error('[billing.removeCourse] Stripe error:', e)
    return { error: e?.message ?? 'Stripe error' }
  }

  const { error: delErr } = await admin
    .from('subscription_courses')
    .delete()
    .eq('id', entitlement.id)
  if (delErr) {
    console.error('[billing.removeCourse] DB delete failed AFTER Stripe success:', delErr)
    return { error: `Stripe updated but failed to remove entitlement: ${delErr.message}` }
  }

  revalidatePath('/dashboard/subscription')
  revalidatePath(`/dashboard/course/${courseId}`)
  return { success: true }
}

/**
 * Swap one entitled genre for another within the same instrument — free, no
 * Stripe change. Both course IDs must belong to the user and the same instrument.
 */
export async function swapIncludedGenre(oldCourseId: string, newCourseId: string): Promise<Result> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (oldCourseId === newCourseId) return { error: 'Old and new courses are the same' }

  const { data: old } = await supabase
    .from('courses')
    .select('id, instrument, is_fundamentals')
    .eq('id', oldCourseId)
    .single()
  const { data: nu } = await supabase
    .from('courses')
    .select('id, instrument, is_fundamentals, is_published')
    .eq('id', newCourseId)
    .single()
  if (!old || !nu) return { error: 'Course not found' }
  if (old.is_fundamentals || nu.is_fundamentals) return { error: 'Fundamentals courses cannot be swapped' }
  if (old.instrument !== nu.instrument) return { error: 'Both courses must belong to the same instrument' }
  if (nu.is_published === false) return { error: 'New course is not available' }

  const { data: entitlement } = await supabase
    .from('subscription_courses')
    .select('id, instrument_subscription_id')
    .eq('user_id', user.id)
    .eq('course_id', oldCourseId)
    .maybeSingle()
  if (!entitlement) return { error: 'You do not own the course you tried to swap out' }

  const { data: dupe } = await supabase
    .from('subscription_courses')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', newCourseId)
    .maybeSingle()
  if (dupe) return { error: 'You already own the replacement course' }

  const admin = getSupabaseAdmin()
  const { error } = await admin
    .from('subscription_courses')
    .update({ course_id: newCourseId })
    .eq('id', entitlement.id)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/subscription')
  revalidatePath(`/dashboard/course/${oldCourseId}`)
  revalidatePath(`/dashboard/course/${newCourseId}`)
  return { success: true }
}

/**
 * Cancel an instrument subscription at period end (Stripe).
 * DB rows are updated by the webhook when the cancellation lands.
 */
export async function cancelInstrument(instrument: string): Promise<Result> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: sub } = await supabase
    .from('instrument_subscriptions')
    .select('id, stripe_base_subscription_id, stripe_addon_subscription_id')
    .eq('user_id', user.id)
    .eq('instrument', instrument)
    .single()
  if (!sub) return { error: 'No subscription found for this instrument' }

  const stripe = getStripe()
  const admin = getSupabaseAdmin()

  try {
    if (sub.stripe_base_subscription_id) {
      await stripe.subscriptions.update(sub.stripe_base_subscription_id, { cancel_at_period_end: true })
    }
    if (sub.stripe_addon_subscription_id) {
      await stripe.subscriptions.update(sub.stripe_addon_subscription_id, { cancel_at_period_end: true })
    }
  } catch (e: any) {
    console.error('[billing.cancelInstrument] Stripe error:', e)
    return { error: e?.message ?? 'Stripe error' }
  }

  await admin
    .from('instrument_subscriptions')
    .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
    .eq('id', sub.id)

  revalidatePath('/dashboard/subscription')
  return { success: true }
}
