// Translates a VexFlow row SVG into pdf-lib drawing calls. VexFlow's SVG
// context only ever emits svg / g / path / rect / text, and — like CSS —
// only writes fill / stroke / stroke-width / font-family / font-size on an
// element when the value differs from its ancestors; otherwise the value
// must be read off the nearest ancestor, up to the row's own <svg>, which
// VexFlow always stamps with its defaults.
import { rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { GlyphOutliner } from './glyph-outlines';

export interface PdfFonts { bravura: GlyphOutliner; academico: GlyphOutliner; helvetica: PDFFont }
export interface RowTransform { x: number; yTop: number; scale: number; pageHeight: number }

const PT_TO_PX = 4 / 3;
const BLACK = rgb(0, 0, 0);
const PUA_START = 0xe000;
const PUA_END = 0xf8ff;

export function parseFontSizePx(value: string | null): number {
  if (!value) return 10;
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return 10;
  return value.trim().endsWith('pt') ? n * PT_TO_PX : n;
}

/** Resolves a CSS-style font-family list to the outliners that know it, in stack order. */
export function outlinersFor(family: string | null, fonts: PdfFonts): GlyphOutliner[] {
  return (family ?? '')
    .split(',')
    .map(name => name.trim().toLowerCase())
    .map(name => {
      if (name.includes('bravura')) return fonts.bravura;
      if (name.includes('academico')) return fonts.academico;
      return null;
    })
    .filter((outliner): outliner is GlyphOutliner => outliner !== null);
}

function isNone(value: string | null): boolean {
  return value === null || value === 'none' || value === 'transparent';
}

// Sums every translate(dx,dy) in a transform list; rotate(...) and any other
// transform function are ignored. VexFlow row SVGs never rotate, so rotation
// support is intentionally left unimplemented.
function parseTranslate(transform: string | null): { dx: number; dy: number } {
  if (!transform) return { dx: 0, dy: 0 };
  const re = /translate\(\s*(-?[\d.]+)[ ,]+(-?[\d.]+)\s*\)/g;
  let dx = 0;
  let dy = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(transform))) {
    dx += Number(m[1]);
    dy += Number(m[2]);
  }
  return { dx, dy };
}

interface StyleContext {
  fill: string;
  stroke: string;
  strokeWidth: number;
  fontFamily: string;
  fontSize: string;
  opacity: number;
  visibility: string;
  display: string;
}

// VexFlow's SVGContext defaults. These seed the context only for whatever
// the row's own root <svg> element doesn't already set explicitly.
const DEFAULT_STYLE: StyleContext = {
  fill: 'black',
  stroke: 'black',
  strokeWidth: 1,
  fontFamily: 'Bravura,Academico',
  fontSize: '10pt',
  opacity: 1,
  visibility: 'visible',
  display: 'inline',
};

function resolveStyle(el: Element, parent: StyleContext): StyleContext {
  const strokeWidthAttr = el.getAttribute('stroke-width');
  const opacityAttr = el.getAttribute('opacity');
  return {
    fill: el.getAttribute('fill') ?? parent.fill,
    stroke: el.getAttribute('stroke') ?? parent.stroke,
    strokeWidth: strokeWidthAttr !== null ? Number(strokeWidthAttr) : parent.strokeWidth,
    fontFamily: el.getAttribute('font-family') ?? parent.fontFamily,
    fontSize: el.getAttribute('font-size') ?? parent.fontSize,
    opacity: opacityAttr !== null ? Number(opacityAttr) : parent.opacity,
    visibility: el.getAttribute('visibility') ?? parent.visibility,
    display: el.getAttribute('display') ?? parent.display,
  };
}

// VexFlow stamps an invisible pointer hit-target <rect> inside every note
// group (opacity="0", no y/height — a zero-height rect). Neither this nor any
// hidden subtree (<g opacity="0">, visibility="hidden", display="none") is
// meant to be painted.
function isHidden(style: StyleContext): boolean {
  return style.opacity === 0 || style.visibility === 'hidden' || style.display === 'none';
}

interface Cursor { dx: number; dy: number; style: StyleContext }

export function drawSvgOnPage(page: PDFPage, svg: SVGSVGElement, fonts: PdfFonts, t: RowTransform): void {
  const walk = (el: Element, cursor: Cursor) => {
    const tag = el.tagName.toLowerCase();
    switch (tag) {
      case 'defs':
      case 'style':
        return;
      case 'svg': {
        const style = resolveStyle(el, cursor.style);
        if (isHidden(style)) return;
        Array.from(el.children).forEach(child => walk(child, { ...cursor, style }));
        return;
      }
      case 'g': {
        const style = resolveStyle(el, cursor.style);
        if (isHidden(style)) return; // skips the whole subtree, matching SVG semantics.
        const { dx, dy } = parseTranslate(el.getAttribute('transform'));
        Array.from(el.children).forEach(child => walk(child, { dx: cursor.dx + dx, dy: cursor.dy + dy, style }));
        return;
      }
      case 'path': {
        const d = el.getAttribute('d');
        if (!d) return;
        const style = resolveStyle(el, cursor.style);
        if (isHidden(style)) return;
        page.drawSvgPath(d, {
          x: t.x + cursor.dx * t.scale,
          y: t.pageHeight - t.yTop - cursor.dy * t.scale,
          scale: t.scale,
          color: isNone(style.fill) ? undefined : BLACK,
          borderColor: isNone(style.stroke) ? undefined : BLACK,
          borderWidth: isNone(style.stroke) ? 0 : style.strokeWidth * t.scale,
        });
        return;
      }
      case 'rect': {
        const x = Number(el.getAttribute('x') ?? 0) + cursor.dx;
        const y = Number(el.getAttribute('y') ?? 0) + cursor.dy;
        const w = Number(el.getAttribute('width') ?? 0);
        const h = Number(el.getAttribute('height') ?? 0);
        if (w <= 0 || h <= 0) return; // degenerate geometry, e.g. VexFlow's hit-target rects.
        const style = resolveStyle(el, cursor.style);
        if (isHidden(style)) return;
        if (isNone(style.fill) && isNone(style.stroke)) return;
        page.drawRectangle({
          x: t.x + x * t.scale,
          y: t.pageHeight - t.yTop - (y + h) * t.scale,
          width: w * t.scale,
          height: h * t.scale,
          color: isNone(style.fill) ? undefined : BLACK,
          borderColor: isNone(style.stroke) ? undefined : BLACK,
          borderWidth: isNone(style.stroke) ? 0 : style.strokeWidth * t.scale,
        });
        return;
      }
      case 'text': {
        const text = el.textContent ?? '';
        if (!text) return;
        const style = resolveStyle(el, cursor.style);
        if (isHidden(style)) return;
        const x = Number(el.getAttribute('x') ?? 0) + cursor.dx;
        const y = Number(el.getAttribute('y') ?? 0) + cursor.dy;
        const sizePx = parseFontSizePx(style.fontSize);
        const sizePt = sizePx * t.scale;
        const baseX = t.x + x * t.scale;
        const baseY = t.pageHeight - t.yTop - y * t.scale;
        const outliners = outlinersFor(style.fontFamily, fonts);

        if (outliners.length === 0) {
          page.drawText(text, { x: baseX, y: baseY, size: sizePt, font: fonts.helvetica, color: BLACK });
          return;
        }

        // Notation glyphs: resolve each code point against the font stack in
        // order, drawing whichever outliner has it as a vector outline and
        // advancing the pen like a text run. A code point none of the listed
        // fonts have is either a Private Use Area notation glyph with no
        // outline anywhere (silently skipped) or ordinary text sharing this
        // run's font-family, drawn with Helvetica instead.
        let penX = baseX;
        for (const ch of text) {
          const cp = ch.codePointAt(0)!;
          let matched = false;
          for (const outliner of outliners) {
            const glyph = outliner.outline(cp);
            if (!glyph) continue;
            const glyphScale = sizePt / outliner.unitsPerEm;
            page.drawSvgPath(glyph.d, { x: penX, y: baseY, scale: glyphScale, color: BLACK, borderWidth: 0 });
            penX += glyph.advance * glyphScale;
            matched = true;
            break;
          }
          if (matched) continue;
          if (cp >= PUA_START && cp <= PUA_END) continue;
          page.drawText(ch, { x: penX, y: baseY, size: sizePt, font: fonts.helvetica, color: BLACK });
          penX += fonts.helvetica.widthOfTextAtSize(ch, sizePt);
        }
        return;
      }
      default:
        if (process.env.NODE_ENV !== 'production') throw new Error(`svg-to-pdf: unsupported element <${tag}>`);
    }
  };
  walk(svg, { dx: 0, dy: 0, style: DEFAULT_STYLE });
}
