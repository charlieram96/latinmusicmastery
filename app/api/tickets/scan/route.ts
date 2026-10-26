// Door scanner API. Authorised either by an admin session (event chosen by
// eventId) or by a scanner link token (event fixed by the link).
//   GET  ?eventId=… | x-scanner-token  → check-in stats
//   POST { value, mode, eventId? }      → scan result (+ check-in)

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { isLocale } from '@/lib/i18n'
import { eventCheckInStats, performScan, resolveScannerLink, type ScanActor } from '@/lib/tickets/scan'

type Access = { eventId: string; actor: ScanActor } | { error: string; status: number }

async function authorise(request: NextRequest, requestedEventId: string | null): Promise<Access> {
  const admin = getSupabaseAdmin()
  const token = request.headers.get('x-scanner-token')
  if (token) {
    const resolved = await resolveScannerLink(admin, token)
    if (resolved.state !== 'ok' || !resolved.link) return { error: `link_${resolved.state}`, status: 401 }
    return { eventId: resolved.link.event_id, actor: { label: resolved.link.label, scannerLinkId: resolved.link.id } }
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthorized', status: 401 }
  const { data: profile } = await supabase.from('profiles').select('is_admin, full_name, email').eq('id', user.id).single()
  if (!profile?.is_admin) return { error: 'forbidden', status: 403 }
  if (!requestedEventId || !z.string().uuid().safeParse(requestedEventId).success) return { error: 'event_required', status: 400 }
  return { eventId: requestedEventId, actor: { label: profile.full_name || profile.email || 'Admin', adminUserId: user.id } }
}

export async function GET(request: NextRequest) {
  const access = await authorise(request, request.nextUrl.searchParams.get('eventId'))
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })
  return NextResponse.json({ stats: await eventCheckInStats(getSupabaseAdmin(), access.eventId) }, { headers: { 'Cache-Control': 'no-store' } })
}

const scanSchema = z.object({
  value: z.string().trim().min(1).max(500),
  mode: z.enum(['checkin', 'verify']).default('checkin'),
  eventId: z.string().uuid().optional(),
  locale: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const parsed = scanSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  const access = await authorise(request, parsed.data.eventId ?? null)
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })
  const result = await performScan(getSupabaseAdmin(), {
    eventId: access.eventId,
    raw: parsed.data.value,
    mode: parsed.data.mode,
    actor: access.actor,
    locale: isLocale(parsed.data.locale) ? parsed.data.locale : 'en',
  })
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
