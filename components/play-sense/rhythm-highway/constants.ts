// components/play-sense/rhythm-highway/constants.ts
import type { HitGrade } from '@/lib/play-sense/types'

// ── Highway geometry ──
export const HIT_ZONE_Y_FRACTION = 0.78
export const HIGHWAY_BOTTOM_WIDTH = 0.7
export const HIGHWAY_TOP_WIDTH = 0.20
export const VANISHING_POINT_Y = 0.08
export const LOOK_AHEAD_SEC = 4.0

// ── Lane colors (warm brand palette — amber / gold / terracotta family) ──
// Distinguishable hues that all stay in the warm earth-tone family, matching
// the design's `viz.js` note palette rather than the old cold neon triad.
export const LANE_COLORS: Record<string, number> = {
  // Conga — warm triad
  quinto: 0xd54e3f,  // terracotta
  conga: 0xf2a12c,   // amber
  tumba: 0xe0a43b,   // gold
  // Timbale
  macho: 0xd54e3f,   // terracotta
  hembra: 0xf2a12c,  // amber
  campana: 0xe2b23a, // warm yellow
  cencerro: 0xe8771c,// orange
  jamblock: 0xc84a5a,// rose
  cascara: 0xb5683b, // clay
  // Fallback technique lanes
  open: 0xf2a12c,    // amber
  slap: 0xd54e3f,    // terracotta
  mute: 0xc84a5a,    // rose
  bass: 0xe0a43b,    // gold
  touch: 0xe8771c,   // orange
  rim: 0xe2b23a,     // warm yellow
  shell: 0xb5683b,   // clay
  bell: 0xe2b23a,    // warm yellow
  tip: 0xf2a12c,     // amber
  heel: 0xc84a5a,    // rose
}

export const DEFAULT_LANE_COLOR = 0xf2a12c

// ── Melodic lane palette (cycled by lane index for piano / violin / guitar) ──
// Warm-family spectrum — distinguishable but cohesive with the brand.
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

// ── Open-string note names for fretted instruments (low → high) ──
export const VIOLIN_OPEN_STRINGS = ['G', 'D', 'A', 'E']
export const GUITAR_OPEN_STRINGS = ['E', 'A', 'D', 'G', 'B', 'E']

// ── Grade colors (warm; miss stays semantic red) ──
export const GRADE_COLORS_HEX: Record<HitGrade, number> = {
  perfect: 0xf2c572, // warm gold/cream
  good: 0xf2a12c,    // amber
  ok: 0xc9543c,      // terracotta
  miss: 0xcb3145,    // deep red
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

// ── Highway visual (warm cinematic stage) ──
export const RAIL_COLOR = 0xed8a2c        // amber (rail core / glow base)
export const RAIL_COLOR_FAR = 0xc9543c    // terracotta (rail near the floor)
export const RAIL_GLOW_ALPHA = 0.5
export const GRID_LINE_ALPHA = 0.12
export const GRID_LINE_COLOR = 0xed8a2c   // amber beat rungs
export const HIT_BAR_COLOR = 0xf7c878      // gold timing line
export const BG_COLOR = 0x0b0908          // warm near-black void
export const ROAD_COLOR = 0x140f0c        // warm dark runway
export const ROAD_ALPHA = 0.9
export const NOTE_MIN_SCALE = 0.3
export const NOTE_MAX_SCALE = 1.0
export const NOTE_MIN_ALPHA = 1.0
export const NOTE_MAX_ALPHA = 1.0

// ── HUD ──
export const HUD_FONT_FAMILY = 'Inter, system-ui, sans-serif'
export const HUD_SCORE_SIZE = 32
export const HUD_COMBO_SIZE = 36
export const HUD_LABEL_SIZE = 10
