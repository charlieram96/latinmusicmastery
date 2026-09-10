export const MAX_PDF_BYTES = 4 * 1024 * 1024;
export const MAX_PDF_PAGES = 8;
export const MAX_RECOGNITION_BYTES = 8 * 1024 * 1024;
export const RECOGNITION_TIMEOUT_MS = 180_000;

/** Parse a human page selection into unique, sorted, one-based page numbers. */
export function parsePdfPages(selection, pageCount) {
  if (!Number.isInteger(pageCount) || pageCount < 1) throw new Error('This PDF has no pages.');
  const pages = new Set();
  const text = selection.trim();
  if (!text) throw new Error('Enter the pages to recognize, for example 1–3, 5.');
  for (const part of text.split(',')) {
    const match = part.trim().match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
    if (!match) throw new Error('Use page numbers and ranges, for example 1–3, 5.');
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start < 1 || end < start || end > pageCount) {
      throw new Error(`Choose pages between 1 and ${pageCount}.`);
    }
    if (end - start + 1 > MAX_PDF_PAGES) throw new Error(`Recognize up to ${MAX_PDF_PAGES} pages at a time.`);
    for (let page = start; page <= end; page++) pages.add(page);
  }
  if (pages.size > MAX_PDF_PAGES) throw new Error(`Recognize up to ${MAX_PDF_PAGES} pages at a time.`);
  return [...pages].sort((a, b) => a - b);
}
