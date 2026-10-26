'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { deleteTicketedEvent, updateTicketedEvent } from '@/app/actions/ticketed-events'
import { slugify, utcToZonedLocal } from '@/lib/tickets/format'
import type { TicketedEvent } from '@/lib/tickets/types'
import { FlashMessage, Section, useAdminLabel, useFlash } from './shared'
import { ImageField } from './image-field'
import { TimeZoneSelect, nativeSelectClass } from './time-zone-select'

const CURRENCIES = ['usd', 'eur', 'mxn', 'cad', 'gbp', 'cop']

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid content-start gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function DetailsPanel({ event }: { event: TicketedEvent }) {
  const L = useAdminLabel()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const { flash, ok, fail } = useFlash()
  const tz0 = event.timezone
  const [v, setV] = useState({
    title: event.title,
    title_es: event.title_es ?? '',
    subtitle: event.subtitle ?? '',
    subtitle_es: event.subtitle_es ?? '',
    description: event.description ?? '',
    description_es: event.description_es ?? '',
    slug: event.slug,
    venue_name: event.venue_name ?? '',
    venue_address: event.venue_address ?? '',
    timezone: tz0,
    startsAtLocal: utcToZonedLocal(event.starts_at, tz0),
    endsAtLocal: utcToZonedLocal(event.ends_at, tz0),
    doorsAtLocal: utcToZonedLocal(event.doors_at, tz0),
    currency: event.currency,
    capacity: event.capacity === null ? '' : String(event.capacity),
    max_per_order: String(event.max_per_order),
    image_url: event.image_url,
    email_message: event.email_message ?? '',
    email_message_es: event.email_message_es ?? '',
  })
  const set = <K extends keyof typeof v>(key: K, value: (typeof v)[K]) => setV((cur) => ({ ...cur, [key]: value }))

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const result = await updateTicketedEvent(event.id, {
        ...v,
        capacity: v.capacity === '' ? null : Number(v.capacity),
        max_per_order: Number(v.max_per_order),
      })
      if (!result.ok) return fail(result.error)
      ok(L('Event details saved.'))
      router.refresh()
    })
  }

  const remove = () => {
    if (!window.confirm(L('Delete this event permanently? This only works while it has no orders.'))) return
    startTransition(async () => {
      const result = await deleteTicketedEvent(event.id)
      if (!result.ok) return fail(result.error)
      router.push('/admin/events')
    })
  }

  return (
    <form onSubmit={save} className="grid gap-6">
      <Section title={L('Basics')} description={L('Shown on the event page, the ticket and the email. Spanish fields are optional: when empty, Spanish visitors see the English text, labelled as English.')}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="d-title" label={L('Title (English)')}><Input id="d-title" value={v.title} required onChange={(e) => set('title', e.target.value)} /></Field>
          <Field id="d-title-es" label={L('Title (Spanish)')}><Input id="d-title-es" value={v.title_es} onChange={(e) => set('title_es', e.target.value)} /></Field>
          <Field id="d-sub" label={L('Subtitle (English)')}><Input id="d-sub" value={v.subtitle} onChange={(e) => set('subtitle', e.target.value)} /></Field>
          <Field id="d-sub-es" label={L('Subtitle (Spanish)')}><Input id="d-sub-es" value={v.subtitle_es} onChange={(e) => set('subtitle_es', e.target.value)} /></Field>
          <Field id="d-desc" label={L('Description (English)')}><Textarea id="d-desc" rows={6} value={v.description} onChange={(e) => set('description', e.target.value)} /></Field>
          <Field id="d-desc-es" label={L('Description (Spanish)')}><Textarea id="d-desc-es" rows={6} value={v.description_es} onChange={(e) => set('description_es', e.target.value)} /></Field>
          <Field id="d-slug" label={L('Public URL')} hint={`/events/${v.slug}`}>
            <Input id="d-slug" value={v.slug} required onChange={(e) => set('slug', slugify(e.target.value))} />
          </Field>
        </div>
      </Section>

      <Section title={L('Date and venue')} description={L('Enter times as local time at the venue.')}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field id="d-tz" label={L('Time zone')}><TimeZoneSelect id="d-tz" value={v.timezone} onChange={(tz) => set('timezone', tz)} /></Field>
          <Field id="d-start" label={L('Starts')}><Input id="d-start" type="datetime-local" required value={v.startsAtLocal} onChange={(e) => set('startsAtLocal', e.target.value)} /></Field>
          <Field id="d-doors" label={L('Doors open (optional)')}><Input id="d-doors" type="datetime-local" value={v.doorsAtLocal} onChange={(e) => set('doorsAtLocal', e.target.value)} /></Field>
          <Field id="d-end" label={L('Ends (optional)')} hint={L('Online sales close at the end time (or 3 hours after the start).')}>
            <Input id="d-end" type="datetime-local" value={v.endsAtLocal} onChange={(e) => set('endsAtLocal', e.target.value)} />
          </Field>
          <Field id="d-venue" label={L('Venue name')}><Input id="d-venue" value={v.venue_name} onChange={(e) => set('venue_name', e.target.value)} /></Field>
          <div className="md:col-span-1 xl:col-span-3">
            <Field id="d-addr" label={L('Address')}><Input id="d-addr" value={v.venue_address} onChange={(e) => set('venue_address', e.target.value)} /></Field>
          </div>
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={L('Event image')} description={L('Shown on the event page and, by default, as the ticket artwork.')}>
          <ImageField id="d-image" eventId={event.id} kind="hero" value={v.image_url} onChange={(url) => set('image_url', url)} />
        </Section>
        <Section title={L('Sales settings')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="d-cur" label={L('Currency')}>
              <select id="d-cur" className={nativeSelectClass} value={v.currency} onChange={(e) => set('currency', e.target.value)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
              </select>
            </Field>
            <Field id="d-max" label={L('Max tickets per order')}>
              <Input id="d-max" type="number" min={1} max={50} required value={v.max_per_order} onChange={(e) => set('max_per_order', e.target.value)} />
            </Field>
            <Field id="d-cap" label={L('Total capacity (optional)')} hint={L('Caps all ticket types together, e.g. the venue size. Leave empty to use only per-type limits.')}>
              <Input id="d-cap" type="number" min={0} value={v.capacity} onChange={(e) => set('capacity', e.target.value)} />
            </Field>
          </div>
        </Section>
      </div>

      <Section title={L('Email message')} description={L('Optional note added to the confirmation email (parking, dress code, what to bring).')}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="d-msg" label={L('Message (English)')}><Textarea id="d-msg" rows={4} value={v.email_message} onChange={(e) => set('email_message', e.target.value)} /></Field>
          <Field id="d-msg-es" label={L('Message (Spanish)')}><Textarea id="d-msg-es" rows={4} value={v.email_message_es} onChange={(e) => set('email_message_es', e.target.value)} /></Field>
        </div>
      </Section>

      <FlashMessage flash={flash} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} {L('Save details')}</Button>
        <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" disabled={pending} onClick={remove}>
          <Trash2 className="h-4 w-4" /> {L('Delete event')}
        </Button>
      </div>
    </form>
  )
}
