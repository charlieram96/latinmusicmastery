import Link from 'next/link'
import { CalendarDays, DollarSign, Plus, Ticket } from 'lucide-react'
import { AdminText } from '@/components/admin/admin-text'
import { Button } from '@/components/ui/button'
import { EventStatusBadge } from '@/components/admin/events/event-status-badge'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getServerLocale } from '@/lib/i18n/server'
import { formatEventShortDate, formatEventTime, formatMoney } from '@/lib/tickets/format'
import type { TierAvailability } from '@/lib/tickets/types'

function countUpcoming(events: Array<{ starts_at: string; status: string }>): number {
  const now = Date.now()
  return events.filter((e) => new Date(e.starts_at).getTime() > now && e.status !== 'cancelled').length
}

export default async function AdminEventsPage() {
  const supabase = await createClient()
  const service = getSupabaseAdmin()
  const locale = await getServerLocale()
  const { data: events } = await supabase.from('ticketed_events').select('*').order('starts_at', { ascending: false })
  const list = events ?? []

  const ids = list.map((e) => e.id)
  const [availability, { data: tiers }, { data: orders }] = await Promise.all([
    Promise.all(ids.map((id) => service.rpc('ticket_event_availability', { p_event_id: id }))),
    ids.length ? service.from('ticket_tiers').select('event_id, capacity').in('event_id', ids) : Promise.resolve({ data: [] }),
    ids.length ? service.from('ticket_orders').select('event_id, amount_total_cents, currency').in('event_id', ids).eq('status', 'paid') : Promise.resolve({ data: [] }),
  ])

  const stats = list.map((event, i) => {
    const rows = (availability[i].data ?? []) as TierAvailability[]
    const sold = rows.reduce((s, r) => s + r.sold, 0)
    const checkedIn = rows.reduce((s, r) => s + r.checked_in, 0)
    const eventTiers = (tiers ?? []).filter((t) => t.event_id === event.id)
    const tierCap = eventTiers.some((t) => t.capacity === null) ? null : eventTiers.reduce((s, t) => s + (t.capacity ?? 0), 0)
    const capacity = event.capacity ?? (eventTiers.length ? tierCap : null)
    const revenue = (orders ?? []).filter((o) => o.event_id === event.id).reduce((s, o) => s + o.amount_total_cents, 0)
    return { event, sold, checkedIn, capacity, revenue }
  })
  const upcoming = countUpcoming(list)
  const totalSold = stats.reduce((s, r) => s + r.sold, 0)
  const revenueByCurrency = new Map<string, number>()
  for (const o of orders ?? []) revenueByCurrency.set(o.currency, (revenueByCurrency.get(o.currency) ?? 0) + o.amount_total_cents)
  const revenueLabel = revenueByCurrency.size
    ? [...revenueByCurrency].map(([cur, cents]) => formatMoney(cents, cur, locale)).join(' · ')
    : formatMoney(0, 'usd', locale)

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8 flex flex-wrap items-end gap-4">
        <div className="mr-auto">
          <h1 className="mb-1 text-4xl font-bold tracking-tight"><AdminText text="Ticketed Events" /></h1>
          <p className="text-muted-foreground"><AdminText text="Sell tickets with Stripe, design the PDF ticket, and check people in at the door." /></p>
        </div>
        <Button asChild>
          <Link href="/admin/events/new"><Plus className="h-4 w-4" /> <AdminText text="New event" /></Link>
        </Button>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          { icon: CalendarDays, value: String(upcoming), label: 'Upcoming events', tone: 'bg-blue-500/10 text-blue-500' },
          { icon: Ticket, value: String(totalSold), label: 'Tickets issued', tone: 'bg-amber-500/10 text-amber-600' },
          { icon: DollarSign, value: revenueLabel, label: 'Ticket revenue', tone: 'bg-emerald-500/10 text-emerald-600' },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border bg-card p-5">
            <div className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg ${card.tone}`}>
              <card.icon className="h-4 w-4" />
            </div>
            <div className="text-3xl font-bold">{card.value}</div>
            <div className="text-sm text-muted-foreground"><AdminText text={card.label} /></div>
          </div>
        ))}
      </div>

      {stats.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-12 text-center">
          <Ticket className="h-8 w-8 text-muted-foreground" />
          <p className="text-lg font-semibold"><AdminText text="No events yet" /></p>
          <p className="max-w-md text-sm text-muted-foreground"><AdminText text="Create an event, add ticket types and prices, design the ticket, then publish it to start selling." /></p>
          <Button asChild className="mt-2"><Link href="/admin/events/new"><Plus className="h-4 w-4" /> <AdminText text="New event" /></Link></Button>
        </div>
      ) : (
        <ul className="grid gap-3">
          {stats.map(({ event, sold, checkedIn, capacity, revenue }) => {
            const pct = capacity ? Math.min(100, Math.round((sold / capacity) * 100)) : null
            return (
              <li key={event.id}>
                <Link
                  href={`/admin/events/${event.id}`}
                  className="grid gap-4 rounded-2xl border bg-card p-5 transition-colors hover:border-primary/40 md:grid-cols-[minmax(0,1fr)_200px_140px] md:items-center"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-amber-500 to-rose-600">
                      {event.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded Storage image
                        <img src={event.image_url} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold">{event.title}</p>
                        <EventStatusBadge status={event.status} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatEventShortDate(event.starts_at, event.timezone, locale)} · {formatEventTime(event.starts_at, event.timezone, locale)}
                        {event.venue_name ? ` · ${event.venue_name}` : ''}
                      </p>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-baseline gap-1 text-sm">
                      <span className="font-semibold">{sold}</span>
                      <span className="text-muted-foreground">{capacity !== null ? `/ ${capacity}` : ''} <AdminText text="sold" /></span>
                      {checkedIn > 0 && <span className="text-muted-foreground">· {checkedIn} <AdminText text="in" /></span>}
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct ?? (sold > 0 ? 100 : 0)}%`, opacity: pct === null ? 0.35 : 1 }} />
                    </div>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="font-semibold">{formatMoney(revenue, event.currency, locale)}</p>
                    <p className="text-xs text-muted-foreground"><AdminText text="Revenue" /></p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
