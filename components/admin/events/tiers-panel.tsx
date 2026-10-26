'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { deleteTicketTier, reorderTicketTiers, saveTicketTier } from '@/app/actions/ticketed-events'
import { formatEventShortDate, formatMoney, pickLocalized, utcToZonedLocal } from '@/lib/tickets/format'
import type { TicketedEvent, TicketTier, TierAvailability } from '@/lib/tickets/types'
import { FlashMessage, Section, centsToInput, inputToCents, useAdminLabel, useFlash } from './shared'

interface Draft {
  id?: string
  name: string
  name_es: string
  description: string
  description_es: string
  price: string
  capacity: string
  salesStartLocal: string
  salesEndLocal: string
  is_active: boolean
}

const EMPTY: Draft = { name: '', name_es: '', description: '', description_es: '', price: '', capacity: '', salesStartLocal: '', salesEndLocal: '', is_active: true }

export function TiersPanel({ event, tiers, availability }: { event: TicketedEvent; tiers: TicketTier[]; availability: TierAvailability[] }) {
  const L = useAdminLabel()
  const { locale } = useTranslation()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const { flash, ok, fail, setFlash } = useFlash()
  const [draft, setDraft] = useState<Draft | null>(null)
  const byTier = new Map(availability.map((a) => [a.tier_id, a]))

  const edit = (tier?: TicketTier) => {
    setFlash(null)
    setDraft(tier ? {
      id: tier.id,
      name: tier.name,
      name_es: tier.name_es ?? '',
      description: tier.description ?? '',
      description_es: tier.description_es ?? '',
      price: centsToInput(tier.price_cents),
      capacity: tier.capacity === null ? '' : String(tier.capacity),
      salesStartLocal: utcToZonedLocal(tier.sales_start_at, event.timezone),
      salesEndLocal: utcToZonedLocal(tier.sales_end_at, event.timezone),
      is_active: tier.is_active,
    } : { ...EMPTY })
  }

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string, after?: () => void) =>
    startTransition(async () => {
      const result = await fn()
      if (!result.ok) return fail(result.error)
      ok(L(success))
      after?.()
      router.refresh()
    })

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft) return
    const price_cents = draft.price.trim() === '' ? 0 : inputToCents(draft.price)
    if (!Number.isFinite(price_cents)) return fail(L('Enter a valid price.'))
    run(() => saveTicketTier(event.id, {
      id: draft.id,
      name: draft.name,
      name_es: draft.name_es,
      description: draft.description,
      description_es: draft.description_es,
      price_cents,
      capacity: draft.capacity.trim() === '' ? null : Number(draft.capacity),
      salesStartLocal: draft.salesStartLocal,
      salesEndLocal: draft.salesEndLocal,
      is_active: draft.is_active,
    }), 'Ticket type saved.', () => setDraft(null))
  }

  const toggle = (tier: TicketTier, active: boolean) =>
    run(() => saveTicketTier(event.id, {
      id: tier.id, name: tier.name, name_es: tier.name_es, description: tier.description, description_es: tier.description_es,
      price_cents: tier.price_cents, capacity: tier.capacity,
      salesStartLocal: utcToZonedLocal(tier.sales_start_at, event.timezone), salesEndLocal: utcToZonedLocal(tier.sales_end_at, event.timezone),
      is_active: active,
    }), active ? 'Ticket type is on sale.' : 'Ticket type turned off.')

  const move = (index: number, delta: number) => {
    const ids = tiers.map((t) => t.id)
    const [moved] = ids.splice(index, 1)
    ids.splice(index + delta, 0, moved)
    run(() => reorderTicketTiers(event.id, ids), 'Order updated.')
  }

  const remove = (tier: TicketTier) => {
    if (!window.confirm(L('Delete this ticket type?'))) return
    run(() => deleteTicketTier(event.id, tier.id), 'Ticket type deleted.')
  }

  const setD = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d))

  return (
    <div className="grid gap-4">
      <Section
        title={L('Ticket types')}
        description={L('Each type has its own price, optional quantity limit and sale window. Buyers see them in this order.')}
        actions={<Button size="sm" onClick={() => edit()}><Plus className="h-4 w-4" /> {L('Add ticket type')}</Button>}
      >
        {tiers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{L('No ticket types yet. Add one to start selling, e.g. General Admission or VIP.')}</p>
        ) : (
          <ul className="grid gap-2">
            {tiers.map((tier, i) => {
              const a = byTier.get(tier.id)
              const saleWindow =
                tier.sales_start_at || tier.sales_end_at
                  ? [tier.sales_start_at && `${L('from')} ${formatEventShortDate(tier.sales_start_at, event.timezone, locale)}`, tier.sales_end_at && `${L('until')} ${formatEventShortDate(tier.sales_end_at, event.timezone, locale)}`].filter(Boolean).join(' ')
                  : null
              return (
                <li key={tier.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3 sm:p-4">
                  <div className="flex flex-col">
                    <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7" aria-label={L('Move up')} disabled={pending || i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7" aria-label={L('Move down')} disabled={pending || i === tiers.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{pickLocalized(tier.name, tier.name_es, locale)}</p>
                    <p className="text-sm text-muted-foreground">
                      {tier.price_cents === 0 ? L('Free') : formatMoney(tier.price_cents, event.currency, locale)}
                      {' · '}{a?.sold ?? 0}{tier.capacity !== null ? ` / ${tier.capacity}` : ''} {L('issued')}
                      {a && a.taken > a.sold ? ` · ${a.taken - a.sold} ${L('in checkout now')}` : ''}
                      {saleWindow ? ` · ${saleWindow}` : ''}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={tier.is_active} disabled={pending} onCheckedChange={(on) => toggle(tier, on)} aria-label={L('On sale')} />
                    {L(tier.is_active ? 'On sale' : 'Off')}
                  </label>
                  <Button type="button" variant="outline" size="sm" onClick={() => edit(tier)}><Pencil className="h-4 w-4" /> {L('Edit')}</Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={L('Delete')} disabled={pending} onClick={() => remove(tier)}><Trash2 className="h-4 w-4" /></Button>
                </li>
              )
            })}
          </ul>
        )}
      </Section>
      <FlashMessage flash={draft ? null : flash} />

      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={save} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>{L(draft?.id ? 'Edit ticket type' : 'New ticket type')}</DialogTitle>
              <DialogDescription>{L('Prices are in')} {event.currency.toUpperCase()}. {L('Leave the price at 0 for free tickets.')}</DialogDescription>
            </DialogHeader>
            {draft && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5"><Label htmlFor="t-name">{L('Name (English)')}</Label><Input id="t-name" required value={draft.name} placeholder={L('e.g. General Admission')} onChange={(e) => setD('name', e.target.value)} /></div>
                <div className="grid gap-1.5"><Label htmlFor="t-name-es">{L('Name (Spanish)')}</Label><Input id="t-name-es" value={draft.name_es} placeholder={L('e.g. Entrada general')} onChange={(e) => setD('name_es', e.target.value)} /></div>
                <div className="grid gap-1.5"><Label htmlFor="t-desc">{L('Description (English)')}</Label><Input id="t-desc" value={draft.description} onChange={(e) => setD('description', e.target.value)} /></div>
                <div className="grid gap-1.5"><Label htmlFor="t-desc-es">{L('Description (Spanish)')}</Label><Input id="t-desc-es" value={draft.description_es} onChange={(e) => setD('description_es', e.target.value)} /></div>
                <div className="grid gap-1.5">
                  <Label htmlFor="t-price">{L('Price')}</Label>
                  <Input id="t-price" inputMode="decimal" value={draft.price} placeholder="0.00" onChange={(e) => setD('price', e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="t-cap">{L('Quantity available (optional)')}</Label>
                  <Input id="t-cap" type="number" min={0} value={draft.capacity} placeholder={L('Unlimited')} onChange={(e) => setD('capacity', e.target.value)} />
                </div>
                <div className="grid gap-1.5"><Label htmlFor="t-start">{L('Sales start (optional)')}</Label><Input id="t-start" type="datetime-local" value={draft.salesStartLocal} onChange={(e) => setD('salesStartLocal', e.target.value)} /></div>
                <div className="grid gap-1.5"><Label htmlFor="t-end">{L('Sales end (optional)')}</Label><Input id="t-end" type="datetime-local" value={draft.salesEndLocal} onChange={(e) => setD('salesEndLocal', e.target.value)} /></div>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <Switch checked={draft.is_active} onCheckedChange={(on) => setD('is_active', on)} /> {L('On sale')}
                </label>
              </div>
            )}
            <FlashMessage flash={draft ? flash : null} />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDraft(null)}>{L('Cancel')}</Button>
              <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} {L('Save ticket type')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
