// Pure. Keeps user-supplied text safe for pdf-lib's Standard 14 fonts.
//
// pdf-lib encodes StandardFonts.Helvetica with WinAnsi and *throws*
// (`WinAnsi cannot encode "…" (0x…)`) on any code point outside it — an emoji
// in a lesson title, a Cyrillic or CJK track name, even a stray newline. That
// would permanently break PDF export for that score, so every string handed to
// a Helvetica `drawText` (or measured with `widthOfTextAtSize`, so centring
// stays honest) goes through `winAnsiSafe` first. PDF *metadata*
// (`doc.setTitle`) is UTF-16 and needs no sanitizing.
//
// Accented Latin-1 — "Montuno básico", "Güiro", "¿Qué?" — is inside WinAnsi
// and passes through unchanged.

/** Inclusive code-point ranges WinAnsi can encode, from pdf-lib's own
 * `Encodings.WinAnsi.supportedCodePoints` (218 code points). */
const WIN_ANSI_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x20, 0x7e], [0xa0, 0xff], [0x152, 0x153], [0x160, 0x161], [0x178, 0x178],
  [0x17d, 0x17e], [0x192, 0x192], [0x2c6, 0x2c6], [0x2dc, 0x2dc],
  [0x2013, 0x2014], [0x2018, 0x201a], [0x201c, 0x201e], [0x2020, 0x2022],
  [0x2026, 0x2026], [0x2030, 0x2030], [0x2039, 0x203a], [0x20ac, 0x20ac],
  [0x2122, 0x2122],
];

/** Replacement for anything WinAnsi has no glyph for. */
const REPLACEMENT = '?';

export function canEncodeWinAnsi(codePoint: number): boolean {
  return WIN_ANSI_RANGES.some(([lo, hi]) => codePoint >= lo && codePoint <= hi);
}

/**
 * Returns `text` with every un-encodable code point replaced by `?`, adjacent
 * un-encodable code points collapsing into a single `?` (so a multi-code-point
 * emoji sequence reads as one placeholder, not four).
 */
export function winAnsiSafe(text: string): string {
  let out = '';
  let dropping = false;
  for (const ch of text) {
    if (canEncodeWinAnsi(ch.codePointAt(0)!)) {
      out += ch;
      dropping = false;
    } else if (!dropping) {
      out += REPLACEMENT;
      dropping = true;
    }
  }
  return out;
}
