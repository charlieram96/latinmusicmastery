// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { renderSectionPdf, DEFAULT_PDF_OPTIONS } from '../pdf/render-section';
import { SON_MONTUNO_FIXTURE } from '@/lib/playsense-studio/score-fixtures';

const fontsDir = path.resolve(__dirname, '../../../../public/fonts/notation');
const fonts = async () => ({
  bravura: new Uint8Array(readFileSync(path.join(fontsDir, 'bravura.woff2'))),
  academico: new Uint8Array(readFileSync(path.join(fontsDir, 'academico.woff2'))),
});

beforeAll(() => {
  const proto = (globalThis as unknown as { SVGElement: { prototype: Record<string, unknown> } }).SVGElement.prototype;
  proto.getBBox = function getBBox(this: Element) {
    const len = (this.textContent ?? '').length;
    return { x: 0, y: -8, width: Math.max(6, len * 7), height: 10 };
  };
  const canvasProto = (globalThis as unknown as { HTMLCanvasElement: { prototype: Record<string, unknown> } }).HTMLCanvasElement.prototype;
  canvasProto.getContext = () => ({ measureText: (t: string) => ({ width: t.length * 7 }), font: '' });
});

const context = { classItemTitle: 'Montuno básico en Do', sectionIndex: 1, sectionCount: 4 };

describe('renderSectionPdf', () => {
  it('returns a one-page Letter PDF for a short three-track section', async () => {
    const bytes = await renderSectionPdf(SON_MONTUNO_FIXTURE, [0, 1, 2], DEFAULT_PDF_OPTIONS, context, { fonts });
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect([width, height]).toEqual([612, 792]);
    expect(doc.getTitle()).toBe('Son Montuno (C / F / G / C)');
  });

  it('honours A4 and paginates a long score', async () => {
    const long = { ...SON_MONTUNO_FIXTURE, tracks: SON_MONTUNO_FIXTURE.tracks.map(t => ({ ...t, measures: Array.from({ length: 48 }, (_, i) => ({ ...t.measures[i % 4], number: i + 1, tempoChange: undefined })) })) };
    const bytes = await renderSectionPdf(long, [0, 1, 2], { ...DEFAULT_PDF_OPTIONS, pageSize: 'a4' }, context, { fonts });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
    expect(doc.getPage(0).getSize().width).toBeCloseTo(595.28, 1);
  });

  // Helvetica is WinAnsi-encoded and pdf-lib throws on anything outside it, so
  // before the sanitizer an emoji anywhere in the header, a track label or a
  // VexFlow text run (the Helvetica-fallback path in svg-to-pdf) permanently
  // broke PDF export for that score.
  it('renders a score whose title and track name contain emoji', async () => {
    const hostile = {
      ...SON_MONTUNO_FIXTURE,
      title: 'Son Montuno 🔥 (C / F / G / C)',
      composer: 'Кубинский · クラーベ 🎺',
      tracks: SON_MONTUNO_FIXTURE.tracks.map((t, i) => (i === 0 ? { ...t, displayName: 'Tres 🎸' } : t)),
    };
    const bytes = await renderSectionPdf(hostile, [0, 1, 2], DEFAULT_PDF_OPTIONS, { ...context, classItemTitle: 'Montuno 🔥 básico' }, { fonts });
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    // Metadata is UTF-16 and is deliberately NOT sanitized.
    expect(doc.getTitle()).toBe('Son Montuno 🔥 (C / F / G / C)');
  });

  // The "<count> times" instruction the engraver appends is a plain Helvetica
  // <text> node, i.e. a shape VexFlow never emits; check the translator draws
  // it instead of choking on it.
  it('renders a four-pass repeat, instruction and all', async () => {
    const measures = Array.from({ length: 8 }, (_, i) => ({
      number: i + 1,
      repeat: { id: 'rep', pass: Math.floor(i / 2), count: 4, offset: i % 2, length: 2 },
      voices: [{ number: 1 as const, events: [{ kind: 'note' as const, midi: i % 2 === 0 ? 60 : 62, durationQN: 4 }] }],
    }));
    const score = { ...SON_MONTUNO_FIXTURE, tracks: [{ ...SON_MONTUNO_FIXTURE.tracks[0], measures }] };
    const bytes = await renderSectionPdf(score, [0], DEFAULT_PDF_OPTIONS, context, { fonts });
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');
  });

  it('rejects an empty track selection', async () => {
    await expect(renderSectionPdf(SON_MONTUNO_FIXTURE, [], DEFAULT_PDF_OPTIONS, context, { fonts })).rejects.toThrow(/track/i);
  });
});
