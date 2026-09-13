import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadNotationFonts, resetNotationFontCache, NOTATION_FONT_URLS } from '../pdf/fonts';

const okResponse = () => ({ ok: true, status: 200, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }) as unknown as Response;

afterEach(() => resetNotationFontCache());

describe('loadNotationFonts', () => {
  it('gives every request an abort deadline', async () => {
    const fetchImpl = vi.fn(async () => okResponse());
    await loadNotationFonts(fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    for (const [url, init] of fetchImpl.mock.calls as unknown as Array<[string, RequestInit]>) {
      expect(Object.values(NOTATION_FONT_URLS)).toContain(url);
      expect(init.signal).toBeInstanceOf(AbortSignal);
      expect(init.signal!.aborted).toBe(false);
    }
  });

  it('reports a hung or aborted request in words a user can act on', async () => {
    const fetchImpl = vi.fn(async () => { throw new DOMException('The operation was aborted.', 'TimeoutError'); });
    await expect(loadNotationFonts(fetchImpl as unknown as typeof fetch)).rejects.toThrow(/Could not load notation fonts/);
  });

  it('reports a non-ok response the same way, and forgets the failure', async () => {
    const bad = vi.fn(async () => ({ ok: false, status: 404 }) as unknown as Response);
    await expect(loadNotationFonts(bad as unknown as typeof fetch)).rejects.toThrow(/Could not load notation fonts/);
    // The rejected promise must not be cached, or one blip would disable export
    // for the rest of the page's life.
    const good = vi.fn(async () => okResponse());
    await expect(loadNotationFonts(good as unknown as typeof fetch)).resolves.toMatchObject({ bravura: expect.any(Uint8Array) });
  });
});
