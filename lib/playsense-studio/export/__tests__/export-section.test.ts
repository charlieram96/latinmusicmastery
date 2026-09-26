// @vitest-environment jsdom
// lib/playsense-studio/export/__tests__/export-section.test.ts
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { exportSection } from '../index';
import { GUITAR_LICK_FIXTURE } from '@/lib/playsense-studio/score-fixtures';

const fontsDir = path.resolve(__dirname, '../../../../public/fonts/notation');
const fonts = async () => ({
  bravura: new Uint8Array(readFileSync(path.join(fontsDir, 'bravura.woff2'))),
  academico: new Uint8Array(readFileSync(path.join(fontsDir, 'academico.woff2'))),
});
beforeAll(() => {
  const proto = (globalThis as unknown as { SVGElement: { prototype: Record<string, unknown> } }).SVGElement.prototype;
  proto.getBBox = function getBBox(this: Element) { return { x: 0, y: -8, width: Math.max(6, (this.textContent ?? '').length * 7), height: 10 }; };
  (globalThis as unknown as { HTMLCanvasElement: { prototype: Record<string, unknown> } }).HTMLCanvasElement.prototype.getContext = () => ({ measureText: (t: string) => ({ width: t.length * 7 }), font: '' });
});
const context = { classItemTitle: 'Clave básica', sectionIndex: 0, sectionCount: 1 };

describe('exportSection', () => {
  it('downloads MusicXML with the right name and mime type', async () => {
    const download = vi.fn();
    const result = await exportSection({ score: GUITAR_LICK_FIXTURE, trackIndexes: [0], format: 'musicxml', context }, { download });
    expect(result.filename).toBe('clave-basica_section-1.musicxml');
    const [bytes, filename, mime] = download.mock.calls[0];
    expect(typeof bytes).toBe('string');
    expect(filename).toBe('clave-basica_section-1.musicxml');
    expect(mime).toBe('application/vnd.recordare.musicxml+xml');
  });

  it('downloads MIDI bytes', async () => {
    const download = vi.fn();
    await exportSection({ score: GUITAR_LICK_FIXTURE, trackIndexes: [0], format: 'midi', context }, { download });
    expect(download.mock.calls[0][0]).toBeInstanceOf(Uint8Array);
    expect(download.mock.calls[0][1]).toBe('clave-basica_section-1.mid');
  });

  it('downloads a PDF using default options merged with overrides', async () => {
    const download = vi.fn();
    const result = await exportSection({ score: GUITAR_LICK_FIXTURE, trackIndexes: [0], format: 'pdf', pdf: { pageSize: 'a4' }, context }, { download, fonts });
    expect(result.filename).toBe('clave-basica_section-1.pdf');
    expect(download.mock.calls[0][2]).toBe('application/pdf');
    expect(result.byteLength).toBeGreaterThan(1000);
  });
});
