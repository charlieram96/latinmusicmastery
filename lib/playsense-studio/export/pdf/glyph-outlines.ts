// Turns notation font bytes into per-character SVG path outlines, so the PDF
// exporter draws music glyphs as vector paths instead of embedding the font.
import fontkit from '@pdf-lib/fontkit';

interface TransformablePath { transform(a: number, b: number, c: number, d: number, e: number, f: number): { toSVG(): string } }

export interface GlyphOutline {
  /** SVG path data in font units, y-axis already flipped to point DOWN. */
  d: string;
  /** Horizontal advance in font units. */
  advance: number;
}

export interface GlyphOutliner {
  unitsPerEm: number;
  /** Outline for one code point, or null when the font has no glyph for it. */
  outline(codePoint: number): GlyphOutline | null;
  /** Total advance of a string at a font size, in the same units as `size`. */
  widthOf(text: string, size: number): number;
}

export function createGlyphOutliner(bytes: Uint8Array): GlyphOutliner {
  const font = fontkit.create(bytes as unknown as Buffer);
  const cache = new Map<number, GlyphOutline | null>();
  const outline = (codePoint: number): GlyphOutline | null => {
    if (cache.has(codePoint)) return cache.get(codePoint)!;
    const glyph = font.hasGlyphForCodePoint(codePoint) ? font.glyphForCodePoint(codePoint) : null;
    let result: GlyphOutline | null = null;
    if (glyph) {
      // fontkit paths are y-up; flip so pdf-lib's drawSvgPath (y-down) draws them upright.
      const d = (glyph.path as unknown as TransformablePath).transform(1, 0, 0, -1, 0, 0).toSVG();
      result = { d, advance: glyph.advanceWidth };
    }
    cache.set(codePoint, result);
    return result;
  };
  return {
    unitsPerEm: font.unitsPerEm,
    outline,
    widthOf(text, size) {
      let total = 0;
      for (const ch of text) total += outline(ch.codePointAt(0)!)?.advance ?? 0;
      return (total / font.unitsPerEm) * size;
    },
  };
}
