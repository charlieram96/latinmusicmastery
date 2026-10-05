import type { Locale } from '@/lib/i18n'

/**
 * Instrument display names.
 *
 * `courses.instrument`, `instruments.name` and `teachers.instrument` are free-text
 * English values (and `courses.instrument` doubles as a filter key), so we never
 * rewrite them in the database. Instead, render sites call `instrumentLabel()`
 * to get the localized display string. Keys are lower-cased English tokens.
 */
const INSTRUMENT_NAMES_ES: Record<string, string> = {
  various: 'Varios',
  theoretical: 'Teórico',
  demonstrative: 'Demostrativo',
  practical: 'Práctico',
  accordion: 'Acordeón',
  acordeon: 'Acordeón',
  bass: 'Bajo',
  bongo: 'Bongó',
  bongos: 'Bongós',
  cajon: 'Cajón',
  clarinet: 'Clarinete',
  conga: 'Conga',
  congas: 'Congas',
  drums: 'Batería',
  'drum set': 'Batería',
  flute: 'Flauta',
  guitar: 'Guitarra',
  keyboard: 'Teclado',
  keyboards: 'Teclados',
  maracas: 'Maracas',
  'minor percussion': 'Percusión Menor',
  percussion: 'Percusión',
  piano: 'Piano',
  saxophone: 'Saxofón',
  sax: 'Saxo',
  timbal: 'Timbal',
  timbales: 'Timbales',
  tres: 'Tres',
  trombone: 'Trombón',
  trumpet: 'Trompeta',
  vocals: 'Voz',
  voice: 'Voz',
  violin: 'Violín',
  cello: 'Violonchelo',
  viola: 'Viola',
}

/** Separators that may appear inside a free-text instrument list. */
const SEPARATOR = /(\s*,\s*|\s*\/\s*|\s*&\s*|\s+and\s+|\s+y\s+)/i

function translateToken(token: string): string {
  const trimmed = token.trim()
  if (!trimmed) return token
  const key = trimmed.toLowerCase()
  const whole = INSTRUMENT_NAMES_ES[key]
  if (whole) return whole

  // Multi-word token: translate word-by-word only when every word is known,
  // so we never produce a half-translated label like "Master Vocalista".
  const words = key.split(/\s+/)
  if (words.length > 1 && words.every((w) => INSTRUMENT_NAMES_ES[w])) {
    return words.map((w) => INSTRUMENT_NAMES_ES[w]).join(' ')
  }
  return trimmed
}

/**
 * Localize an instrument name, or a free-text list of them
 * ("Piano, Violin", "Guitar and Tres"). Unknown tokens are returned unchanged,
 * and the English value is returned as-is for the `en` locale.
 */
export function instrumentLabel(value: string | null | undefined, locale: Locale): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (locale !== 'es' || !trimmed) return trimmed

  const parts = trimmed.split(SEPARATOR)
  return parts
    .map((part, i) => {
      // Odd indexes are the captured separators.
      if (i % 2 === 1) return /\band\b/i.test(part) ? part.replace(/\band\b/i, 'y') : part
      return translateToken(part)
    })
    .join('')
}
