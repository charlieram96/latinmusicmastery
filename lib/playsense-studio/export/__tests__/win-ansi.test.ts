import { describe, expect, it } from 'vitest';
import { StandardFonts, PDFDocument } from 'pdf-lib';
import { canEncodeWinAnsi, winAnsiSafe } from '../pdf/win-ansi';

describe('winAnsiSafe', () => {
  it('passes plain ASCII through unchanged', () => {
    expect(winAnsiSafe('Son Montuno (C / F / G / C) - 120bpm')).toBe('Son Montuno (C / F / G / C) - 120bpm');
    expect(winAnsiSafe('')).toBe('');
  });

  it('passes accented Latin-1 and WinAnsi punctuation through unchanged', () => {
    expect(winAnsiSafe('Montuno básico')).toBe('Montuno básico');
    expect(winAnsiSafe('¿Qué tal, Güiro?')).toBe('¿Qué tal, Güiro?');
    // The site line's middle dot, an em dash, curly quotes and a euro sign are
    // all inside WinAnsi.
    expect(winAnsiSafe('Latin Music Mastery · latinmusicmastery.com')).toBe('Latin Music Mastery · latinmusicmastery.com');
    expect(winAnsiSafe('“clave” — €5')).toBe('“clave” — €5');
  });

  it('substitutes an emoji with a single ?', () => {
    expect(winAnsiSafe('Timba 🔥 Fill')).toBe('Timba ? Fill');
  });

  it('substitutes Cyrillic and CJK', () => {
    expect(winAnsiSafe('Кубинский')).toBe('?');
    expect(winAnsiSafe('クラーベ')).toBe('?');
    expect(winAnsiSafe('Clave クラーベ pattern')).toBe('Clave ? pattern');
  });

  it('collapses a run of un-encodable code points into one ?', () => {
    // A ZWJ family sequence is four code points plus joiners.
    expect(winAnsiSafe('a👨‍👩‍👧b')).toBe('a?b');
    expect(winAnsiSafe('🔥🔥🔥')).toBe('?');
    expect(winAnsiSafe('a\nb\tc')).toBe('a?b?c');
  });

  it('agrees with what pdf-lib will actually accept', async () => {
    const doc = await PDFDocument.create();
    const helvetica = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([300, 100]);
    const hostile = 'Timba 🔥 · Кубинский クラーベ — básico';
    expect(() => helvetica.widthOfTextAtSize(hostile, 10)).toThrow(/WinAnsi cannot encode/);
    const safe = winAnsiSafe(hostile);
    expect(() => page.drawText(safe, { font: helvetica, size: 10, x: 10, y: 10 })).not.toThrow();
    expect(helvetica.widthOfTextAtSize(safe, 10)).toBeGreaterThan(0);
  });

  it('knows the range edges', () => {
    expect(canEncodeWinAnsi(0x20)).toBe(true);   // space
    expect(canEncodeWinAnsi(0x1f)).toBe(false);  // control
    expect(canEncodeWinAnsi(0xff)).toBe(true);   // ÿ
    expect(canEncodeWinAnsi(0x100)).toBe(false); // Ā
    expect(canEncodeWinAnsi(0x2122)).toBe(true); // ™
  });
});
