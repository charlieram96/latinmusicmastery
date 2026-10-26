// Attendee list as CSV (one row per ticket) for spreadsheets and door lists.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { orderReference } from '@/lib/tickets/codes'

function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value)
  // Neutralise spreadsheet formulas in user-entered names.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  if ('error' in (await requireAdmin(supabase))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const service = getSupabaseAdmin()
  const [{ data: event }, { data: tickets }] = await Promise.all([
    service.from('ticketed_events').select('slug').eq('id', id).maybeSingle(),
    service
      .from('tickets')
      .select('ticket_number, attendee_name, status, checked_in_at, checked_in_by, seq, tier:ticket_tiers(name), order:ticket_orders(id, status, source, buyer_name, buyer_email, amount_total_cents, currency, paid_at, created_at)')
      .eq('event_id', id)
      .order('created_at'),
  ])
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const header = ['Ticket number', 'Ticket type', 'Attendee', 'Buyer name', 'Buyer email', 'Order', 'Order status', 'Source', 'Ticket status', 'Checked in at', 'Checked in by', 'Purchased at']
  const rows = (tickets ?? []).map((t) => {
    const order = t.order as { id: string; status: string; source: string; buyer_name: string; buyer_email: string; paid_at: string | null; created_at: string } | null
    const tier = t.tier as { name: string } | null
    return [
      t.ticket_number, tier?.name, t.attendee_name, order?.buyer_name, order?.buyer_email,
      order ? orderReference(order.id) : '', order?.status, order?.source, t.status,
      t.checked_in_at, t.checked_in_by, order?.paid_at ?? order?.created_at,
    ]
  })
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')
  return new NextResponse(`﻿${csv}\r\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="attendees-${event.slug}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
