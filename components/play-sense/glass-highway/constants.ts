// components/play-sense/glass-highway/constants.ts
//
// Brand colors + lane palettes for the Obsidian Glass highway.
// Lane palettes are copied (not imported) from the legacy rhythm-highway so
// the old module can be deleted without breaking this one.

import type { HitGrade } from '@/lib/play-sense/types'

// ── Stage ──
export const BG_TOP = 0x1a1410
export const BG_MID = 0x0b0908
export const BG_BOTTOM = 0x060505
export const BG_GLOW = 0xed8a2c // warm halo behind the top of the stage

// ── Hit line / glass ──
export const HIT_LINE_CORE = 0xfff6e6
export const HIT_LINE_SOFT = 0xffe8bf
export const HIT_LINE_BLOOM = 0xed8a2c
export const GLASS_SHEEN = 0xffe8bf
export const GLASS_EDGE = 0xfff6e6

// ── Notes ──
export const NOTE_HOT_TOP = 0xfff1d6 // cream-hot top of every pill
export const MISS_RED = 0xcb3145
export const MISS_RED_HI = 0xff9c8e

// ── Lane colors (warm brand palette) ──
export const LANE_COLORS: Record<string, number> = {
  // Conga — warm triad
  quinto: 0xd54e3f,
  conga: 0xf2a12c,
  tumba: 0xe0a43b,
  // Timbale
  macho: 0xd54e3f,
  hembra: 0xf2a12c,
  campana: 0xe2b23a,
  cencerro: 0xe8771c,
  jamblock: 0xc84a5a,
  cascara: 0xb5683b,
  // Fallback technique lanes
  open: 0xf2a12c,
  slap: 0xd54e3f,
  mute: 0xc84a5a,
  bass: 0xe0a43b,
  touch: 0xe8771c,
  rim: 0xe2b23a,
  shell: 0xb5683b,
  bell: 0xe2b23a,
  tip: 0xf2a12c,
  heel: 0xc84a5a,
}

export const DEFAULT_LANE_COLOR = 0xf2a12c

export const MELODIC_LANE_COLORS: number[] = [
  0xf2a12c, // amber
  0xe0a43b, // gold
  0xe8771c, // orange
  0xd54e3f, // terracotta
  0xcb3145, // deep red
  0xb5683b, // clay
  0xe2b23a, // warm yellow
  0xc84a5a, // rose
]

// Piano: white-key notes warm amber, black-key notes deeper terracotta
export const PIANO_WHITE_NOTE_COLOR = 0xf2a12c
export const PIANO_BLACK_NOTE_COLOR = 0xd5634f

// ── Grades ──
export const GRADE_COLORS_HEX: Record<HitGrade, number> = {
  perfect: 0xfff6e6, // white-hot cream
  good: 0xf2a12c, // amber
  ok: 0xc9543c, // terracotta
  miss: 0xcb3145, // deep red
}

export const GRADE_LABELS: Record<HitGrade, string> = {
  perfect: 'PERFECT',
  good: 'GOOD',
  ok: 'OK',
  miss: 'MISS',
}

// ── Fonts ──
export const FONT_DISPLAY = 'Montserrat, Inter, system-ui, sans-serif'
export const FONT_BODY = 'Inter, system-ui, sans-serif'

// ── Open-string labels for fretted instruments (low → high) ──
export const VIOLIN_OPEN_STRINGS = ['G', 'D', 'A', 'E']
export const GUITAR_OPEN_STRINGS = ['E', 'A', 'D', 'G', 'B', 'E']
