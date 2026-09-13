// Single public entry point for exporting a PlaySense Studio section to
// MusicXML, MIDI or PDF. Orchestrates the filename, format-specific writer
// and download; callers (the admin dialog, the student menu) log the
// analytics event themselves since this module must stay importable from a
// client component (no app/actions/* imports here).
//
// Every writer is loaded on demand inside the format switch. That is
// load-bearing, not a style choice: the student lesson route imports this
// module for its download menu, and a static import of the PDF renderer put
// fontkit (~717 KB) and pdf-lib (~261 KB) into that route's initial JS —
// alongside a MIDI writer students can never invoke. Keep this module's static
// graph free of pdf-lib: `./pdf/options` exists so the option shape and
// defaults stay synchronously importable without it.
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { EXPORT_MIME, sectionExportFilename, type ExportFormat } from './filename';
import { downloadBytes } from './download';
import { DEFAULT_PDF_OPTIONS, type PdfExportOptions } from './pdf/options';
import type { NotationFontBytes } from './pdf/fonts';

export type { ExportFormat } from './filename';
export type { PdfExportContext, PdfExportOptions } from './pdf/options';
export { DEFAULT_PDF_OPTIONS, ENGRAVE_WIDTH_PX } from './pdf/options';

export interface ExportRequest {
  score: ScoreDocument;
  trackIndexes: number[];
  format: ExportFormat;
  pdf?: Partial<PdfExportOptions>;
  context: { classItemTitle: string; sectionIndex: number; sectionCount: number };
}

export interface ExportResult { filename: string; byteLength: number }

export async function exportSection(
  request: ExportRequest,
  deps: { download?: typeof downloadBytes; fonts?: () => Promise<NotationFontBytes> } = {},
): Promise<ExportResult> {
  const download = deps.download ?? downloadBytes;
  const filename = sectionExportFilename(request.context.classItemTitle, request.context.sectionIndex, request.format);
  let payload: Uint8Array | string;
  switch (request.format) {
    case 'musicxml': {
      const { writeMusicXml } = await import('./musicxml-writer');
      payload = writeMusicXml(request.score, request.trackIndexes);
      break;
    }
    case 'midi': {
      const { writeMidi } = await import('./midi-writer');
      payload = writeMidi(request.score, request.trackIndexes);
      break;
    }
    case 'pdf': {
      const { renderSectionPdf } = await import('./pdf/render-section');
      payload = await renderSectionPdf(request.score, request.trackIndexes, { ...DEFAULT_PDF_OPTIONS, ...request.pdf }, request.context, { fonts: deps.fonts });
      break;
    }
  }
  download(payload, filename, EXPORT_MIME[request.format]);
  return { filename, byteLength: typeof payload === 'string' ? new TextEncoder().encode(payload).length : payload.length };
}
