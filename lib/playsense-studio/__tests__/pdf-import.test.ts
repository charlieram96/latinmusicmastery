import { describe, expect, it } from 'vitest';
import { MAX_PDF_PAGES, parsePdfPages } from '../pdf/policy.mjs';
import { readBoundedBody } from '../pdf/recognize';

describe('PDF page selection', () => {
  it('accepts ranges, deduplicates pages, and preserves score order', () => {
    expect(parsePdfPages('5, 1–3, 2', 10)).toEqual([1, 2, 3, 5]);
  });
  it.each(['', '0', '-1', '3-2', '1-99', '2.5', '1,foo', `1-${MAX_PDF_PAGES + 1}`])('rejects invalid or excessive pages: %s', value => {
    expect(() => parsePdfPages(value, 12)).toThrow();
  });
});

describe('PDF upload boundaries', () => {
  it('bounds streamed input without trusting Content-Length', async () => {
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(5)); controller.enqueue(new Uint8Array(5)); controller.close(); } });
    await expect(readBoundedBody(stream, 8)).rejects.toMatchObject({ status: 413 });
  });
  it('rejects an absent body', async () => {
    await expect(readBoundedBody(null, 8)).rejects.toMatchObject({ status: 400 });
  });
});
