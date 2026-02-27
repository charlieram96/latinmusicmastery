export const SUBSCRIBABLE_INSTRUMENTS = [
  'Bass',
  'Conga',
  'Drums',
  'Guitar',
  'Minor Percussion',
  'Piano',
  'Timbal',
  'Tres',
  'Violin',
] as const

export type SubscribableInstrument = (typeof SUBSCRIBABLE_INSTRUMENTS)[number]

export const INSTRUMENT_CONFIG: Record<
  string,
  { color: string; slug: string }
> = {
  Piano: {
    color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    slug: 'piano',
  },
  Guitar: {
    color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    slug: 'guitar',
  },
  Drums: {
    color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    slug: 'drums',
  },
  Bass: {
    color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
    slug: 'bass',
  },
  Conga: {
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    slug: 'conga',
  },
  Timbal: {
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    slug: 'timbal',
  },
  Violin: {
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    slug: 'violin',
  },
  Tres: {
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    slug: 'tres',
  },
  'Minor Percussion': {
    color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    slug: 'minor-percussion',
  },
}

const DEFAULT_COLOR = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'

export function getInstrumentColor(instrument: string | null | undefined): string {
  if (!instrument) return DEFAULT_COLOR
  return INSTRUMENT_CONFIG[instrument]?.color ?? DEFAULT_COLOR
}

export function getInstrumentSlug(instrument: string): string {
  return INSTRUMENT_CONFIG[instrument]?.slug ?? instrument.toLowerCase().replace(/\s+/g, '-')
}

export function getInstrumentFromSlug(slug: string): string | undefined {
  return Object.entries(INSTRUMENT_CONFIG).find(([, config]) => config.slug === slug)?.[0]
}
