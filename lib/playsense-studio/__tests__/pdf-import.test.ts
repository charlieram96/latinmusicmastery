import { afterEach, describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { MAX_PDF_BYTES, parsePdfPages } from '../pdf/policy.mjs';
import { readBoundedBody, recognizePdfLocally } from '../pdf/recognize.mjs';

describe('PDF page selection', () => {
  it('accepts ranges, deduplicates pages, and preserves score order', () => {
    expect(parsePdfPages('5, 1–3, 2', 10)).toEqual([1, 2, 3, 5]);
  });
  it.each(['', '0', '-1', '3-2', '1-99', '2.5', '1,foo', '1-8,9'])('rejects invalid or excessive pages: %s', value => {
    expect(() => parsePdfPages(value, 12)).toThrow();
  });
});

describe('PDF recognition input boundaries', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('bounds streamed input without trusting Content-Length', async () => {
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(5)); controller.enqueue(new Uint8Array(5)); controller.close(); } });
    await expect(readBoundedBody(stream, 8)).rejects.toMatchObject({ status: 413 });
  });
  it('rejects invalid and oversized files before launching recognition', async () => {
    await expect(recognizePdfLocally(Buffer.from('not a pdf'))).rejects.toMatchObject({ status: 400 });
    await expect(recognizePdfLocally(Buffer.alloc(MAX_PDF_BYTES + 1))).rejects.toMatchObject({ status: 413 });
  });
  it('rejects excessive page counts and extreme raster dimensions', async () => {
    const many = await PDFDocument.create();
    for (let i = 0; i < 9; i++) many.addPage();
    await expect(recognizePdfLocally(Buffer.from(await many.save()))).rejects.toMatchObject({ status: 400 });
    const huge = await PDFDocument.create(); huge.addPage([5000, 5000]);
    await expect(recognizePdfLocally(Buffer.from(await huge.save()))).rejects.toMatchObject({ status: 400 });
  });
  it('reports an unavailable engine and releases its slot after errors', async () => {
    vi.stubEnv('PLAYSENSE_AUDIVERIS_BIN', '/missing-test-engine');
    const document = await PDFDocument.create(); document.addPage();
    const bytes = Buffer.from(await document.save());
    await expect(recognizePdfLocally(bytes)).rejects.toMatchObject({ status: 503 });
    await expect(recognizePdfLocally(bytes)).rejects.toMatchObject({ status: 503 });
  });
});
