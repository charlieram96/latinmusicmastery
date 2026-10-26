// Order lifecycle on the service-role client: load, fulfil (idempotent),
// deliver by email, expire and refund. Callers authorise the request first
// (Stripe signature, admin check, or the order's secret access token).

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/sendgrid'
import { generateSecret, generateTicketNumber } from './codes'
import { seatPlan } from './checkout'
import { buildOrderPdf, ticketsFilename } from './render'
import { composeOrderEmail } from './email'
import { isFulfilledStatus, type OrderBundle, type TicketOrder } from './types'

type Admin = ReturnType<typeof getSupabaseAdmin>

export async function loadOrderBundle(
  admin: Admin,
  where: { id: string } | { accessToken: string },
): Promise<OrderBundle | null> {
  const base = admin.from('ticket_orders').select('*')
  const { data: order } = await ('id' in where ? base.eq('id', where.id) : base.eq('access_token', where.accessToken)).maybeSingle()
  if (!order) return null
  const [eventRes, itemsRes, ticketsRes] = await Promise.all([
    admin.from('ticketed_events').select('*').eq('id', order.event_id).single(),
    admin.from('ticket_order_items').select('*, tier:ticket_tiers(*)').eq('order_id', order.id),
    admin.from('tickets').select('*, tier:ticket_tiers(*)').eq('order_id', order.id).order('seq'),
  ])
  if (!eventRes.data) return null
  return {
    order,
    event: eventRes.data,
    items: (itemsRes.data ?? []) as OrderBundle['items'],
    tickets: (ticketsRes.data ?? []) as OrderBundle['tickets'],
  }
}

/**
 * Mark a Stripe order paid. Returns the order when this call (or an earlier
 * one) left it paid; null when it is unknown or was refunded meanwhile.
 */
export async function markOrderPaid(
  admin: Admin,
  orderId: string,
  details: { paymentIntentId?: string | null; amountTotal?: number | null },
): Promise<TicketOrder | null> {
  const now = new Date().toISOString()
  const { data: updated } = await admin
    .from('ticket_orders')
    .update({
      status: 'paid',
      paid_at: now,
      updated_at: now,
      ...(details.paymentIntentId ? { stripe_payment_intent_id: details.paymentIntentId } : {}),
      ...(typeof details.amountTotal === 'number' ? { amount_total_cents: details.amountTotal } : {}),
    })
    .eq('id', orderId)
    // Expired/cancelled holds are still honoured: the buyer paid.
    .in('status', ['pending', 'expired', 'cancelled'])
    .select('*')
    .maybeSingle()
  if (updated) return updated
  const { data: current } = await admin.from('ticket_orders').select('*').eq('id', orderId).maybeSingle()
  return current && isFulfilledStatus(current.status) ? current : null
}

/** Create any missing tickets for a paid/comp order (safe to repeat). */
export async function ensureTickets(admin: Admin, orderId: string): Promise<void> {
  const bundle = await loadOrderBundle(admin, { id: orderId })
  if (!bundle || !isFulfilledStatus(bundle.order.status)) return
  const have = new Set(bundle.tickets.map((t) => t.seq))
  const missing = seatPlan(bundle.items).filter((s) => !have.has(s.seq))
  for (let attempt = 0; missing.length > 0 && attempt < 3; attempt++) {
    const rows = missing.map((s) => ({
      order_id: bundle.order.id,
      event_id: bundle.order.event_id,
      tier_id: s.tierId,
      seq: s.seq,
      ticket_number: generateTicketNumber(),
      code: generateSecret(),
      attendee_name: bundle.order.buyer_name,
    }))
    // (order_id, seq) conflicts mean a concurrent delivery already issued it.
    const { error } = await admin.from('tickets').upsert(rows, { onConflict: 'order_id,seq', ignoreDuplicates: true })
    if (!error) return
    // 23505 on ticket_number/code: astronomically rare collision, retry fresh.
    if (error.code !== '23505') throw new Error(`ticket insert failed: ${error.message}`)
  }
}

export type DeliveryResult = { ok: true; sent: boolean } | { ok: false; error: string }

/**
 * Email the order's tickets. Without `force`, only one caller sends: it claims
 * email_status pending/failed → sending (a failed attempt is retried by the
 * next webhook delivery or confirmation); admin resends force it.
 */
export async function deliverOrderEmail(admin: Admin, orderId: string, { force = false } = {}): Promise<DeliveryResult> {
  if (!force) {
    const { data: claimed } = await admin
      .from('ticket_orders')
      .update({ email_status: 'sending', updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .in('email_status', ['pending', 'failed'])
      .select('id')
      .maybeSingle()
    if (!claimed) return { ok: true, sent: false }
  }

  const finish = async (fields: Partial<TicketOrder>) => {
    await admin.from('ticket_orders').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', orderId)
  }

  try {
    const bundle = await loadOrderBundle(admin, { id: orderId })
    if (!bundle || !isFulfilledStatus(bundle.order.status)) {
      await finish({ email_status: 'failed', email_error: 'Order is not paid' })
      return { ok: false, error: 'Order is not paid' }
    }
    if (!bundle.tickets.some((t) => t.status !== 'void')) {
      await finish({ email_status: 'failed', email_error: 'Order has no valid tickets' })
      return { ok: false, error: 'Order has no valid tickets' }
    }
    const pdf = await buildOrderPdf(bundle)
    const { subject, html, text } = composeOrderEmail(bundle)
    const result = await sendEmail({
      to: [bundle.order.buyer_email],
      subject,
      html,
      text,
      attachments: [{ content: Buffer.from(pdf).toString('base64'), filename: ticketsFilename(bundle.event), type: 'application/pdf' }],
    })
    if (result.sent === 0) {
      const reason = result.errors[0]?.reason ?? 'Email was not accepted'
      await finish({ email_status: 'failed', email_error: reason.slice(0, 500) })
      return { ok: false, error: reason }
    }
    await finish({ email_status: 'sent', email_sent_at: new Date().toISOString(), email_error: null })
    return { ok: true, sent: true }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    console.error('[tickets] email delivery failed', orderId, reason)
    await finish({ email_status: 'failed', email_error: reason.slice(0, 500) })
    return { ok: false, error: reason }
  }
}

/** Paid → tickets → email. Used by the webhook and the confirmation page. */
export async function fulfillPaidOrder(
  admin: Admin,
  orderId: string,
  details: { paymentIntentId?: string | null; amountTotal?: number | null },
): Promise<TicketOrder | null> {
  const order = await markOrderPaid(admin, orderId, details)
  if (!order) return null
  await ensureTickets(admin, orderId)
  return order
}

export async function expirePendingOrder(admin: Admin, orderId: string): Promise<void> {
  const now = new Date().toISOString()
  await admin
    .from('ticket_orders')
    .update({ status: 'expired', expires_at: now, updated_at: now })
    .eq('id', orderId)
    .eq('status', 'pending')
}

/** Full refund in Stripe → order refunded, its tickets void (no longer admit). */
export async function refundOrderByPaymentIntent(admin: Admin, paymentIntentId: string): Promise<boolean> {
  const now = new Date().toISOString()
  const { data: order } = await admin
    .from('ticket_orders')
    .update({ status: 'refunded', refunded_at: now, updated_at: now })
    .eq('stripe_payment_intent_id', paymentIntentId)
    .in('status', ['paid', 'pending', 'expired', 'cancelled'])
    .select('id')
    .maybeSingle()
  if (!order) return false
  await admin.from('tickets').update({ status: 'void', voided_at: now }).eq('order_id', order.id).neq('status', 'void')
  return true
}

