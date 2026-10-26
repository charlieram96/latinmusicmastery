// Live preview for the admin ticket designer: renders a sample ticket from the
// posted (unsaved) design with the same renderer as the emailed PDFs.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { isLocale } from '@/lib/i18n'
import { normalizeTicketDesign } from '@/lib/tickets/design'
import { buildPreviewPdf } from '@/lib/tickets/render'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  if ('error' in (await requireAdmin(supabase))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as { design?: unknown; locale?: unknown }
  const service = getSupabaseAdmin()
  const [{ data: event }, { data: tiers }] = await Promise.all([
    service.from('ticketed_events').select('*').eq('id', id).maybeSingle(),
    service.from('ticket_tiers').select('*').eq('event_id', id).order('sort_order'),
  ])
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const pdf = await buildPreviewPdf(event, tiers ?? [], normalizeTicketDesign(body.design), isLocale(body.locale) ? body.locale : 'en')
  return new NextResponse(Buffer.from(pdf), {
    headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store' },
  })
}
