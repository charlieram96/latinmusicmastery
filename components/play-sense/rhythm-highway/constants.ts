// components/play-sense/rhythm-highway/constants.ts
import type { HitGrade } from '@/lib/play-sense/types'

// ── Highway geometry ──
/** Fraction of canvas height where the hit zone line sits (from top) */
export const HIT_ZONE_Y_FRACTION = 0.92
/** Width of the highway at the hit zone (fraction of canvas width) */
export const HIGHWAY_BOTTOM_WIDTH = 0.7
/** Width of the highway at the vanishing point (fraction of canvas width) */
export const HIGHWAY_TOP_WIDTH = 0.06
/** Vertical position of the vanishing point (fraction of canvas height) */
export const VANISHING_POINT_Y = 0.08
/** How many seconds of upcoming notes are visible on the highway */
export const LOOK_AHEAD_SEC = 3.0

// ── Lane colors ──
export const LANE_COLORS: Record<string, number> = {
  // Conga
  quinto: 0xe74c3c,
  conga: 0x3498db,
  tumba: 0x2ecc71,
  // Timbale
  macho: 0xe74c3c,
  hembra: 0x3498db,
  campana: 0xf1c40f,
  cencerro: 0xe67e22,
  jamblock: 0x9b59b6,
  cascara: 0x1abc9c,
  // Fallback for technique-based lanes
  open: 0x3498db,
  slap: 0xe74c3c,
  mute: 0x9b59b6,
  bass: 0x2ecc71,
  touch: 0x1abc9c,
  rim: 0xf1c40f,
  shell: 0xe67e22,
  bell: 0xf39c12,
  tip: 0x3498db,
  heel: 0x9b59b6,
}

/** Default lane color when surface/technique not found */
export const DEFAULT_LANE_COLOR = 0x3498db

// ── Grade colors (hex numbers for PixiJS) ──
export const GRADE_COLORS_HEX: Record<HitGrade, number> = {
  perfect: 0xffd93d,
  good: 0xeab308,
  ok: 0xf97316,
  miss: 0xef4444,
}

// ── Grade labels ──
export const GRADE_LABELS: Record<HitGrade, string> = {
  perfect: 'PERFECT',
  good: 'GOOD',
  ok: 'OK',
  miss: 'MISS',
}

// ── Grade point display ──
export const GRADE_POINTS_DISPLAY: Record<HitGrade, string> = {
  perfect: '+100',
  good: '+70',
  ok: '+40',
  miss: '',
}

// ── Particle configs ──
export const PARTICLE_COUNTS: Record<HitGrade, number> = {
  perfect: 12,
  good: 8,
  ok: 4,
  miss: 0,
}

export const PARTICLE_LIFETIME_SEC = 0.5
export const COMBO_FIRE_THRESHOLD = 10

// ── Highway visual (warm cinematic theme) ──
export const RAIL_COLOR = 0xd4a854
export const RAIL_GLOW_ALPHA = 0.3
export const GRID_LINE_ALPHA = 0.06
export const BG_COLOR_TOP = 0x0a0806
export const BG_COLOR_MID = 0x1a130d
export const BG_COLOR_BOTTOM = 0x1f1610
export const ROAD_COLOR = 0x120e0a
export const AMBIENT_PARTICLE_COUNT = 25
export const NOTE_MIN_SCALE = 0.3
export const NOTE_MAX_SCALE = 1.0
export const NOTE_MIN_ALPHA = 0.3
export const NOTE_MAX_ALPHA = 1.0

// ── HUD ──
export const HUD_FONT_FAMILY = 'Inter, system-ui, sans-serif'
export const HUD_SCORE_SIZE = 32
export const HUD_COMBO_SIZE = 36
export const HUD_LABEL_SIZE = 10
