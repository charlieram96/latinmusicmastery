'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { normalizeTicketDesign } from '@/lib/tickets/design'
import { generateSecret } from '@/lib/tickets/codes'
import { isValidTimeZone, zonedLocalToUtc } from '@/lib/tickets/format'
import { reserveErrorToCartError } from '@/lib/tickets/checkout'
import { deliverOrderEmail, ensureTickets } from '@/lib/tickets/orders'
import type { Json } from '@/types/database'

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

async function admin() {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return { error: auth.error } as const
  return { supabase, userId: auth.userId } as const
}

function revalidateEvent(id: string, slug?: string | null) {
  revalidatePath('/admin/events')
  revalidatePath(`/admin/events/${id}`)
  revalidatePath('/events')
  if (slug) revalidatePath(`/events/${slug}`)
}

const optionalText = (max: number) =>
  z.string().trim().max(max).transform((v) => (v === '' ? null : v)).nullable().optional().transform((v) => v ?? null)
const slugSchema = z.string().trim().toLowerCase().min(3).max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens.')
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)
const timeZone = z.string().refine(isValidTimeZone, 'Unknown time zone.')

function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0]
  return issue ? `${issue.path.join('.') || 'value'}: ${issue.message}` : 'Invalid input.'
}

function dbError(error: { code?: string; message: string }): string {
  if (error.code === '23505' && error.message.includes('slug')) return 'That event URL is already used by another event.'
  if (error.code === '23503') return 'This item has sales attached and cannot be deleted.'
  return error.message
}

// ── Events ───────────────────────────────────────────────────────────────

const createSchema = z.object({
  title: z.string().trim().min(2).max(160),
  slug: slugSchema,
  startsAtLocal: localDateTime,
  timezone: timeZone,
})

export async function createTicketedEvent(input: z.input<typeof createSchema>): Promise<Result<{ id: string }>> {
  const ctx = await admin()
  if ('error' in ctx) return { ok: false, error: ctx.error! }
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) }
  const { title, slug, startsAtLocal, timezone } = parsed.data
  const { data, error } = await ctx.supabase
    .from('ticketed_events')
    .insert({ title, slug, timezone, starts_at: zonedLocalToUtc(startsAtLocal, timezone)!, created_by: ctx.userId })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: dbError(error ?? { message: 'Could not create the event.' }) }
  revalidateEvent(data.id)
  return { ok: true, id: data.id }
}

const detailsSchema = z.object({
  title: z.string().trim().min(2).max(160),
  title_es: optionalText(160),
  subtitle: optionalText(200),
  subtitle_es: optionalText(200),
  description: optionalText(8000),
  description_es: optionalText(8000),
  slug: slugSchema,
  venue_name: optionalText(160),
  venue_address: optionalText(300),
  timezone: timeZone,
  startsAtLocal: localDateTime,
  endsAtLocal: localDateTime.or(z.literal('')).optional(),
  doorsAtLocal: localDateTime.or(z.literal('')).optional(),
  currency: z.string().trim().toLowerCase().regex(/^[a-z]{3}$/),
  capacity: z.number().int().min(0).max(1_000_000).nullable(),
  max_per_order: z.number().int().min(1).max(50),
  image_url: z.string().url().regex(/^https?:\/\//i).nullable(),
  email_message: optionalText(4000),
  email_message_es: optionalText(4000),
})

export type EventDetailsInput = z.input<typeof detailsSchema>

export async function updateTicketedEvent(id: string, input: EventDetailsInput): Promise<Result> {
  const ctx = await admin()
  if ('error' in ctx) return { ok: false, error: ctx.error! }
  const parsed = detailsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) }
  const { startsAtLocal, endsAtLocal, doorsAtLocal, ...fields } = parsed.data
  const tz = fields.timezone
  const starts_at = zonedLocalToUtc(startsAtLocal, tz)!
  const ends_at = endsAtLocal ? zonedLocalToUtc(endsAtLocal, tz) : null
  const doors_at = doorsAtLocal ? zonedLocalToUtc(doorsAtLocal, tz) : null
  if (ends_at && ends_at <= starts_at) return { ok: false, error: 'The end time must be after the start time.' }
  if (doors_at && doors_at > starts_at) return { ok: false, error: 'Doors should open before the event starts.' }

  const { data: before } = await ctx.supabase.from('ticketed_events').select('slug, currency').eq('id', id).single()
  if (before && before.currency !== fields.currency) {
    const { count } = await ctx.supabase.from('ticket_orders').select('id', { count: 'exact', head: true }).eq('event_id', id)
    if (count) return { ok: false, error: 'The currency cannot change once the event has orders.' }
  }
  const { error } = await ctx.supabase
    .from('ticketed_events')
    .update({ ...fields, starts_at, ends_at, doors_at, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { ok: false, error: dbError(error) }
  revalidateEvent(id, fields.slug)
  if (before?.slug && before.slug !== fields.slug) revalidatePath(`/events/${before.slug}`)
  return { ok: true }
}

export async function setTicketedEventStatus(id: string, status: 'draft' | 'published' | 'closed' | 'cancelled'): Promise<Result> {
  const ctx = await admin()
  if ('error' in ctx) return { ok: false, error: ctx.error! }
  if (!['draft', 'published', 'closed', 'cancelled'].includes(status)) return { ok: false, error: 'Unknown status.' }
  if (status === 'published') {
    const { count } = await ctx.supabase.from('ticket_tiers').select('id', { count: 'exact', head: true }).eq('event_id', id).eq('is_active', true)
    if (!count) return { ok: false, error: 'Add at least one active ticket type before publishing.' }
  }
  const { data, error } = await ctx.supabase
    .from('ticketed_events')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('slug')
    .single()
  if (error) return { ok: false, error: dbError(error) }
  revalidateEvent(id, data?.slug)
  return { ok: true }
}

export async function deleteTicketedEvent(id: string): Promise<Result> {
  const ctx = await admin()
  if ('error' in ctx) return { ok: false, error: ctx.error! }
  const { count } = await ctx.supabase.from('ticket_orders').select('id', { count: 'exact', head: true }).eq('event_id', id)
  if (count) return { ok: false, error: 'Events with orders cannot be deleted. Cancel or close the event instead.' }
  const { error } = await ctx.supabase.from('ticketed_events').delete().eq('id', id)
  if (error) return { ok: false, error: dbError(error) }
  revalidatePath('/admin/events')
  revalidatePath('/events')
  return { ok: true }
}

// ── Ticket types ─────────────────────────────────────────────────────────

const tierSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  name_es: optionalText(80),
  description: optionalText(300),
  description_es: optionalText(300),
  price_cents: z.number().int().min(0).max(10_000_000).refine((v) => v === 0 || v >= 50, 'Paid tickets must cost at least 0.50.'),
  capacity: z.number().int().min(0).max(1_000_000).nullable(),
  salesStartLocal: localDateTime.or(z.literal('')).optional(),
  salesEndLocal: localDateTime.or(z.literal('')).optional(),
  is_active: z.boolean(),
})

export type TierInput = z.input<typeof tierSchema>

export async function saveTicketTier(eventId: string, input: TierInput): Promise<Result<{ id: string }>> {
  const ctx = await admin()
  if ('error' in ctx) return { ok: false, error: ctx.error! }
  const parsed = tierSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) }
  const { id, salesStartLocal, salesEndLocal, ...fields } = parsed.data
  const { data: event } = await ctx.supabase.from('ticketed_events').select('timezone, slug').eq('id', eventId).single()
  if (!event) return { ok: false, error: 'Event not found.' }
  const sales_start_at = salesStartLocal ? zonedLocalToUtc(salesStartLocal, event.timezone) : null
  const sales_end_at = salesEndLocal ? zonedLocalToUtc(salesEndLocal, event.timezone) : null
  if (sales_start_at && sales_end_at && sales_end_at <= sales_start_at) return { ok: false, error: 'Sales must end after they start.' }

  if (id) {
    const { data: existing } = await ctx.supabase.from('ticket_tiers').select('price_cents').eq('id', id).eq('event_id', eventId).single()
    if (!existing) return { ok: false, error: 'Ticket type not found.' }
    const { error } = await ctx.supabase
      .from('ticket_tiers')
      .update({ ...fields, sales_start_at, sales_end_at, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { ok: false, error: dbError(error) }
    revalidateEvent(eventId, event.slug)
    return { ok: true, id }
  }
  const { data: last } = await ctx.supabase.from('ticket_tiers').select('sort_order').eq('event_id', eventId).order('sort_order', { ascending: false }).limit(1)
  const { data, error } = await ctx.supabase
    .from('ticket_tiers')
    .insert({ ...fields, event_id: eventId, sales_start_at, sales_end_at, sort_order: (last?.[0]?.sort_order ?? -1) + 1 })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: dbError(error ?? { message: 'Could not save.' }) }
  revalidateEvent(eventId, event.slug)
  return { ok: true, id: data.id }
}

export async function deleteTicketTier(eventId: string, tierId: string): Promise<Result> {
  const ctx = await admin()
  if ('error' in ctx) return { ok: false, error: ctx.error! }
  const { count } = await ctx.supabase.from('ticket_order_items').select('id', { count: 'exact', head: true }).eq('tier_id', tierId)
  if (count) return { ok: false, error: 'This ticket type has orders. Turn it off instead of deleting it.' }
  const { error } = await ctx.supabase.from('ticket_tiers').delete().eq('id', tierId).eq('event_id', eventId)
  if (error) return { ok: false, error: dbError(error) }
  revalidateEvent(eventId)
  return { ok: true }
}

export async function reorderTicketTiers(eventId: string, orderedIds: string[]): Promise<Result> {
  const ctx = await admin()
  if ('error' in ctx) return { ok: false, error: ctx.error! }
  const results = await Promise.all(
    orderedIds.map((tierId, index) =>
      ctx.supabase.from('ticket_tiers').update({ sort_order: index }).eq('id', tierId).eq('event_id', eventId),
    ),
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) return { ok: false, error: dbError(failed.error) }
  revalidateEvent(eventId)
  return { ok: true }
}

// ── Ticket design ────────────────────────────────────────────────────────

export async function saveTicketDesign(eventId: string, design: unknown): Promise<Result> {
  const ctx = await admin()
  if ('error' in ctx) return { ok: false, error: ctx.error! }
  const normalized = normalizeTicketDesign(design)
  const { error } = await ctx.supabase
    .from('ticketed_events')
    .update({ ticket_design: normalized as unknown as Json, updated_at: new Date().toISOString() })
    .eq('id', eventId)
  if (error) return { ok: false, error: dbError(error) }
  revalidatePath(`/admin/events/${eventId}`)
  return { ok: true }
}

// ── Orders and tickets ───────────────────────────────────────────────────

const compSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  tierId: z.string().uuid(),
  quantity: z.number().int().min(1).max(50),
  locale: z.enum(['en', 'es']),
  sendEmail: z.boolean(),
  enforceCapacity: z.boolean(),
  note: optionalText(500),
})

export async function issueCompTickets(eventId: string, input: z.input<typeof compSchema>): Promise<Result<{ orderId: string; emailed: boolean; emailError?: string }>> {
  const ctx = await admin()
  if ('error' in ctx) return { ok: false, error: ctx.error! }
  const parsed = compSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) }
  const v = parsed.data
  const service = getSupabaseAdmin()
  const { data: order, error } = await service.rpc('reserve_ticket_order', {
    p_event_id: eventId,
    p_items: [{ tier_id: v.tierId, quantity: v.quantity }],
    p_buyer_name: v.name,
    p_buyer_email: v.email,
    p_user_id: null,
    p_locale: v.locale,
    p_access_token: generateSecret(),
    p_status: 'comp',
    p_source: 'admin',
    p_expires_at: null,
    p_enforce_capacity: v.enforceCapacity,
    p_created_by: ctx.userId,
  })
  if (error || !order) {
    const code = reserveErrorToCartError(error?.message ?? '')
    return { ok: false, error: code === 'sold_out' ? 'Not enough capacity left. Tick "Allow over capacity" to issue anyway.' : error?.message ?? 'Could not issue tickets.' }
  }
  if (v.note) await service.from('ticket_orders').update({ notes: v.note }).eq('id', order.id)
  await ensureTickets(service, order.id)
  let emailed = false
  let emailError: string | undefined
  if (v.sendEmail) {
    const delivery = await deliverOrderEmail(service, order.id)
    emailed = delivery.ok && delivery.sent
    if (!delivery.ok) emailError = delivery.error
  } else {
    await service.from('ticket_orders').update({ email_status: 'skipped' }).eq('id', order.id)
  }
  revalidateEvent(eventId)
  return { ok: true, orderId: order.id, emailed, emailError }
}

export async function resendTicketEmail(orderId: string): Promise<Result> {
  const ctx = await admin()
  if ('error' in ctx) return { ok: false, error: ctx.error! }
  const service = getSupabaseAdmin()
  const result = await deliverOrderEmail(service, orderId, { force: true })
  const { data: order } = await service.from('ticket_orders').select('event_id').eq('id', orderId).single()
  if (order) revalidatePath(`/admin/events/${order.event_id}`)
  return result.ok ? { ok: true } : { ok: false, error: result.error }
}

const buyerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
})

export async function updateOrderBuyer(orderId: string, input: z.input<typeof buyerSchema>): Promise<Result> {
  const ctx = await admin()
  if ('error' in ctx) return { ok: false, error: ctx.error! }
  const parsed = buyerSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) }
  const { data, error } = await ctx.supabase
    .from('ticket_orders')
    .update({ buyer_name: parsed.data.name, buyer_email: parsed.data.email, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .select('event_id')
    .single()
  if (error) return { ok: false, error: dbError(error) }
  revalidatePath(`/admin/events/${data.event_id}`)
  return { ok: true }
}

export async function updateTicketAttendee(ticketId: string, name: string): Promise<Result> {
  const ctx = await admin()
  if ('error' in ctx) return { ok: false, error: ctx.error! }
  const value = name.trim().slice(0, 120) || null
  const { data, error } = await ctx.supabase.from('tickets').update({ attendee_name: value }).eq('id', ticketId).select('event_id').single()
  if (error) return { ok: false, error: dbError(error) }
  revalidatePath(`/admin/events/${data.event_id}`)
  return { ok: true }
}

/** Manual check-in or undo from the attendee list (logged like a scan). */
export async function setTicketCheckIn(ticketId: string, checkedIn: boolean): Promise<Result> {
  const ctx = await admin()
  if ('error' in ctx) return { ok: false, error: ctx.error! }
  const { data: profile } = await ctx.supabase.from('profiles').select('full_name, email').eq('id', ctx.userId).single()
  const now = new Date().toISOString()
  const { data, error } = await ctx.supabase
    .from('tickets')
    .update(checkedIn
      ? { status: 'checked_in', checked_in_at: now, checked_in_by: profile?.full_name || profile?.email || 'Admin' }
      : { status: 'valid', checked_in_at: null, checked_in_by: null })
    .eq('id', ticketId)
    .eq('status', checkedIn ? 'valid' : 'checked_in')
    .select('event_id, ticket_number')
    .maybeSingle()
  if (error) return { ok: false, error: dbError(error) }
  if (!data) return { ok: false, error: checkedIn ? 'This ticket is not valid for check-in.' : 'This ticket is not checked in.' }
  await getSupabaseAdmin().from('ticket_scans').insert({
    event_id: data.event_id,
    ticket_id: ticketId,
    admin_user_id: ctx.userId,
    scanned_value: data.ticket_number,
    result: checkedIn ? 'admitted' : 'undone',
  })
  revalidatePath(`/admin/events/${data.event_id}`)
  return { ok: true }
}

export async function setTicketVoid(ticketId: string, voided: boolean): Promise<Result> {
  const ctx = await admin()
  if ('error' in ctx) return { ok: false, error: ctx.error! }
  const { data, error } = await ctx.supabase
    .from('tickets')
    .update(voided ? { status: 'void', voided_at: new Date().toISOString() } : { status: 'valid', voided_at: null, checked_in_at: null, checked_in_by: null })
    .eq('id', ticketId)
    .select('event_id')
    .single()
  if (error) return { ok: false, error: dbError(error) }
  revalidatePath(`/admin/events/${data.event_id}`)
  return { ok: true }
}

// ── Scanner links ────────────────────────────────────────────────────────

const linkSchema = z.object({
  label: z.string().trim().min(1).max(80),
  expiresAtLocal: localDateTime.or(z.literal('')).optional(),
})

export async function createScannerLink(eventId: string, input: z.input<typeof linkSchema>): Promise<Result<{ token: string }>> {
  const ctx = await admin()
  if ('error' in ctx) return { ok: false, error: ctx.error! }
  const parsed = linkSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) }
  const { data: event } = await ctx.supabase.from('ticketed_events').select('timezone').eq('id', eventId).single()
  if (!event) return { ok: false, error: 'Event not found.' }
  const token = generateSecret()
  const { error } = await ctx.supabase.from('ticket_scanner_links').insert({
    event_id: eventId,
    label: parsed.data.label,
    token,
    expires_at: parsed.data.expiresAtLocal ? zonedLocalToUtc(parsed.data.expiresAtLocal, event.timezone) : null,
    created_by: ctx.userId,
  })
  if (error) return { ok: false, error: dbError(error) }
  revalidatePath(`/admin/events/${eventId}`)
  return { ok: true, token }
}

export async function revokeScannerLink(linkId: string): Promise<Result> {
  const ctx = await admin()
  if ('error' in ctx) return { ok: false, error: ctx.error! }
  const { data, error } = await ctx.supabase
    .from('ticket_scanner_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', linkId)
    .select('event_id')
    .single()
  if (error) return { ok: false, error: dbError(error) }
  revalidatePath(`/admin/events/${data.event_id}`)
  return { ok: true }
}
