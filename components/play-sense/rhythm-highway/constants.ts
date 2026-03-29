// components/play-sense/rhythm-highway/constants.ts
import type { HitGrade } from '@/lib/play-sense/types'

// ── Highway geometry ──
export const HIT_ZONE_Y_FRACTION = 0.78
export const HIGHWAY_BOTTOM_WIDTH = 0.7
export const HIGHWAY_TOP_WIDTH = 0.14
export const VANISHING_POINT_Y = 0.08
export const LOOK_AHEAD_SEC = 3.0

// ── Lane colors (neon / Beat Saber palette) ──
export const LANE_COLORS: Record<string, number> = {
  // Conga — vivid neon triad
  quinto: 0xff1744,  // neon red
  conga: 0x2979ff,   // neon blue
  tumba: 0x00e676,   // neon green
  // Timbale
  macho: 0xff1744,
  hembra: 0x2979ff,
  campana: 0xffea00,
  cencerro: 0xff9100,
  jamblock: 0xd500f9,
  cascara: 0x00e5ff,
  // Fallback technique lanes
  open: 0x2979ff,
  slap: 0xff1744,
  mute: 0xd500f9,
  bass: 0x00e676,
  touch: 0x00e5ff,
  rim: 0xffea00,
  shell: 0xff9100,
  bell: 0xffea00,
  tip: 0x2979ff,
  heel: 0xd500f9,
}

export const DEFAULT_LANE_COLOR = 0x2979ff

// ── Grade colors ──
export const GRADE_COLORS_HEX: Record<HitGrade, number> = {
  perfect: 0x00e5ff,
  good: 0x00e676,
  ok: 0xffea00,
  miss: 0xff1744,
}

export const GRADE_LABELS: Record<HitGrade, string> = {
  perfect: 'PERFECT',
  good: 'GOOD',
  ok: 'OK',
  miss: 'MISS',
}

export const GRADE_POINTS_DISPLAY: Record<HitGrade, string> = {
  perfect: '+100',
  good: '+70',
  ok: '+40',
  miss: '',
}

// ── Particle configs ──
export const PARTICLE_COUNTS: Record<HitGrade, number> = {
  perfect: 16,
  good: 10,
  ok: 5,
  miss: 0,
}

export const PARTICLE_LIFETIME_SEC = 0.6
export const COMBO_FIRE_THRESHOLD = 10

// ── Highway visual (Beat Saber neon void) ──
export const RAIL_COLOR = 0x2979ff
export const RAIL_GLOW_ALPHA = 0.5
export const GRID_LINE_ALPHA = 0.12
export const GRID_LINE_COLOR = 0x2979ff
export const BG_COLOR = 0x020208
export const ROAD_COLOR = 0x06060e
export const ROAD_ALPHA = 0.9
export const NOTE_MIN_SCALE = 0.3
export const NOTE_MAX_SCALE = 1.0
export const NOTE_MIN_ALPHA = 0.4
export const NOTE_MAX_ALPHA = 1.0

// ── HUD ──
export const HUD_FONT_FAMILY = 'Inter, system-ui, sans-serif'
export const HUD_SCORE_SIZE = 32
export const HUD_COMBO_SIZE = 36
export const HUD_LABEL_SIZE = 10
