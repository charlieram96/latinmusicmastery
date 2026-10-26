'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ExternalLink, Loader2, ScanLine } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { setTicketedEventStatus } from '@/app/actions/ticketed-events'
import { formatEventDate, formatEventTime } from '@/lib/tickets/format'
import type { TicketDesign } from '@/lib/tickets/design'
import type { TicketedEvent, TicketTier, TierAvailability } from '@/lib/tickets/types'
import { EventStatusBadge } from './event-status-badge'
import { FlashMessage, useAdminLabel, useFlash } from './shared'
import { OverviewPanel } from './overview-panel'
import { DetailsPanel } from './details-panel'
import { TiersPanel } from './tiers-panel'
import { DesignPanel } from './design-panel'
import { AttendeesPanel } from './attendees-panel'
import { ScannersPanel } from './scanners-panel'

export interface ManagerTicket {
  id: string
  tier_id: string
  seq: number
  ticket_number: string
  code: string
  attendee_name: string | null
  status: string
  checked_in_at: string | null
  checked_in_by: string | null
}

export interface ManagerOrder {
  id: string
  status: string
  source: string
  buyer_name: string
  buyer_email: string
  locale: string
  access_token: string
  amount_total_cents: number
  currency: string
  paid_at: string | null
  created_at: string
  expires_at: string | null
  refunded_at: string | null
  email_status: string
  email_sent_at: string | null
  email_error: string | null
  notes: string | null
  user_id: string | null
  items: Array<{ tier_id: string; quantity: number; unit_price_cents: number }>
  tickets: ManagerTicket[]
}

export interface ManagerScannerLink {
  id: string
  label: string
  url: string
  /** Server-rendered QR of the link, so staff can open it by scanning the admin's screen. */
  qrSvg: string | null
  expiresAt: string | null
  revokedAt: string | null
  lastUsedAt: string | null
  createdAt: string
  scans: number
}

export interface ManagerScan {
  id: string
  result: string
  value: string | null
  at: string
  ticketNumber: string | null
  attendee: string | null
}

export interface EventManagerProps {
  initialTab: string
  event: TicketedEvent
  design: TicketDesign
  tiers: TicketTier[]
  availability: TierAvailability[]
  orders: ManagerOrder[]
  scannerLinks: ManagerScannerLink[]
  recentScans: ManagerScan[]
  publicUrl: string
}

const TABS = ['overview', 'details', 'tickets', 'design', 'attendees', 'scanners'] as const
const TAB_LABELS: Record<(typeof TABS)[number], string> = {
  overview: 'Overview',
  details: 'Event details',
  tickets: 'Ticket types',
  design: 'Ticket design',
  attendees: 'Attendees',
  scanners: 'Door scanners',
}

export function EventManager(props: EventManagerProps) {
  const { event } = props
  const L = useAdminLabel()
  const { locale } = useTranslation()
  const router = useRouter()
  const [tab, setTab] = useState<string>(TABS.includes(props.initialTab as (typeof TABS)[number]) ? props.initialTab : 'overview')
  const [pending, startTransition] = useTransition()
  const { flash, ok, fail } = useFlash()

  const changeTab = (next: string) => {
    setTab(next)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', next)
    window.history.replaceState(null, '', url)
  }

  const setStatus = (status: 'draft' | 'published' | 'closed' | 'cancelled', confirmText?: string) => {
    if (confirmText && !window.confirm(L(confirmText))) return
    startTransition(async () => {
      const result = await setTicketedEventStatus(event.id, status)
      if (!result.ok) return fail(result.error)
      ok(L(status === 'published' ? 'Event published. Tickets are on sale.' : 'Event status updated.'))
      router.refresh()
    })
  }

  return (
    <div className="p-6 lg:p-8">
      <Link href="/admin/events" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {L('Back to events')}
      </Link>

      <div className="mb-6 flex flex-wrap items-start gap-4">
        <div className="mr-auto min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">{event.title}</h1>
            <EventStatusBadge status={event.status} />
          </div>
          <p className="text-muted-foreground">
            {formatEventDate(event.starts_at, event.timezone, locale)} · {formatEventTime(event.starts_at, event.timezone, locale)}
            {event.venue_name ? ` · ${event.venue_name}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`/events/${event.slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> {L('View page')}</a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/events/${event.id}/scan`}><ScanLine className="h-4 w-4" /> {L('Scan tickets')}</Link>
          </Button>
          {event.status === 'draft' && (
            <Button size="sm" disabled={pending} onClick={() => setStatus('published')}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} {L('Publish')}
            </Button>
          )}
          {event.status === 'published' && (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => setStatus('closed', 'Stop online sales? Existing tickets stay valid.')}>
              {L('Close sales')}
            </Button>
          )}
          {(event.status === 'closed' || event.status === 'cancelled') && (
            <Button size="sm" disabled={pending} onClick={() => setStatus('published')}>{L('Reopen sales')}</Button>
          )}
          {event.status === 'published' && (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setStatus('draft', 'Unpublish this event? The public page will disappear.')}>
              {L('Unpublish')}
            </Button>
          )}
          {event.status !== 'cancelled' && event.status !== 'draft' && (
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={pending}
              onClick={() => setStatus('cancelled', 'Mark this event as cancelled? Sales stop and ticket pages show it as cancelled. Refunds are issued in Stripe.')}>
              {L('Cancel event')}
            </Button>
          )}
        </div>
      </div>
      <FlashMessage flash={flash} className="mb-5" />

      <Tabs value={tab} onValueChange={changeTab}>
        <div className="-mx-1 mb-6 overflow-x-auto px-1">
          <TabsList>
            {TABS.map((key) => <TabsTrigger key={key} value={key}>{L(TAB_LABELS[key])}</TabsTrigger>)}
          </TabsList>
        </div>
        <TabsContent value="overview"><OverviewPanel {...props} onNavigate={changeTab} /></TabsContent>
        <TabsContent value="details"><DetailsPanel event={event} /></TabsContent>
        <TabsContent value="tickets"><TiersPanel event={event} tiers={props.tiers} availability={props.availability} /></TabsContent>
        <TabsContent value="design"><DesignPanel event={event} design={props.design} /></TabsContent>
        <TabsContent value="attendees"><AttendeesPanel event={event} tiers={props.tiers} orders={props.orders} /></TabsContent>
        <TabsContent value="scanners"><ScannersPanel event={event} links={props.scannerLinks} /></TabsContent>
      </Tabs>
    </div>
  )
}
