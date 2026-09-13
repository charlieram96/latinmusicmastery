import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PDFDocument, rgb } from 'pdf-lib';
import { createGlyphOutliner } from '../pdf/glyph-outlines';

const fontsDir = path.resolve(__dirname, '../../../../public/fonts/notation');
const bravura = () => createGlyphOutliner(new Uint8Array(readFileSync(path.join(fontsDir, 'bravura.woff2'))));
const academico = () => createGlyphOutliner(new Uint8Array(readFileSync(path.join(fontsDir, 'academico.woff2'))));

describe('notation glyph outlines', () => {
  it('yields a sane outline for the G clef and a notehead', () => {
    const f = bravura();
    const clef = f.outline(0xe050)!;
    const head = f.outline(0xe0a4)!;
    expect(clef.d.length).toBeGreaterThan(200);
    expect(head.d.length).toBeGreaterThan(50);
    expect(clef.advance).toBeGreaterThan(0);
    // All coordinates stay inside a few ems: no garbage from a broken decode.
    const nums = clef.d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(Math.max(...nums.map(Math.abs))).toBeLessThan(f.unitsPerEm * 4);
    expect(f.outline(0x10ffff)).toBeNull();
  });

  it('measures text advances', () => {
    const a = academico();
    expect(a.widthOf('12', 10)).toBeGreaterThan(0);
    expect(a.widthOf('12', 20)).toBeCloseTo(a.widthOf('12', 10) * 2, 6);
  });

  it('draws the outlines into a PDF without embedding a font', async () => {
    const f = bravura();
    const doc = await PDFDocument.create();
    const page = doc.addPage([200, 100]);
    const size = 30;
    const scale = size / f.unitsPerEm;
    let x = 20;
    for (const cp of [0xe050, 0xe0a4]) {
      const g = f.outline(cp)!;
      page.drawSvgPath(g.d, { x, y: 40, scale, color: rgb(0, 0, 0), borderWidth: 0 });
      x += g.advance * scale + 6;
    }
    const bytes = await doc.save();
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(1000);
    expect(doc.getForm().getFields()).toHaveLength(0);
    // No embedded font program in the file.
    expect(Buffer.from(bytes).includes(Buffer.from('/FontFile'))).toBe(false);
  });
});
