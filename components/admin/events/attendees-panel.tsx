'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Ban, Check, Download, ExternalLink, Gift, Loader2, Mail, Pencil, RotateCcw, Search, Undo2 } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  issueCompTickets,
  resendTicketEmail,
  setTicketCheckIn,
  setTicketVoid,
  updateOrderBuyer,
  updateTicketAttendee,
} from '@/app/actions/ticketed-events'
import { formatEventShortDate, formatEventTime, formatMoney, orderReference, pickLocalized } from '@/lib/tickets/format'
import type { TicketedEvent, TicketTier } from '@/lib/tickets/types'
import type { ManagerOrder, ManagerTicket } from './event-manager'
import { FlashMessage, useAdminLabel, useFlash } from './shared'
import { nativeSelectClass } from './time-zone-select'

type Filter = 'active' | 'paid' | 'comp' | 'checked_in' | 'not_checked_in' | 'refunded' | 'pending' | 'all'
const FILTERS: Array<[Filter, string]> = [
  ['active', 'All valid orders'],
  ['paid', 'Paid'],
  ['comp', 'Complimentary'],
  ['checked_in', 'Checked in'],
  ['not_checked_in', 'Not checked in'],
  ['refunded', 'Refunded'],
  ['pending', 'In checkout / abandoned'],
  ['all', 'Everything'],
]

const ORDER_BADGE: Record<string, { label: string; variant: 'success' | 'info' | 'warning' | 'danger' | 'secondary' }> = {
  paid: { label: 'Paid', variant: 'success' },
  comp: { label: 'Complimentary', variant: 'info' },
  pending: { label: 'In checkout', variant: 'warning' },
  expired: { label: 'Abandoned', variant: 'secondary' },
  cancelled: { label: 'Abandoned', variant: 'secondary' },
  refunded: { label: 'Refunded', variant: 'danger' },
}

const EMAIL_LABEL: Record<string, string> = { pending: 'Email queued', sending: 'Sending email', sent: 'Email sent', failed: 'Email failed', skipped: 'Not emailed' }

export function AttendeesPanel({ event, tiers, orders }: { event: TicketedEvent; tiers: TicketTier[]; orders: ManagerOrder[] }) {
  const L = useAdminLabel()
  const { locale } = useTranslation()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const { flash, ok, fail } = useFlash()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('active')
  const [compOpen, setCompOpen] = useState(false)
  const [editing, setEditing] = useState<ManagerOrder | null>(null)
  const tierName = useMemo(() => new Map(tiers.map((t) => [t.id, pickLocalized(t.name, t.name_es, locale)])), [tiers, locale])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return orders.filter((o) => {
      const valid = o.status === 'paid' || o.status === 'comp'
      const match =
        filter === 'all' ? true
        : filter === 'active' ? valid
        : filter === 'paid' ? o.status === 'paid'
        : filter === 'comp' ? o.status === 'comp'
        : filter === 'refunded' ? o.status === 'refunded'
        : filter === 'pending' ? ['pending', 'expired', 'cancelled'].includes(o.status)
        : filter === 'checked_in' ? valid && o.tickets.some((t) => t.status === 'checked_in')
        : valid && o.tickets.some((t) => t.status === 'valid')
      if (!match) return false
      if (!q) return true
      return [o.buyer_name, o.buyer_email, orderReference(o.id), ...o.tickets.flatMap((t) => [t.ticket_number, t.attendee_name ?? ''])]
        .some((s) => s.toLowerCase().includes(q))
    })
  }, [orders, query, filter])

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) =>
    startTransition(async () => {
      const result = await fn()
      if (!result.ok) return fail(result.error)
      ok(L(success))
      router.refresh()
    })

  const ticketCount = visible.reduce((s, o) => s + o.tickets.filter((t) => t.status !== 'void').length, 0)

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={L('Search name, email or ticket number')} className="pl-9" aria-label={L('Search attendees')} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{L('Show')}</span>
          <select className={`${nativeSelectClass} w-auto`} value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            {FILTERS.map(([key, label]) => <option key={key} value={key}>{L(label)}</option>)}
          </select>
        </label>
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/admin/events/${event.id}/attendees`}><Download className="h-4 w-4" /> {L('Export CSV')}</a>
        </Button>
        <Button size="sm" onClick={() => setCompOpen(true)} disabled={tiers.length === 0}><Gift className="h-4 w-4" /> {L('Issue tickets')}</Button>
      </div>
      <p className="text-sm text-muted-foreground">{visible.length} {L('orders')} · {ticketCount} {L('tickets')}</p>
      <FlashMessage flash={flash} />

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">{L('No orders match.')}</p>
      ) : (
        <ul className="grid gap-3">
          {visible.map((order) => {
            const badge = order.status === 'paid' && order.source === 'free'
              ? { label: 'Free', variant: 'info' as const }
              : ORDER_BADGE[order.status] ?? { label: order.status, variant: 'secondary' as const }
            const fulfilled = order.status === 'paid' || order.status === 'comp'
            return (
              <li key={order.id} className="rounded-2xl border bg-card">
                <div className="flex flex-wrap items-start gap-3 p-4">
                  <div className="mr-auto min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{order.buyer_name}</p>
                      <Badge variant={badge.variant}>{L(badge.label)}</Badge>
                      {fulfilled && (
                        <span title={order.email_error ?? undefined} className={`text-xs ${order.email_status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>
                          <Mail className="mr-1 inline h-3 w-3" />{L(EMAIL_LABEL[order.email_status] ?? order.email_status)}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {order.buyer_email} · {L('Order')} {orderReference(order.id)} · {formatEventShortDate(order.paid_at ?? order.created_at, event.timezone, locale)}
                      {order.status === 'paid' ? ` · ${formatMoney(order.amount_total_cents, order.currency, locale)}` : ''}
                      {order.status === 'pending' && order.expires_at ? ` · ${L('hold until')} ${formatEventTime(order.expires_at, event.timezone, locale, false)}` : ''}
                    </p>
                    {order.email_status === 'failed' && order.email_error && <p className="mt-1 text-xs text-destructive">{order.email_error}</p>}
                    {order.notes && <p className="mt-1 text-xs text-muted-foreground">{L('Note:')} {order.notes}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {fulfilled && (
                      <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => resendTicketEmail(order.id), 'Tickets emailed.')}>
                        <Mail className="h-4 w-4" /> {L(order.email_status === 'sent' ? 'Resend' : 'Send email')}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setEditing(order)}><Pencil className="h-4 w-4" /> {L('Edit')}</Button>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={`/tickets/${order.access_token}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> {L('Tickets page')}</a>
                    </Button>
                  </div>
                </div>
                {order.tickets.length > 0 && (
                  <ul className="divide-y border-t">
                    {order.tickets.map((ticket) => (
                      <TicketRow key={ticket.id} ticket={ticket} tier={tierName.get(ticket.tier_id) ?? ''} event={event} disabled={pending || !fulfilled}
                        onCheckIn={(on) => run(() => setTicketCheckIn(ticket.id, on), on ? 'Checked in.' : 'Check-in undone.')}
                        onVoid={(on) => {
                          if (on && !window.confirm(L('Void this ticket? It will be rejected at the door.'))) return
                          run(() => setTicketVoid(ticket.id, on), on ? 'Ticket voided.' : 'Ticket restored.')
                        }}
                        onRename={(name) => run(() => updateTicketAttendee(ticket.id, name), 'Attendee updated.')} />
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <CompDialog open={compOpen} onOpenChange={setCompOpen} event={event} tiers={tiers} onDone={(text) => { ok(text); router.refresh() }} />
      <BuyerDialog order={editing} onClose={() => setEditing(null)} onDone={(text) => { ok(text); router.refresh() }} />
    </div>
  )
}

function TicketRow({ ticket, tier, event, disabled, onCheckIn, onVoid, onRename }: {
  ticket: ManagerTicket
  tier: string
  event: TicketedEvent
  disabled: boolean
  onCheckIn: (on: boolean) => void
  onVoid: (on: boolean) => void
  onRename: (name: string) => void
}) {
  const L = useAdminLabel()
  const { locale } = useTranslation()
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(ticket.attendee_name ?? '')
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-sm">
      <code className="text-xs">{ticket.ticket_number}</code>
      <span className="text-muted-foreground">{tier}</span>
      {renaming ? (
        <form className="flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); setRenaming(false); onRename(name) }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 w-48" aria-label={L('Attendee name')} autoFocus />
          <Button type="submit" size="sm" variant="outline">{L('Save')}</Button>
        </form>
      ) : (
        <button type="button" className="inline-flex items-center gap-1 hover:underline" onClick={() => setRenaming(true)} disabled={disabled}>
          {ticket.attendee_name || <span className="text-muted-foreground">{L('No name')}</span>}
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </button>
      )}
      <span className="mr-auto">
        {ticket.status === 'checked_in' ? (
          <Badge variant="success"><Check className="h-3 w-3" /> {L('In')} {ticket.checked_in_at ? formatEventTime(ticket.checked_in_at, event.timezone, locale, false) : ''}{ticket.checked_in_by ? ` · ${ticket.checked_in_by}` : ''}</Badge>
        ) : ticket.status === 'void' ? (
          <Badge variant="danger">{L('Void')}</Badge>
        ) : null}
      </span>
      <div className="flex items-center gap-1">
        {ticket.status === 'valid' && <Button size="sm" variant="outline" disabled={disabled} onClick={() => onCheckIn(true)}><Check className="h-4 w-4" /> {L('Check in')}</Button>}
        {ticket.status === 'checked_in' && <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onCheckIn(false)}><Undo2 className="h-4 w-4" /> {L('Undo check-in')}</Button>}
        {ticket.status !== 'void'
          ? <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={disabled} onClick={() => onVoid(true)}><Ban className="h-4 w-4" /> {L('Void')}</Button>
          : <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onVoid(false)}><RotateCcw className="h-4 w-4" /> {L('Restore')}</Button>}
      </div>
    </li>
  )
}

function CompDialog({ open, onOpenChange, event, tiers, onDone }: { open: boolean; onOpenChange: (open: boolean) => void; event: TicketedEvent; tiers: TicketTier[]; onDone: (text: string) => void }) {
  const L = useAdminLabel()
  const { locale } = useTranslation()
  const [pending, startTransition] = useTransition()
  const { flash, fail, setFlash } = useFlash()
  const [v, setV] = useState({ name: '', email: '', tierId: tiers[0]?.id ?? '', quantity: '1', locale, sendEmail: true, enforceCapacity: true, note: '' })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setFlash(null)
    startTransition(async () => {
      const result = await issueCompTickets(event.id, { ...v, quantity: Number(v.quantity), tierId: v.tierId || tiers[0]?.id })
      if (!result.ok) return fail(result.error)
      onOpenChange(false)
      setV((cur) => ({ ...cur, name: '', email: '', quantity: '1', note: '' }))
      onDone(result.emailError ? `${L('Tickets issued, but the email failed:')} ${result.emailError}` : L(result.emailed ? 'Tickets issued and emailed.' : 'Tickets issued.'))
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{L('Issue complimentary tickets')}</DialogTitle>
            <DialogDescription>{L('For guests, artists, press or tickets sold outside the website. No payment is taken.')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label htmlFor="c-name">{L('Name')}</Label><Input id="c-name" required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label htmlFor="c-email">{L('Email')}</Label><Input id="c-email" type="email" required value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></div>
            <div className="grid gap-1.5">
              <Label htmlFor="c-tier">{L('Ticket type')}</Label>
              <select id="c-tier" className={nativeSelectClass} value={v.tierId} onChange={(e) => setV({ ...v, tierId: e.target.value })}>
                {tiers.map((t) => <option key={t.id} value={t.id}>{pickLocalized(t.name, t.name_es, locale)}</option>)}
              </select>
            </div>
            <div className="grid gap-1.5"><Label htmlFor="c-qty">{L('Quantity')}</Label><Input id="c-qty" type="number" min={1} max={50} required value={v.quantity} onChange={(e) => setV({ ...v, quantity: e.target.value })} /></div>
            <div className="grid gap-1.5">
              <Label htmlFor="c-lang">{L('Ticket and email language')}</Label>
              <select id="c-lang" className={nativeSelectClass} value={v.locale} onChange={(e) => setV({ ...v, locale: e.target.value as 'en' | 'es' })}>
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </div>
            <div className="grid gap-1.5"><Label htmlFor="c-note">{L('Internal note (optional)')}</Label><Input id="c-note" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={v.sendEmail} onCheckedChange={(on) => setV({ ...v, sendEmail: on === true })} /> {L('Email the tickets now')}</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={!v.enforceCapacity} onCheckedChange={(on) => setV({ ...v, enforceCapacity: on !== true })} /> {L('Allow over capacity')}</label>
          <FlashMessage flash={flash} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{L('Cancel')}</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} {L('Issue tickets')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function BuyerDialog({ order, onClose, onDone }: { order: ManagerOrder | null; onClose: () => void; onDone: (text: string) => void }) {
  const L = useAdminLabel()
  const [pending, startTransition] = useTransition()
  const { flash, fail, setFlash } = useFlash()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [lastId, setLastId] = useState<string | null>(null)
  if (order && order.id !== lastId) {
    setLastId(order.id)
    setName(order.buyer_name)
    setEmail(order.buyer_email)
    setFlash(null)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!order) return
    startTransition(async () => {
      const result = await updateOrderBuyer(order.id, { name, email })
      if (!result.ok) return fail(result.error)
      onClose()
      setLastId(null)
      onDone(L('Buyer details updated. Use Resend to email the tickets to the new address.'))
    })
  }

  return (
    <Dialog open={!!order} onOpenChange={(open) => { if (!open) { onClose(); setLastId(null) } }}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{L('Edit buyer')}</DialogTitle>
            <DialogDescription>{L('Fix a typo in the name or email address.')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5"><Label htmlFor="b-name">{L('Name')}</Label><Input id="b-name" required value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label htmlFor="b-email">{L('Email')}</Label><Input id="b-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <FlashMessage flash={flash} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => { onClose(); setLastId(null) }}>{L('Cancel')}</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} {L('Save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
