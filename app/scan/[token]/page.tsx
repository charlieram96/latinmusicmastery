import type { Metadata } from 'next'
import Image from 'next/image'
import { XCircle } from 'lucide-react'
import { getServerTranslator } from '@/lib/i18n/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { eventCheckInStats, resolveScannerLink } from '@/lib/tickets/scan'
import { formatEventShortDate, formatEventTime, pickLocalized } from '@/lib/tickets/format'
import { LanguageToggle } from '@/components/language-toggle'
import { TicketScanner } from '@/components/tickets/ticket-scanner'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator()
  return { title: t('tickets.scanner.title'), robots: { index: false, follow: false } }
}

/** Door scanner for staff without an admin account, unlocked by a shareable link. */
export default async function StaffScanPage({ params }: { params: Promise<{ token: string }> }) {
  const [{ token }, { t, locale }] = await Promise.all([params, getServerTranslator()])
  const admin = getSupabaseAdmin()
  const resolved = await resolveScannerLink(admin, token)
  const event = resolved.event

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Image src="/lmm-horizontal-logo.png" alt="Latin Music Mastery" width={150} height={17} className="h-4 w-auto" priority />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('tickets.scanner.title')}</span>
          <LanguageToggle variant="icon" className="ml-auto w-auto" />
        </div>
      </header>
      <main className="px-4 py-5">
        {resolved.state !== 'ok' || !event || !resolved.link ? (
          <div className="mx-auto grid max-w-md gap-3 rounded-2xl border bg-card p-8 text-center">
            <XCircle className="mx-auto h-10 w-10 text-destructive" />
            <p className="text-lg font-semibold">{t('tickets.scanner.lockedTitle')}</p>
            <p className="text-sm text-muted-foreground">{t(`tickets.scanner.locked.link_${resolved.state}`)}</p>
          </div>
        ) : (
          <>
            <div className="mx-auto mb-4 max-w-md">
              <h1 className="text-xl font-bold tracking-tight">{pickLocalized(event.title, event.title_es, locale)}</h1>
              <p className="text-sm text-muted-foreground">
                {formatEventShortDate(event.starts_at, event.timezone, locale)} · {formatEventTime(event.starts_at, event.timezone, locale)}
                {event.venue_name ? ` · ${event.venue_name}` : ''}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{t('tickets.scanner.signedAs', { label: resolved.link.label })}</p>
            </div>
            <TicketScanner token={token} initialStats={await eventCheckInStats(admin, event.id)} />
          </>
        )}
      </main>
    </div>
  )
}
