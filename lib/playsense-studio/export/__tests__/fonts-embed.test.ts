import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const fontsDir = path.resolve(__dirname, '../../../../public/fonts/notation');

describe('notation fonts — pdf-lib embedding', () => {
  it('embeds Bravura and draws a SMuFL glyph', async () => {
    const bravura = readFileSync(path.join(fontsDir, 'bravura.woff2'));
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const font = await doc.embedFont(bravura, { subset: true });
    const page = doc.addPage([200, 100]);
    // U+E0A4 noteheadBlack, U+E050 gClef
    page.drawText('', { x: 20, y: 40, size: 30, font, color: rgb(0, 0, 0) });
    const bytes = await doc.save();
    expect(bytes.length).toBeGreaterThan(1000);
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');
    expect(font.widthOfTextAtSize('', 30)).toBeGreaterThan(0);
  });

  it('embeds Academico and measures plain text', async () => {
    const academico = readFileSync(path.join(fontsDir, 'academico.woff2'));
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const font = await doc.embedFont(academico, { subset: true });
    expect(font.widthOfTextAtSize('12', 10)).toBeGreaterThan(0);
  });
});
