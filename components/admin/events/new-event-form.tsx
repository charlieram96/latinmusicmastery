'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adminLabel } from '@/lib/i18n/admin-labels'
import { createTicketedEvent } from '@/app/actions/ticketed-events'
import { slugify } from '@/lib/tickets/format'
import { TimeZoneSelect } from './time-zone-select'

export function NewEventForm() {
  const { locale } = useTranslation()
  const L = (s: string) => adminLabel(s, locale)
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [startsAt, setStartsAt] = useState('')
  const [timezone, setTimezone] = useState('America/New_York')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createTicketedEvent({ title, slug, startsAtLocal: startsAt, timezone })
      if (!result.ok) return setError(result.error)
      router.push(`/admin/events/${result.id}?tab=details`)
    })
  }

  return (
    <form onSubmit={submit} className="grid gap-5 rounded-2xl border bg-card p-6">
      <div className="grid gap-1.5">
        <Label htmlFor="ev-title">{L('Event title')}</Label>
        <Input
          id="ev-title"
          value={title}
          required
          placeholder={L('e.g. Noche de Salsa Live')}
          onChange={(e) => {
            setTitle(e.target.value)
            if (!slugTouched) setSlug(slugify(e.target.value))
          }}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ev-slug">{L('Public URL')}</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">/events/</span>
          <Input id="ev-slug" value={slug} required onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)) }} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="ev-start">{L('Starts at (venue time)')}</Label>
          <Input id="ev-start" type="datetime-local" value={startsAt} required onChange={(e) => setStartsAt(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ev-tz">{L('Time zone')}</Label>
          <TimeZoneSelect id="ev-tz" value={timezone} onChange={setTimezone} />
        </div>
      </div>
      {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">{error}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending || !title || !slug || !startsAt}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} {L('Create event')}
        </Button>
      </div>
    </form>
  )
}
