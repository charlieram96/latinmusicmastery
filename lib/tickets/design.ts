// Ticket template the admin customises per event (stored in
// ticketed_events.ticket_design). Every field has a default so a partial or
// older saved design always normalises to a complete one.

import { z } from 'zod'

export const TICKET_LAYOUTS = ['stub', 'pass'] as const
export type TicketLayout = (typeof TICKET_LAYOUTS)[number]

export const TICKET_HEADLINE_FONTS = ['display', 'serif', 'sans'] as const
export type TicketHeadlineFont = (typeof TICKET_HEADLINE_FONTS)[number]

export const TICKET_PRESETS = ['noche', 'ambar', 'papel', 'carmin', 'selva'] as const
export type TicketPreset = (typeof TICKET_PRESETS)[number]

export interface TicketColors {
  /** Ticket face. */
  background: string
  text: string
  muted: string
  accent: string
  /** Second gradient stop; equal to accent for a flat accent. */
  accent2: string
  /** Area around the ticket silhouette (shows through the notches). */
  backdrop: string
}

export const PRESET_COLORS: Record<TicketPreset, TicketColors> = {
  noche: { background: '#100A13', text: '#F6EBDD', muted: '#B7A7AE', accent: '#FFA524', accent2: '#FF324D', backdrop: '#ECE5DE' },
  ambar: { background: '#FFF4E6', text: '#2A1810', muted: '#8A6E5E', accent: '#E2862A', accent2: '#C8323F', backdrop: '#E7DCD0' },
  papel: { background: '#FFFFFF', text: '#1E1A1B', muted: '#6B6466', accent: '#D8943C', accent2: '#BB5A3C', backdrop: '#E9E4DF' },
  carmin: { background: '#3A0F1E', text: '#FFEFE6', muted: '#E0B4B8', accent: '#FFC94D', accent2: '#FF5A48', backdrop: '#ECE5DE' },
  selva: { background: '#0F2420', text: '#EAF7F2', muted: '#9CC2B6', accent: '#2FD1B5', accent2: '#FFC94D', backdrop: '#E3EAE7' },
}

export interface LocalizedText {
  en: string
  es: string
}

export interface TicketDesign {
  version: 1
  layout: TicketLayout
  preset: TicketPreset | 'custom'
  colors: TicketColors
  gradient: boolean
  headlineFont: TicketHeadlineFont
  uppercaseHeadline: boolean
  logo: 'lmm' | 'custom' | 'none'
  logoUrl: string | null
  image: 'event' | 'custom' | 'none'
  imageUrl: string | null
  /** 0 = image hidden behind the face colour, 1 = image at full strength. */
  imageStrength: number
  eyebrow: LocalizedText
  footer: LocalizedText
  show: {
    date: boolean
    doors: boolean
    venue: boolean
    address: boolean
    tier: boolean
    price: boolean
    attendee: boolean
    orderRef: boolean
    barcode: boolean
  }
}

export const DEFAULT_TICKET_DESIGN: TicketDesign = {
  version: 1,
  layout: 'stub',
  preset: 'noche',
  colors: PRESET_COLORS.noche,
  gradient: true,
  headlineFont: 'display',
  uppercaseHeadline: true,
  logo: 'lmm',
  logoUrl: null,
  image: 'event',
  imageUrl: null,
  imageStrength: 0.85,
  eyebrow: { en: 'Latin Music Mastery presents', es: 'Latin Music Mastery presenta' },
  footer: {
    en: 'Present this QR code at the entrance. Each code admits one person and can only be scanned once.',
    es: 'Presenta este código QR en la entrada. Cada código admite a una persona y solo puede escanearse una vez.',
  },
  show: {
    date: true,
    doors: true,
    venue: true,
    address: true,
    tier: true,
    price: true,
    attendee: true,
    orderRef: true,
    barcode: true,
  },
}

const HEX = /^#[0-9a-fA-F]{6}$/
const color = (fallback: string) => z.string().regex(HEX).catch(fallback)
const text = (fallback: string, max: number) => z.string().max(max).catch(fallback)
const flag = (fallback: boolean) => z.boolean().catch(fallback)
// Only web images: these URLs reach <img src> and the PDF image fetcher.
const url = z.string().url().max(2000).regex(/^https?:\/\//i).nullable().catch(null)

const d = DEFAULT_TICKET_DESIGN

const designSchema = z.object({
  version: z.literal(1).catch(1),
  layout: z.enum(TICKET_LAYOUTS).catch(d.layout),
  preset: z.union([z.enum(TICKET_PRESETS), z.literal('custom')]).catch(d.preset),
  colors: z
    .object({
      background: color(d.colors.background),
      text: color(d.colors.text),
      muted: color(d.colors.muted),
      accent: color(d.colors.accent),
      accent2: color(d.colors.accent2),
      backdrop: color(d.colors.backdrop),
    })
    .catch(d.colors),
  gradient: flag(d.gradient),
  headlineFont: z.enum(TICKET_HEADLINE_FONTS).catch(d.headlineFont),
  uppercaseHeadline: flag(d.uppercaseHeadline),
  logo: z.enum(['lmm', 'custom', 'none']).catch(d.logo),
  logoUrl: url,
  image: z.enum(['event', 'custom', 'none']).catch(d.image),
  imageUrl: url,
  imageStrength: z.number().min(0).max(1).catch(d.imageStrength),
  eyebrow: z
    .object({ en: text(d.eyebrow.en, 80), es: text(d.eyebrow.es, 80) })
    .catch(d.eyebrow),
  footer: z
    .object({ en: text(d.footer.en, 300), es: text(d.footer.es, 300) })
    .catch(d.footer),
  show: z
    .object({
      date: flag(d.show.date),
      doors: flag(d.show.doors),
      venue: flag(d.show.venue),
      address: flag(d.show.address),
      tier: flag(d.show.tier),
      price: flag(d.show.price),
      attendee: flag(d.show.attendee),
      orderRef: flag(d.show.orderRef),
      barcode: flag(d.show.barcode),
    })
    .catch(d.show),
})

/** Coerce any stored/posted value into a complete, valid design. */
export function normalizeTicketDesign(raw: unknown): TicketDesign {
  const input = raw && typeof raw === 'object' ? raw : {}
  // Fill missing nested objects from defaults before parsing so a design that
  // only stores e.g. `{ colors: { accent } }` keeps the other colours.
  const merged = deepMerge(DEFAULT_TICKET_DESIGN, input as Record<string, unknown>)
  return designSchema.parse(merged) as TicketDesign
}

export function applyPreset(design: TicketDesign, preset: TicketPreset): TicketDesign {
  return { ...design, preset, colors: { ...PRESET_COLORS[preset] } }
}

function deepMerge<T>(base: T, patch: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const [key, value] of Object.entries(patch)) {
    const current = out[key]
    if (
      value && typeof value === 'object' && !Array.isArray(value) &&
      current && typeof current === 'object' && !Array.isArray(current)
    ) {
      out[key] = deepMerge(current, value as Record<string, unknown>)
    } else if (value !== undefined) {
      out[key] = value
    }
  }
  return out as T
}

/** WCAG relative luminance of a #rrggbb colour (0 = black, 1 = white). */
export function luminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

/** Dark or light ink that stays readable on the given fill. */
export function inkOn(fill: string): string {
  return luminance(fill) > 0.4 ? '#140C10' : '#FFFFFF'
}
