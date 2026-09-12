// Fetches the notation fonts the PDF exporter embeds. Bytes are cached for the
// page lifetime so repeated exports do not refetch.

export const NOTATION_FONT_URLS = {
  bravura: '/fonts/notation/bravura.woff2',
  academico: '/fonts/notation/academico.woff2',
} as const;

export interface NotationFontBytes {
  bravura: Uint8Array;
  academico: Uint8Array;
}

let cached: Promise<NotationFontBytes> | null = null;

async function fetchBytes(url: string, fetchImpl: typeof fetch): Promise<Uint8Array> {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Could not load notation font ${url} (${res.status})`);
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
