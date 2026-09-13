// @vitest-environment jsdom
// lib/playsense-studio/export/__tests__/svg-to-pdf.test.ts
import { describe, expect, it, vi } from 'vitest';
import { drawSvgOnPage, outlinersFor, parseFontSizePx } from '../pdf/svg-to-pdf';
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

describe('outlinersFor', () => {
  it('maps a font-family list to outliners in stack order, dropping unknown names', () => {
    expect(outlinersFor('Bravura', fonts)).toEqual([fonts.bravura]);
    expect(outlinersFor('Bravura,Academico', fonts)).toEqual([fonts.bravura, fonts.academico]);
    expect(outlinersFor('Arial, sans-serif', fonts)).toEqual([]);
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

  it('draws a real VexFlow-shaped row: fill/stroke/font-family inherited from the root <svg>', () => {
    const page = fakePage();
    const svg = svgOf(
      '<path fill="none" d="M10 80.5L310 80.5"/>' +
      '<rect x="10" y="80" width="1" height="41" stroke="none"/>' +
      '<text stroke="none" font-size="30pt" x="15" y="110"></text>'
    );
    // VexFlow stamps these on the row's own <svg>; children omit whatever matches.
    svg.setAttribute('font-family', 'Bravura,Academico');
    svg.setAttribute('fill', 'black');
    svg.setAttribute('stroke', 'black');

    drawSvgOnPage(page, svg, fonts, t);

    expect(page.drawText).not.toHaveBeenCalled();

    // Stave line: no stroke attr of its own -> inherits black, stroke-width inherits 1.
    const [, pathOpts] = page.drawSvgPath.mock.calls[0];
    expect(pathOpts.borderColor).toBeDefined();
    expect(pathOpts.borderWidth).toBe(0.5); // stroke-width 1 * scale 0.5

    // Barline: no fill attr of its own -> inherits black, so it is drawn, not skipped.
    expect(page.drawRectangle).toHaveBeenCalledTimes(1);
    const [rectOpts] = page.drawRectangle.mock.calls[0];
    expect(rectOpts.color).toBeDefined();

    // Glyph: no font-family attr of its own -> inherits "Bravura,Academico", so it
    // draws as an outline (stave-line path + this glyph outline = 2 calls total).
    expect(page.drawSvgPath).toHaveBeenCalledTimes(2);
  });

  it('resolves a font stack per code point, falling through to the next font in the list', () => {
    const bravuraFake = {
      unitsPerEm: 1000,
      outline: (cp: number) => (cp < 0xe000 ? null : { d: `M0 0 L1000 0 L1000 -1000 L0 -1000 Z B${cp}`, advance: 1000 }),
      widthOf: () => 0,
    };
    const academicoFake = {
      unitsPerEm: 1000,
      outline: (cp: number) => (cp >= 0xe000 ? null : { d: `M0 0 L1000 0 L1000 -1000 L0 -1000 Z A${cp}`, advance: 1000 }),
      widthOf: () => 0,
    };
    const stackFonts = { bravura: bravuraFake, academico: academicoFake, helvetica: fakeFont('Helvetica') };
    const page = fakePage();
    drawSvgOnPage(page, svgOf('<text x="0" y="10" font-family="Bravura,Academico" font-size="10">12</text>'), stackFonts, t);

    expect(page.drawText).not.toHaveBeenCalled();
    expect(page.drawSvgPath).toHaveBeenCalledTimes(3);
    const [d1] = page.drawSvgPath.mock.calls[0];
    const [d2] = page.drawSvgPath.mock.calls[1];
    const [d3] = page.drawSvgPath.mock.calls[2];
    expect(d1).toContain('A49'); // '1': bravura has no ASCII glyphs, academico does
    expect(d2).toContain('A50'); // '2': same
    expect(d3).toContain('B57424'); // 0xE050: bravura has it, academico doesn't
  });

  it('skips a VexFlow-shaped invisible pointer hit-target rect (opacity 0, no height)', () => {
    const page = fakePage();
    drawSvgOnPage(page, svgOf('<rect x="58" width="7" opacity="0" pointer-events="auto"></rect>'), fonts, t);
    expect(page.drawRectangle).not.toHaveBeenCalled();
  });

  it('skips a whole hidden group, including its filled rect and text children', () => {
    const page = fakePage();
    drawSvgOnPage(
      page,
      svgOf(
        '<g opacity="0">' +
        '<rect x="0" y="0" width="10" height="10" fill="black"/>' +
        '<text x="0" y="10" font-family="Arial" font-size="12px">hi</text>' +
        '</g>'
      ),
      fonts,
      t
    );
    expect(page.drawRectangle).not.toHaveBeenCalled();
    expect(page.drawText).not.toHaveBeenCalled();
    expect(page.drawSvgPath).not.toHaveBeenCalled();
  });

  it('skips a Private Use Area glyph no listed font has, without drawing text or throwing', () => {
    const blindOutliner = { unitsPerEm: 1000, outline: () => null, widthOf: () => 0 };
    const blindFonts = { bravura: blindOutliner, academico: blindOutliner, helvetica: fakeFont('Helvetica') };
    const page = fakePage();

    expect(() =>
      drawSvgOnPage(page, svgOf('<text x="0" y="10" font-family="Bravura,Academico" font-size="10"></text>'), blindFonts, t)
    ).not.toThrow();
    expect(page.drawSvgPath).not.toHaveBeenCalled();
    expect(page.drawText).not.toHaveBeenCalled();
  });
});
