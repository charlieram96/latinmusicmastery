'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Loader2, RotateCcw } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { saveTicketDesign } from '@/app/actions/ticketed-events'
import {
  DEFAULT_TICKET_DESIGN,
  PRESET_COLORS,
  TICKET_PRESETS,
  applyPreset,
  type TicketColors,
  type TicketDesign,
  type TicketPreset,
} from '@/lib/tickets/design'
import type { Locale } from '@/lib/i18n'
import type { TicketedEvent } from '@/lib/tickets/types'
import { cn } from '@/lib/utils'
import { FlashMessage, Section, useAdminLabel, useFlash } from './shared'
import { ImageField } from './image-field'

const PRESET_NAMES: Record<TicketPreset, string> = { noche: 'Noche', ambar: 'Ámbar', papel: 'Papel (print)', carmin: 'Carmín', selva: 'Selva' }
const COLOR_FIELDS: Array<[keyof TicketColors, string]> = [
  ['background', 'Ticket'],
  ['text', 'Text'],
  ['muted', 'Secondary text'],
  ['accent', 'Accent'],
  ['accent2', 'Accent 2 (gradient)'],
  ['backdrop', 'Page around ticket'],
]
const SHOW_FIELDS: Array<[keyof TicketDesign['show'], string]> = [
  ['date', 'Date and time'],
  ['doors', 'Doors time'],
  ['venue', 'Venue'],
  ['address', 'Address'],
  ['tier', 'Ticket type'],
  ['price', 'Price'],
  ['attendee', 'Attendee name'],
  ['orderRef', 'Order number'],
  ['barcode', 'Barcode'],
]

function Choice<T extends string>({ value, options, onChange, label }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          onClick={() => onChange(key)}
          className={cn('rounded-lg border px-3 py-2 text-sm transition-colors', value === key ? 'border-primary bg-primary/10 font-medium text-primary' : 'hover:bg-accent')}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

export function DesignPanel({ event, design: saved }: { event: TicketedEvent; design: TicketDesign }) {
  const L = useAdminLabel()
  const { locale } = useTranslation()
  const router = useRouter()
  const [design, setDesign] = useState<TicketDesign>(saved)
  const [previewLocale, setPreviewLocale] = useState<Locale>(locale)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [pending, startTransition] = useTransition()
  const { flash, ok, fail } = useFlash()
  const dirty = useMemo(() => JSON.stringify(design) !== JSON.stringify(saved), [design, saved])
  const urlRef = useRef<string | null>(null)
  // Android Chrome and some embedded browsers cannot show PDFs inline; they
  // get a button that opens the same preview instead of an empty frame.
  const [inlinePdf] = useState(() => typeof navigator === 'undefined' || navigator.pdfViewerEnabled !== false)

  // Live preview: re-render the real PDF shortly after each change.
  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/events/${event.id}/ticket-preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ design, locale: previewLocale }),
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(await res.text())
        const url = URL.createObjectURL(await res.blob())
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
        urlRef.current = url
        setPreviewUrl(url)
        setPreviewError(null)
      } catch (err) {
        if (!controller.signal.aborted) setPreviewError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 450)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [design, previewLocale, event.id])

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current) }, [])

  const set = <K extends keyof TicketDesign>(key: K, value: TicketDesign[K]) => setDesign((d) => ({ ...d, [key]: value }))
  const setColor = (key: keyof TicketColors, value: string) => setDesign((d) => ({ ...d, preset: 'custom', colors: { ...d.colors, [key]: value } }))
  const setShow = (key: keyof TicketDesign['show'], value: boolean) => setDesign((d) => ({ ...d, show: { ...d.show, [key]: value } }))
  const setText = (key: 'eyebrow' | 'footer', lang: Locale, value: string) => setDesign((d) => ({ ...d, [key]: { ...d[key], [lang]: value } }))

  const save = () =>
    startTransition(async () => {
      const result = await saveTicketDesign(event.id, design)
      if (!result.ok) return fail(result.error)
      ok(L('Ticket design saved. New and resent tickets use it.'))
      router.refresh()
    })

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="grid content-start gap-6">
        <Section title={L('Layout')}>
          <div className="grid gap-3 sm:grid-cols-2">
            {([['stub', 'Classic stub', 'Landscape ticket with a tear-off QR stub. Great for printing.'], ['pass', 'Mobile pass', 'Tall, phone-shaped ticket with artwork on top.']] as const).map(([key, title, text]) => (
              <button
                key={key}
                type="button"
                aria-pressed={design.layout === key}
                onClick={() => set('layout', key)}
                className={cn('grid gap-3 rounded-xl border p-4 text-left transition-colors', design.layout === key ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'hover:bg-accent')}
              >
                <span aria-hidden className={cn('mx-auto block rounded-md border-2 border-dashed border-muted-foreground/40', key === 'stub' ? 'h-12 w-28' : 'h-20 w-11')} />
                <span className="font-medium">{L(title)}</span>
                <span className="text-xs text-muted-foreground">{L(text)}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section title={L('Colors')}>
          <div className="mb-4 flex flex-wrap gap-2">
            {TICKET_PRESETS.map((preset) => {
              const c = PRESET_COLORS[preset]
              return (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={design.preset === preset}
                  onClick={() => setDesign((d) => applyPreset(d, preset))}
                  className={cn('flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-sm transition-colors', design.preset === preset ? 'border-primary ring-2 ring-primary/20' : 'hover:bg-accent')}
                >
                  <span aria-hidden className="h-6 w-6 rounded-full border" style={{ background: `linear-gradient(135deg, ${c.background} 50%, ${c.accent} 50%)` }} />
                  {L(PRESET_NAMES[preset])}
                </button>
              )
            })}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {COLOR_FIELDS.map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <input
                  id={`c-${key}`}
                  type="color"
                  value={design.colors[key]}
                  onChange={(e) => setColor(key, e.target.value.toUpperCase())}
                  className="h-9 w-11 cursor-pointer rounded-md border bg-transparent p-0.5"
                />
                <Label htmlFor={`c-${key}`} className="text-sm font-normal">{L(label)}</Label>
                <code className="text-xs text-muted-foreground">{design.colors[key]}</code>
              </div>
            ))}
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <Switch checked={design.gradient} onCheckedChange={(on) => set('gradient', on)} /> {L('Gradient accents')}
          </label>
        </Section>

        <Section title={L('Headline')}>
          <div className="grid gap-3">
            <Choice label={L('Headline font')} value={design.headlineFont} onChange={(v) => set('headlineFont', v)}
              options={[['display', L('Bold display')], ['serif', L('Elegant serif')], ['sans', L('Clean sans')]]} />
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={design.uppercaseHeadline} onCheckedChange={(on) => set('uppercaseHeadline', on)} /> {L('Uppercase title')}
            </label>
          </div>
        </Section>

        <Section title={L('Logo and artwork')}>
          <div className="grid gap-5">
            <div className="grid gap-2">
              <span className="text-sm font-medium">{L('Logo')}</span>
              <Choice label={L('Logo')} value={design.logo} onChange={(v) => set('logo', v)}
                options={[['lmm', L('Latin Music Mastery')], ['custom', L('Upload my own')], ['none', L('No logo')]]} />
              {design.logo === 'custom' && (
                <ImageField id="dz-logo" eventId={event.id} kind="logo" value={design.logoUrl} onChange={(url) => set('logoUrl', url)} maxSize={1200} keepAlpha aspect="aspect-[4/1]" />
              )}
            </div>
            <div className="grid gap-2">
              <span className="text-sm font-medium">{L('Artwork')}</span>
              <Choice label={L('Artwork')} value={design.image} onChange={(v) => set('image', v)}
                options={[['event', L('Event image')], ['custom', L('Upload for the ticket')], ['none', L('No artwork')]]} />
              {design.image === 'event' && !event.image_url && <p className="text-xs text-warning">{L('This event has no image yet. Add one in Event details.')}</p>}
              {design.image === 'custom' && (
                <ImageField id="dz-art" eventId={event.id} kind="ticket-art" value={design.imageUrl} onChange={(url) => set('imageUrl', url)} />
              )}
              {design.image !== 'none' && (
                <div className="flex items-center gap-3">
                  <Label htmlFor="dz-strength" className="text-sm font-normal">{L('Artwork strength')}</Label>
                  <input id="dz-strength" type="range" min={0.2} max={1} step={0.05} value={design.imageStrength}
                    onChange={(e) => set('imageStrength', Number(e.target.value))} className="w-40 accent-primary" />
                  <span className="text-xs text-muted-foreground">{Math.round(design.imageStrength * 100)}%</span>
                </div>
              )}
            </div>
          </div>
        </Section>

        <Section title={L('Text on the ticket')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label htmlFor="dz-eb-en">{L('Top line (English)')}</Label><Input id="dz-eb-en" maxLength={80} value={design.eyebrow.en} onChange={(e) => setText('eyebrow', 'en', e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="dz-eb-es">{L('Top line (Spanish)')}</Label><Input id="dz-eb-es" maxLength={80} value={design.eyebrow.es} onChange={(e) => setText('eyebrow', 'es', e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="dz-ft-en">{L('Fine print (English)')}</Label><Textarea id="dz-ft-en" rows={3} maxLength={300} value={design.footer.en} onChange={(e) => setText('footer', 'en', e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="dz-ft-es">{L('Fine print (Spanish)')}</Label><Textarea id="dz-ft-es" rows={3} maxLength={300} value={design.footer.es} onChange={(e) => setText('footer', 'es', e.target.value)} /></div>
          </div>
        </Section>

        <Section title={L('Show on the ticket')} description={L('The QR code and ticket number are always included.')}>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {SHOW_FIELDS.map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <Checkbox checked={design.show[key]} onCheckedChange={(on) => setShow(key, on === true)} /> {L(label)}
              </label>
            ))}
          </div>
        </Section>
      </div>

      <div className="xl:sticky xl:top-6 xl:self-start">
        <Section
          title={L('Live preview')}
          description={L('A sample ticket rendered exactly like the PDF buyers receive.')}
          actions={
            <div className="flex items-center gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label={L('Updating preview')} />}
              <div role="radiogroup" aria-label={L('Preview language')} className="flex rounded-lg border p-0.5">
                {(['en', 'es'] as const).map((lang) => (
                  <button key={lang} type="button" role="radio" aria-checked={previewLocale === lang} onClick={() => setPreviewLocale(lang)}
                    className={cn('rounded-md px-2.5 py-1 text-xs font-medium uppercase', previewLocale === lang ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
                    {lang}
                  </button>
                ))}
              </div>
            </div>
          }
        >
          <div className={cn('overflow-hidden rounded-xl border bg-muted/40', design.layout === 'stub' ? 'aspect-[810/324]' : 'mx-auto aspect-[400/800] max-h-[78vh]')}>
            {previewUrl && inlinePdf ? (
              <iframe title={L('Ticket preview')} src={`${previewUrl}#toolbar=0&navpanes=0&view=Fit`} className="h-full w-full" />
            ) : previewUrl ? (
              <div className="grid h-full place-items-center p-6 text-center">
                <div className="grid justify-items-center gap-3">
                  <p className="text-sm text-muted-foreground">{L('This browser cannot show PDFs inside the page.')}</p>
                  <Button asChild variant="outline"><a href={previewUrl} target="_blank" rel="noopener noreferrer">{L('Open preview')}</a></Button>
                </div>
              </div>
            ) : (
              <div className="grid h-full place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            )}
          </div>
          {previewError && <p className="mt-2 text-sm text-destructive">{L('Preview failed:')} {previewError}</p>}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button onClick={save} disabled={pending || !dirty}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} {L('Save design')}</Button>
            <Button variant="outline" disabled={!dirty} onClick={() => setDesign(saved)}>{L('Discard changes')}</Button>
            <Button variant="ghost" onClick={() => setDesign({ ...DEFAULT_TICKET_DESIGN })}><RotateCcw className="h-4 w-4" /> {L('Reset to default')}</Button>
            {previewUrl && (
              <Button asChild variant="ghost"><a href={previewUrl} download={`ticket-preview-${event.slug}.pdf`}><Download className="h-4 w-4" /> {L('Download sample')}</a></Button>
            )}
            {dirty && <span className="text-xs text-warning">{L('Unsaved changes')}</span>}
          </div>
          <FlashMessage flash={flash} className="mt-4" />
        </Section>
      </div>
    </div>
  )
}
