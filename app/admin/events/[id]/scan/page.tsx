import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { getServerLocale } from '@/lib/i18n/server'
import { eventCheckInStats } from '@/lib/tickets/scan'
import { formatEventShortDate, formatEventTime, pickLocalized } from '@/lib/tickets/format'
import { AdminText } from '@/components/admin/admin-text'
import { TicketScanner } from '@/components/tickets/ticket-scanner'

export default async function AdminScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  if ('error' in (await requireAdmin(supabase))) notFound()
  const service = getSupabaseAdmin()
  const [{ data: event }, locale] = await Promise.all([service.from('ticketed_events').select('*').eq('id', id).maybeSingle(), getServerLocale()])
  if (!event) notFound()
  const stats = await eventCheckInStats(service, id)

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto mb-5 max-w-md">
        <Link href={`/admin/events/${id}?tab=scanners`} className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> <AdminText text="Back to event" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{pickLocalized(event.title, event.title_es, locale)}</h1>
        <p className="text-sm text-muted-foreground">
          {formatEventShortDate(event.starts_at, event.timezone, locale)} · {formatEventTime(event.starts_at, event.timezone, locale)}
          {event.venue_name ? ` · ${event.venue_name}` : ''}
        </p>
      </div>
      <TicketScanner eventId={id} initialStats={stats} />
    </div>
  )
}
