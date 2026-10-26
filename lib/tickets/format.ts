// Locale-aware formatting shared by ticket PDFs, emails and pages. Event times
// always render in the event's own time zone, not the viewer's.

import type { Locale } from '@/lib/i18n'

export function intlLocale(locale: Locale): string {
  return locale === 'es' ? 'es-US' : 'en-US'
}

/** The authored Spanish variant when present, otherwise the English text. */
export function pickLocalized(en: string | null | undefined, es: string | null | undefined, locale: Locale): string {
  if (locale === 'es' && es && es.trim()) return es
  return en ?? ''
}

export function formatEventDate(iso: string, timeZone: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone,
  }).format(new Date(iso))
}

export function formatEventShortDate(iso: string, timeZone: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone,
  }).format(new Date(iso))
}

export function formatEventTime(iso: string, timeZone: string, locale: Locale, withZone = true): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: 'numeric',
    minute: '2-digit',
    ...(withZone ? { timeZoneName: 'short' as const } : {}),
    timeZone,
  }).format(new Date(iso))
}

export function formatMoney(cents: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}

/** "Free", "$25" or a range like "Free – $60" for the tiers on sale. */
export function formatPriceRange(fromCents: number, toCents: number, currency: string, locale: Locale, freeLabel: string): string {
  const one = (cents: number) => (cents === 0 ? freeLabel : formatMoney(cents, currency, locale))
  return fromCents === toCents ? one(fromCents) : `${one(fromCents)} – ${one(toCents)}`
}

/** Day/month parts for date badges ("NOV" / "22"). */
export function dateBadge(iso: string, timeZone: string, locale: Locale): { month: string; day: string } {
  const parts = new Intl.DateTimeFormat(intlLocale(locale), { month: 'short', day: 'numeric', timeZone }).formatToParts(new Date(iso))
  return {
    month: (parts.find((p) => p.type === 'month')?.value ?? '').replace('.', '').toUpperCase(),
    day: parts.find((p) => p.type === 'day')?.value ?? '',
  }
}

/** Common IANA zones offered in the admin; any valid zone is accepted. */
export const EVENT_TIME_ZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Puerto_Rico',
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Caracas',
  'America/Santo_Domingo',
  'America/Havana',
  'America/Panama',
  'America/Argentina/Buenos_Aires',
  'America/Santiago',
  'America/Sao_Paulo',
  'Europe/Madrid',
  'Europe/London',
  'UTC',
] as const

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/**
 * Convert a wall-clock `YYYY-MM-DDTHH:mm` in `timeZone` to a UTC ISO string.
 * The admin enters event times as local times at the venue.
 */
export function zonedLocalToUtc(local: string, timeZone: string): string | null {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!m) return null
  const [, y, mo, d, h, mi] = m.map(Number)
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  // Two passes settle DST boundaries: the offset at the guess, then at the result.
  let utc = guess - zoneOffsetMs(guess, timeZone)
  utc = guess - zoneOffsetMs(utc, timeZone)
  return new Date(utc).toISOString()
}

/** Inverse of zonedLocalToUtc, for filling `datetime-local` inputs. */
export function utcToZonedLocal(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const local = new Date(t + zoneOffsetMs(t, timeZone))
  return local.toISOString().slice(0, 16)
}

function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(utcMs / 1000) * 1000
}

/** URL slug from a title: accents stripped, lowercase, hyphen-separated. */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/** Short, human-friendly order reference shown on tickets and emails. */
export function orderReference(orderId: string): string {
  return orderId.replace(/-/g, '').slice(0, 8).toUpperCase()
}
