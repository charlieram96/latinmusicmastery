// Browse Courses — cover gradients + instrument glyphs.
// Ported from the Latin Music Mastery design handoff (browse-courses/data.js,
// Direction A). Used to render warm, branded card covers when a course has no
// thumbnail, plus the faint instrument glyph that sits behind the cover.

// ---- Genre → cinematic warm gradient cover ----
// Kept inside the brand's warm earth-tone family; bossa nova is the single
// muted cool accent. Each is darkened toward the bottom for legible overlay text.
type GradientSpec = { a: string; b: string; deg: number }

const GENRE_COVER: Record<string, GradientSpec> = {
  'Son Cubano': { a: '#7a3417', b: '#cf6a24', deg: 145 },
  Salsa: { a: '#8a1f1c', b: '#e0792a', deg: 150 },
  Timba: { a: '#6e1c20', b: '#c4452f', deg: 140 },
  Rumba: { a: '#5c2a12', b: '#b9621f', deg: 150 },
  Charanga: { a: '#6b3c0e', b: '#dba23b', deg: 145 },
  'Danzón': { a: '#4c3414', b: '#a87b2c', deg: 150 },
  Bolero: { a: '#5a1018', b: '#9c2a33', deg: 140 },
  Bachata: { a: '#5e2418', b: '#b65a3e', deg: 150 },
  'Cha-cha-chá': { a: '#7a4a0f', b: '#e0a43b', deg: 145 },
  'Bossa Nova': { a: '#123832', b: '#2f6f63', deg: 150 },
  Cumbia: { a: '#7a3c10', b: '#d8842a', deg: 150 },
}

// Deterministic warm-gradient palette for any genre not in GENRE_COVER, so every
// generated cover stays on-brand instead of falling back to a single default.
const FALLBACK_GRADIENTS: GradientSpec[] = [
  { a: '#7a3417', b: '#cf6a24', deg: 145 },
  { a: '#8a1f1c', b: '#e0792a', deg: 150 },
  { a: '#5c2a12', b: '#b9621f', deg: 150 },
  { a: '#6b3c0e', b: '#dba23b', deg: 145 },
  { a: '#5a1018', b: '#9c2a33', deg: 140 },
  { a: '#5e2418', b: '#b65a3e', deg: 150 },
]

// Instrument → Lucide-style glyph (inline SVG path markup as a string).
// Covers the app's SUBSCRIBABLE_INSTRUMENTS; Drums + Minor Percussion are new
// (the mock used Bongó/Vocals, which the app doesn't subscribe to).
const INSTRUMENT_GLYPH: Record<string, string> = {
  Timbal: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/>',
  Conga: '<path d="M7 3h10l-1.2 15a3.8 2.5 0 0 1-7.6 0z"/><ellipse cx="12" cy="3" rx="5" ry="1.6"/>',
  Drums: '<ellipse cx="12" cy="6.5" rx="7" ry="2.4"/><path d="M5 6.5v8a7 2.4 0 0 0 14 0v-8"/><path d="M5 10.5a7 2.4 0 0 0 14 0"/>',
  'Minor Percussion':
    '<circle cx="8" cy="7" r="4"/><path d="M8 11v8"/><circle cx="17" cy="9.5" r="3"/><path d="M17 12.5v6.5"/>',
  Piano: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 5v14M9 5v9M15 5v9M21 5v14M7 5v9M13 5v9M19 5v9"/>',
  Bass: '<path d="M9 18V4l11-1.5v12"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="14.5" r="3"/>',
  Violin: '<path d="M11 2c-2 2-1 5 1 7s5 3 7 1"/><path d="M5 21c-1.5-1.5-1.5-4 0-5.5l6-6c1.5-1.5 4-1.5 5.5 0s1.5 4 0 5.5l-6 6c-1.5 1.5-4 1.5-5.5 0z"/>',
  Tres: '<path d="M14 3l7 7-4 4"/><circle cx="8.5" cy="15.5" r="5.5"/><circle cx="8.5" cy="15.5" r="2"/>',
  Guitar: '<path d="M11 2l3 3"/><path d="M9 7a4 4 0 1 0 5 5l5-5-3-3-5 5"/><circle cx="8" cy="15" r="4"/>',
}

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** CSS gradient string for a course cover, keyed by musical-style/genre name. */
export function coverStyle(genre: string | null | undefined): string {
  const g =
    (genre && GENRE_COVER[genre]) ||
    FALLBACK_GRADIENTS[hashString(genre || 'Son Cubano') % FALLBACK_GRADIENTS.length]
  return `linear-gradient(${g.deg}deg, ${g.a} 0%, ${g.b} 100%)`
}

/** Inline SVG path markup for an instrument glyph (use via dangerouslySetInnerHTML). */
export function glyph(instrument: string | null | undefined): string {
  return (instrument && INSTRUMENT_GLYPH[instrument]) || INSTRUMENT_GLYPH.Timbal
}

/** HSL triple (no `hsl()` wrapper) for a difficulty level dot/label. */
export function levelColor(difficulty: string | null | undefined): string {
  switch (difficulty) {
    case 'beginner':
      return '142 64% 45%' // green
    case 'intermediate':
      return '38 90% 52%' // amber/yellow
    case 'advanced':
      return '0 75% 55%' // red
    default:
      return '0 0% 60%' // unset / all levels
  }
}
