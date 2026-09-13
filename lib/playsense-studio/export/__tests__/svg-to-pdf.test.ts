// @vitest-environment jsdom
// lib/playsense-studio/export/__tests__/svg-to-pdf.test.ts
import { describe, expect, it, vi } from 'vitest';
import { drawSvgOnPage, outlinerFor, parseFontSizePx } from '../pdf/svg-to-pdf';
import type { PDFFont, PDFPage } from 'pdf-lib';

const svgOf = (inner: string): SVGSVGElement => {
  const doc = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50">${inner}</svg>`, 'image/svg+xml');
  return doc.documentElement as unknown as SVGSVGElement;
};
const fakeFont = (name: string) => ({ name } as unknown as PDFFont);
// Fake outliner: every code point is a 1000-unit square, advance 1000.
const fakeOutliner = (tag: string) => ({
  unitsPerEm: 1000,
  outline: (cp: number) => ({ d: `M0 0 L1000 0 L1000 -1000 L0 -1000 Z ${tag}${cp}`, advance: 1000 }),
  widthOf: (text: string, size: number) => text.length * size,
});
const fonts = { bravura: fakeOutliner('B'), academico: fakeOutliner('A'), helvetica: fakeFont('Helvetica') };
const fakePage = () => ({ drawSvgPath: vi.fn(), drawRectangle: vi.fn(), drawText: vi.fn() }) as unknown as PDFPage & { drawSvgPath: ReturnType<typeof vi.fn>; drawRectangle: ReturnType<typeof vi.fn>; drawText: ReturnType<typeof vi.fn> };
const t = { x: 54, yTop: 100, scale: 0.5, pageHeight: 792 };

describe('parseFontSizePx', () => {
  it('converts points and pixels', () => {
    expect(parseFontSizePx('10pt')).toBeCloseTo(13.333, 2);
    expect(parseFontSizePx('12px')).toBe(12);
    expect(parseFontSizePx('9')).toBe(9);
    expect(parseFontSizePx(null)).toBe(10);
  });
});

describe('outlinerFor', () => {
  it('maps notation families to outliners and everything else to null', () => {
    expect(outlinerFor('Bravura', fonts)).toBe(fonts.bravura);
    expect(outlinerFor('Academico', fonts)).toBe(fonts.academico);
    expect(outlinerFor('Arial, sans-serif', fonts)).toBeNull();
  });
});

describe('drawSvgOnPage', () => {
  it('draws a path with the flipped, scaled origin', () => {
    const page = fakePage();
    drawSvgOnPage(page, svgOf('<path d="M0 0 L10 10" fill="black" stroke="none"/>'), fonts, t);
    expect(page.drawSvgPath).toHaveBeenCalledTimes(1);
    const [d, opts] = page.drawSvgPath.mock.calls[0];
    expect(d).toBe('M0 0 L10 10');
    expect(opts.x).toBe(54);
    expect(opts.y).toBe(792 - 100);
    expect(opts.scale).toBe(0.5);
    expect(opts.borderWidth).toBe(0);
  });

  it('draws a rect from its bottom-left in PDF space', () => {
    const page = fakePage();
    drawSvgOnPage(page, svgOf('<rect x="10" y="20" width="30" height="4" fill="black"/>'), fonts, t);
    const [opts] = page.drawRectangle.mock.calls[0];
    expect(opts.x).toBe(54 + 10 * 0.5);
    expect(opts.y).toBeCloseTo(792 - 100 - (20 + 4) * 0.5, 6);
    expect(opts.width).toBe(15);
    expect(opts.height).toBe(2);
  });

  it('draws notation text glyph by glyph as outlines at the scaled size', () => {
    const page = fakePage();
    drawSvgOnPage(page, svgOf('<text x="4" y="30" font-family="Bravura" font-size="30pt"></text>'), fonts, t);
    expect(page.drawText).not.toHaveBeenCalled();
    expect(page.drawSvgPath).toHaveBeenCalledTimes(2);
    const [d1, o1] = page.drawSvgPath.mock.calls[0];
    const [, o2] = page.drawSvgPath.mock.calls[1];
    expect(d1).toContain('B57424'); // 0xE050
    const glyphScale = (40 * 0.5) / 1000; // 30pt -> 40px, times row scale, per font unit
    expect(o1.scale).toBeCloseTo(glyphScale, 9);
    expect(o1.x).toBe(54 + 2);
    expect(o1.y).toBe(792 - 100 - 15);
    expect(o2.x).toBeCloseTo(54 + 2 + 1000 * glyphScale, 9);
    expect(o1.borderWidth).toBe(0);
  });

  it('draws non-notation text with Helvetica', () => {
    const page = fakePage();
    drawSvgOnPage(page, svgOf('<text x="0" y="10" font-family="Arial" font-size="12px">hi</text>'), fonts, t);
    const [text, opts] = page.drawText.mock.calls[0];
    expect(text).toBe('hi');
    expect(opts.font).toBe(fonts.helvetica);
    expect(opts.size).toBe(6);
  });

  it('applies a group translate to children', () => {
    const page = fakePage();
    drawSvgOnPage(page, svgOf('<g transform="translate(10,20)"><rect x="0" y="0" width="2" height="2" fill="black"/></g>'), fonts, t);
    const [opts] = page.drawRectangle.mock.calls[0];
    expect(opts.x).toBe(54 + 5);
  });

  it('skips stroke="none" fills of none and honours stroke width on outlines', () => {
    const page = fakePage();
    drawSvgOnPage(page, svgOf('<path d="M0 0 L5 0" fill="none" stroke="black" stroke-width="2"/>'), fonts, t);
    const [, opts] = page.drawSvgPath.mock.calls[0];
    expect(opts.borderWidth).toBe(1);
    expect(opts.color).toBeUndefined();
  });

  it('throws on an unknown element in development', () => {
    const page = fakePage();
    expect(() => drawSvgOnPage(page, svgOf('<circle r="3"/>'), fonts, t)).toThrow(/unsupported/i);
  });
});
