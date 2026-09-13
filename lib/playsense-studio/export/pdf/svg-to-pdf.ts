// Translates a VexFlow row SVG into pdf-lib drawing calls. VexFlow's SVG
// context only ever emits svg / g / path / rect / text.
import { rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { GlyphOutliner } from './glyph-outlines';

export interface PdfFonts { bravura: GlyphOutliner; academico: GlyphOutliner; helvetica: PDFFont }
export interface RowTransform { x: number; yTop: number; scale: number; pageHeight: number }

const PT_TO_PX = 4 / 3;
const BLACK = rgb(0, 0, 0);

export function parseFontSizePx(value: string | null): number {
  if (!value) return 10;
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return 10;
  return value.trim().endsWith('pt') ? n * PT_TO_PX : n;
}

export function outlinerFor(family: string | null, fonts: PdfFonts): GlyphOutliner | null {
  const f = (family ?? '').toLowerCase();
  if (f.includes('bravura')) return fonts.bravura;
  if (f.includes('academico')) return fonts.academico;
  return null;
}

function isNone(value: string | null): boolean {
  return value === null || value === 'none' || value === 'transparent';
}

function parseTranslate(transform: string | null): { dx: number; dy: number } {
  const m = /translate\(\s*(-?[\d.]+)[ ,]+(-?[\d.]+)\s*\)/.exec(transform ?? '');
  return m ? { dx: Number(m[1]), dy: Number(m[2]) } : { dx: 0, dy: 0 };
}

interface Cursor { dx: number; dy: number }

export function drawSvgOnPage(page: PDFPage, svg: SVGSVGElement, fonts: PdfFonts, t: RowTransform): void {
  const walk = (el: Element, cursor: Cursor) => {
    const tag = el.tagName.toLowerCase();
    switch (tag) {
      case 'svg':
      case 'defs':
      case 'style':
        if (tag === 'svg') Array.from(el.children).forEach(child => walk(child, cursor));
        return;
      case 'g': {
        const { dx, dy } = parseTranslate(el.getAttribute('transform'));
        Array.from(el.children).forEach(child => walk(child, { dx: cursor.dx + dx, dy: cursor.dy + dy }));
        return;
      }
      case 'path': {
        const d = el.getAttribute('d');
        if (!d) return;
        const fill = el.getAttribute('fill');
        const stroke = el.getAttribute('stroke');
        const strokeWidth = Number(el.getAttribute('stroke-width') ?? 1);
        page.drawSvgPath(d, {
          x: t.x + cursor.dx * t.scale,
          y: t.pageHeight - t.yTop - cursor.dy * t.scale,
          scale: t.scale,
          color: isNone(fill) ? undefined : BLACK,
          borderColor: isNone(stroke) ? undefined : BLACK,
          borderWidth: isNone(stroke) ? 0 : strokeWidth * t.scale,
        });
        return;
      }
      case 'rect': {
        const x = Number(el.getAttribute('x') ?? 0) + cursor.dx;
        const y = Number(el.getAttribute('y') ?? 0) + cursor.dy;
        const w = Number(el.getAttribute('width') ?? 0);
        const h = Number(el.getAttribute('height') ?? 0);
        const fill = el.getAttribute('fill');
        const stroke = el.getAttribute('stroke');
        if (isNone(fill) && isNone(stroke)) return;
        page.drawRectangle({
          x: t.x + x * t.scale,
          y: t.pageHeight - t.yTop - (y + h) * t.scale,
          width: w * t.scale,
          height: h * t.scale,
          color: isNone(fill) ? undefined : BLACK,
          borderColor: isNone(stroke) ? undefined : BLACK,
          borderWidth: isNone(stroke) ? 0 : Number(el.getAttribute('stroke-width') ?? 1) * t.scale,
        });
        return;
      }
      case 'text': {
        const text = el.textContent ?? '';
        if (!text) return;
        const x = Number(el.getAttribute('x') ?? 0) + cursor.dx;
        const y = Number(el.getAttribute('y') ?? 0) + cursor.dy;
        const sizePx = parseFontSizePx(el.getAttribute('font-size'));
        const baseX = t.x + x * t.scale;
        const baseY = t.pageHeight - t.yTop - y * t.scale;
        const outliner = outlinerFor(el.getAttribute('font-family'), fonts);
        if (!outliner) {
          page.drawText(text, { x: baseX, y: baseY, size: sizePx * t.scale, font: fonts.helvetica, color: BLACK });
          return;
        }
        // Notation glyphs: one outline per code point, advanced like a text run.
        const glyphScale = (sizePx * t.scale) / outliner.unitsPerEm;
        let penX = baseX;
        for (const ch of text) {
          const g = outliner.outline(ch.codePointAt(0)!);
          if (!g) continue;
          page.drawSvgPath(g.d, { x: penX, y: baseY, scale: glyphScale, color: BLACK, borderWidth: 0 });
          penX += g.advance * glyphScale;
        }
        return;
      }
      default:
        if (process.env.NODE_ENV !== 'production') throw new Error(`svg-to-pdf: unsupported element <${tag}>`);
    }
  };
  walk(svg, { dx: 0, dy: 0 });
}
