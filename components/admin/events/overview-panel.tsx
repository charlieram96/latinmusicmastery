'use client'

import { useState } from 'react'
import { Check, CircleDashed, Copy, DollarSign, ScanLine, ShoppingBag, Ticket } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { Button } from '@/components/ui/button'
import { formatEventTime, formatMoney, pickLocalized } from '@/lib/tickets/format'
import type { EventManagerProps } from './event-manager'
import { Section, useAdminLabel } from './shared'

const SCAN_LABELS: Record<string, string> = {
  admitted: 'Admitted',
  verified: 'Verified',
  already_checked_in: 'Already checked in',
  void: 'Void ticket',
  refunded: 'Refunded ticket',
  wrong_event: 'Other event',
  not_found: 'Not found',
  undone: 'Check-in undone',
}

export function OverviewPanel({ event, tiers, availability, orders, recentScans, publicUrl, onNavigate }: EventManagerProps & { onNavigate: (tab: string) => void }) {
  const L = useAdminLabel()
  const { locale } = useTranslation()
  const [copied, setCopied] = useState(false)

  const byTier = new Map(availability.map((a) => [a.tier_id, a]))
  const sold = availability.reduce((s, a) => s + a.sold, 0)
  const checkedIn = availability.reduce((s, a) => s + a.checked_in, 0)
  const paidOrders = orders.filter((o) => o.status === 'paid' || o.status === 'comp')
  const revenue = orders.filter((o) => o.status === 'paid').reduce((s, o) => s + o.amount_total_cents, 0)
  const holds = orders.filter((o) => o.status === 'pending' && o.expires_at && new Date(o.expires_at) > new Date()).length
  const tierCapacity = tiers.length && tiers.every((t) => t.capacity !== null) ? tiers.reduce((s, t) => s + (t.capacity ?? 0), 0) : null
  const capacity = event.capacity ?? tierCapacity
  const failedEmails = paidOrders.filter((o) => o.email_status === 'failed').length

  const checklist = [
    { done: !!event.venue_name, label: 'Add the venue and description', tab: 'details' },
    { done: tiers.some((t) => t.is_active), label: 'Create at least one ticket type', tab: 'tickets' },
    { done: Object.keys(event.ticket_design ?? {}).length > 0, label: 'Customize the ticket design', tab: 'design' },
    { done: event.status !== 'draft', label: 'Publish the event', tab: 'overview' },
  ]

  const copy = async () => {
    await navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  const cards = [
    { icon: Ticket, label: 'Tickets issued', value: capacity !== null ? `${sold} / ${capacity}` : String(sold), sub: holds ? `${holds} ${L('in checkout now')}` : null },
    { icon: DollarSign, label: 'Revenue', value: formatMoney(revenue, event.currency, locale), sub: null },
    { icon: ScanLine, label: 'Checked in', value: sold ? `${checkedIn} / ${sold}` : '0', sub: null },
    { icon: ShoppingBag, label: 'Orders', value: String(paidOrders.length), sub: failedEmails ? `${failedEmails} ${L('emails failed')}` : null },
  ]

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border bg-card p-5">
            <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><c.icon className="h-4 w-4" /></div>
            <div className="text-2xl font-bold">{c.value}</div>
            <div className="text-sm text-muted-foreground">{L(c.label)}</div>
            {c.sub && <div className="mt-1 text-xs text-warning">{c.sub}</div>}
          </div>
        ))}
      </div>

      {event.status === 'draft' && (
        <Section title={L('Get ready to sell')} description={L('Finish these steps, then publish to open ticket sales.')}>
          <ul className="grid gap-2">
            {checklist.map((step) => (
              <li key={step.label}>
                <button type="button" onClick={() => onNavigate(step.tab)} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent">
                  {step.done ? <Check className="h-4 w-4 text-success" /> : <CircleDashed className="h-4 w-4 text-muted-foreground" />}
                  <span className={step.done ? 'text-muted-foreground line-through' : ''}>{L(step.label)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section
        title={L('Share the event')}
        description={L('Send people to this page to buy tickets.')}
      >
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg border bg-muted/50 px-3 py-2 text-sm">{publicUrl}</code>
          <Button variant="outline" size="sm" onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {L(copied ? 'Copied' : 'Copy link')}</Button>
        </div>
      </Section>

      <Section title={L('Sales by ticket type')} actions={<Button variant="outline" size="sm" onClick={() => onNavigate('tickets')}>{L('Edit ticket types')}</Button>}>
        {tiers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{L('No ticket types yet.')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">{L('Ticket type')}</th>
                  <th className="pb-2 font-medium">{L('Price')}</th>
                  <th className="pb-2 font-medium">{L('Issued')}</th>
                  <th className="pb-2 font-medium">{L('Checked in')}</th>
                  <th className="pb-2 font-medium">{L('Revenue')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tiers.map((tier) => {
                  const a = byTier.get(tier.id)
                  const tierRevenue = orders
                    .filter((o) => o.status === 'paid')
                    .flatMap((o) => o.items)
                    .filter((i) => i.tier_id === tier.id)
                    .reduce((s, i) => s + i.quantity * i.unit_price_cents, 0)
                  return (
                    <tr key={tier.id} className={tier.is_active ? '' : 'text-muted-foreground'}>
                      <td className="py-2.5 pr-3 font-medium">{pickLocalized(tier.name, tier.name_es, locale)}{!tier.is_active && <span className="ml-2 text-xs">({L('off')})</span>}</td>
                      <td className="py-2.5 pr-3">{tier.price_cents === 0 ? L('Free') : formatMoney(tier.price_cents, event.currency, locale)}</td>
                      <td className="py-2.5 pr-3">{a?.sold ?? 0}{tier.capacity !== null ? ` / ${tier.capacity}` : ''}</td>
                      <td className="py-2.5 pr-3">{a?.checked_in ?? 0}</td>
                      <td className="py-2.5">{formatMoney(tierRevenue, event.currency, locale)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title={L('Recent door activity')} actions={<Button variant="outline" size="sm" onClick={() => onNavigate('scanners')}>{L('Door scanners')}</Button>}>
        {recentScans.length === 0 ? (
          <p className="text-sm text-muted-foreground">{L('No scans yet. Open the scanner on a phone at the entrance.')}</p>
        ) : (
          <ul className="divide-y text-sm">
            {recentScans.slice(0, 10).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="w-20 text-muted-foreground">{formatEventTime(s.at, event.timezone, locale, false)}</span>
                <span className={s.result === 'admitted' || s.result === 'verified' ? 'font-medium text-success' : s.result === 'undone' ? 'text-muted-foreground' : 'font-medium text-destructive'}>
                  {L(SCAN_LABELS[s.result] ?? s.result)}
                </span>
                <span className="text-muted-foreground">{[s.attendee, s.ticketNumber ?? s.value].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
