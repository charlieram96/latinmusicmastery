// Fetches the notation font files the PDF exporter reads. The bytes are never
// embedded in the PDF: fontkit turns the glyphs they contain into vector
// outlines (see glyph-outlines.ts), which is what the page draws. Bytes are
// cached for the page lifetime so repeated exports do not refetch.

export const NOTATION_FONT_URLS = {
  bravura: '/fonts/notation/bravura.woff2',
  academico: '/fonts/notation/academico.woff2',
} as const;

export interface NotationFontBytes {
  bravura: Uint8Array;
  academico: Uint8Array;
}

let cached: Promise<NotationFontBytes> | null = null;

/** A stalled font request used to hang the export dialog indefinitely, so give
 * every fetch a deadline and surface a message a student can act on. */
const FETCH_TIMEOUT_MS = 15_000;
const FAILURE_MESSAGE = 'Could not load notation fonts. Check your connection and try again.';

/** `AbortSignal.timeout` is missing on older Safari; there a request simply has
 * no deadline rather than the whole export failing. */
function deadline(ms: number): AbortSignal | undefined {
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(ms) : undefined;
}

async function fetchBytes(url: string, fetchImpl: typeof fetch): Promise<Uint8Array> {
  let res: Response;
  try {
    res = await fetchImpl(url, { signal: deadline(FETCH_TIMEOUT_MS) });
  } catch {
    throw new Error(FAILURE_MESSAGE);
  }
  if (!res.ok) throw new Error(FAILURE_MESSAGE);
  return new Uint8Array(await res.arrayBuffer());
}

export function loadNotationFonts(fetchImpl: typeof fetch = fetch): Promise<NotationFontBytes> {
  if (!cached) {
    cached = Promise.all([
      fetchBytes(NOTATION_FONT_URLS.bravura, fetchImpl),
      fetchBytes(NOTATION_FONT_URLS.academico, fetchImpl),
    ]).then(([bravura, academico]) => ({ bravura, academico }));
    cached.catch(() => { cached = null; });
  }
  return cached;
}

/** Test seam: forget the cached bytes. */
export function resetNotationFontCache(): void {
  cached = null;
}
