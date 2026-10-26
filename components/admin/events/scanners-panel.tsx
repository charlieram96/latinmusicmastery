'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Copy, ExternalLink, Loader2, Mail, MessageCircle, Plus, QrCode, ScanLine, ShieldOff } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createScannerLink, revokeScannerLink } from '@/app/actions/ticketed-events'
import { formatEventShortDate, formatEventTime, pickLocalized, utcToZonedLocal } from '@/lib/tickets/format'
import type { TicketedEvent } from '@/lib/tickets/types'
import type { ManagerScannerLink } from './event-manager'
import { FlashMessage, Section, useAdminLabel, useFlash } from './shared'

export function ScannersPanel({ event, links }: { event: TicketedEvent; links: ManagerScannerLink[] }) {
  const L = useAdminLabel()
  const { locale } = useTranslation()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const { flash, ok, fail, setFlash } = useFlash()
  const [creating, setCreating] = useState(false)
  const [label, setLabel] = useState('')
  // Default expiry: the day after the event, at venue time.
  const defaultExpiry = utcToZonedLocal(new Date(new Date(event.ends_at ?? event.starts_at).getTime() + 24 * 3600_000).toISOString(), event.timezone)
  const [expires, setExpires] = useState(defaultExpiry)
  const [copied, setCopied] = useState<string | null>(null)
  const [showQr, setShowQr] = useState<ManagerScannerLink | null>(null)
  const [now] = useState(() => Date.now())
  const title = pickLocalized(event.title, event.title_es, locale)

  const create = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const result = await createScannerLink(event.id, { label, expiresAtLocal: expires })
      if (!result.ok) return fail(result.error)
      setCreating(false)
      setLabel('')
      ok(L('Scanner link created. Share it with your door staff.'))
      router.refresh()
    })
  }

  const revoke = (link: ManagerScannerLink) => {
    if (!window.confirm(L('Revoke this link? Anyone using it will be locked out immediately.'))) return
    startTransition(async () => {
      const result = await revokeScannerLink(link.id)
      if (!result.ok) return fail(result.error)
      ok(L('Link revoked.'))
      router.refresh()
    })
  }

  const copy = async (link: ManagerScannerLink) => {
    await navigator.clipboard.writeText(link.url)
    setCopied(link.id)
    window.setTimeout(() => setCopied(null), 1600)
  }

  const shareText = (link: ManagerScannerLink) => `${L('Ticket scanner for')} ${title}: ${link.url}`

  return (
    <div className="grid gap-4">
      <Section
        title={L('Door scanners')}
        description={L('Admins can scan from this panel. For door staff without an admin account, create a scanner link: it opens a camera scanner for this event only and nothing else in the admin.')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm"><Link href={`/admin/events/${event.id}/scan`}><ScanLine className="h-4 w-4" /> {L('Open my scanner')}</Link></Button>
            <Button size="sm" onClick={() => { setFlash(null); setCreating(true) }}><Plus className="h-4 w-4" /> {L('New scanner link')}</Button>
          </div>
        }
      >
        {links.length === 0 ? (
          <p className="text-sm text-muted-foreground">{L('No scanner links yet.')}</p>
        ) : (
          <ul className="grid gap-2">
            {links.map((link) => {
              const expired = !!link.expiresAt && new Date(link.expiresAt).getTime() <= now
              const active = !link.revokedAt && !expired
              return (
                <li key={link.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3 sm:p-4">
                  <div className="mr-auto min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{link.label}</p>
                      <Badge variant={active ? 'success' : 'secondary'}>{L(link.revokedAt ? 'Revoked' : expired ? 'Expired' : 'Active')}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {link.scans} {L('scans')}
                      {link.lastUsedAt ? ` · ${L('last used')} ${formatEventShortDate(link.lastUsedAt, event.timezone, locale)} ${formatEventTime(link.lastUsedAt, event.timezone, locale, false)}` : ''}
                      {link.expiresAt && !link.revokedAt ? ` · ${L(expired ? 'expired' : 'expires')} ${formatEventShortDate(link.expiresAt, event.timezone, locale)}` : ''}
                    </p>
                  </div>
                  {active && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => copy(link)}>{copied === link.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {L(copied === link.id ? 'Copied' : 'Copy link')}</Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowQr(link)}><QrCode className="h-4 w-4" /> {L('QR')}</Button>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={`mailto:?subject=${encodeURIComponent(`${L('Ticket scanner for')} ${title}`)}&body=${encodeURIComponent(shareText(link))}`}><Mail className="h-4 w-4" /> {L('Email')}</a>
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={`https://wa.me/?text=${encodeURIComponent(shareText(link))}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={link.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> {L('Open')}</a>
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={pending} onClick={() => revoke(link)}><ShieldOff className="h-4 w-4" /> {L('Revoke')}</Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Section>
      <FlashMessage flash={creating ? null : flash} />

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={create} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>{L('New scanner link')}</DialogTitle>
              <DialogDescription>{L('Anyone with this link can check in tickets for this event until it expires or you revoke it.')}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="s-label">{L('Who or where is it for?')}</Label>
              <Input id="s-label" required maxLength={80} value={label} placeholder={L('e.g. Main door – Carlos')} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="s-exp">{L('Expires (venue time)')}</Label>
              <Input id="s-exp" type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} />
            </div>
            <FlashMessage flash={creating ? flash : null} />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreating(false)}>{L('Cancel')}</Button>
              <Button type="submit" disabled={pending || !label.trim()}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} {L('Create link')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showQr} onOpenChange={(open) => !open && setShowQr(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{showQr?.label}</DialogTitle>
            <DialogDescription>{L('Door staff can scan this with their phone camera to open the scanner.')}</DialogDescription>
          </DialogHeader>
          {showQr?.qrSvg && <div className="mx-auto w-64 overflow-hidden rounded-xl border bg-white" dangerouslySetInnerHTML={{ __html: showQr.qrSvg }} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
