import Link from 'next/link'
import { Ticket } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getServerTranslator } from '@/lib/i18n/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { orderReference } from '@/lib/tickets/codes'
import { formatEventDate, formatEventTime, pickLocalized } from '@/lib/tickets/format'
import { orderPagePath } from '@/lib/tickets/urls'

const T = 'tickets.dashboard'

/** Ticket orders placed while signed in (RLS: buyers read their own orders). */
export default async function MyTicketsPage() {
  const { t, locale } = await getServerTranslator()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: orders } = await supabase
    .from('ticket_orders')
    .select('id, status, access_token, created_at, event:ticketed_events(title, title_es, starts_at, timezone, venue_name, slug), tickets(id, status)')
    .eq('user_id', user?.id ?? '')
    .in('status', ['paid', 'comp', 'refunded'])
    .order('created_at', { ascending: false })

  return (
    <>
      <PageHeader
        title={t(`${T}.title`)}
        description={t(`${T}.subtitle`)}
        actions={<Button asChild variant="outline"><Link href="/events">{t(`${T}.browse`)}</Link></Button>}
      />
      {!orders?.length ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          <Ticket className="h-8 w-8" aria-hidden />
          <p>{t(`${T}.empty`)}</p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {orders.map((order) => {
            const event = order.event as { title: string; title_es: string | null; starts_at: string; timezone: string; venue_name: string | null } | null
            if (!event) return null
            const count = (order.tickets ?? []).filter((tk) => tk.status !== 'void').length
            return (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-5">
                <div className="min-w-0">
                  <p className="font-semibold">{pickLocalized(event.title, event.title_es, locale)}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatEventDate(event.starts_at, event.timezone, locale)} · {formatEventTime(event.starts_at, event.timezone, locale)}
                    {event.venue_name ? ` · ${event.venue_name}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t(`${T}.orderLine`, { ref: orderReference(order.id), count })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {order.status === 'refunded' && <Badge variant="secondary">{t(`${T}.refunded`)}</Badge>}
                  <Button asChild><Link href={orderPagePath(order.access_token)}>{t(`${T}.view`)}</Link></Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
