// Single public entry point for exporting a PlaySense Studio section to
// MusicXML, MIDI or PDF. Orchestrates the filename, format-specific writer
// and download; callers (the admin dialog, the student menu) log the
// analytics event themselves since this module must stay importable from a
// client component (no app/actions/* imports here).
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { EXPORT_MIME, sectionExportFilename, type ExportFormat } from './filename';
import { downloadBytes } from './download';
import { writeMusicXml } from './musicxml-writer';
import { writeMidi } from './midi-writer';
import { DEFAULT_PDF_OPTIONS, renderSectionPdf, type PdfExportOptions } from './pdf/render-section';
import type { NotationFontBytes } from './pdf/fonts';

export type { ExportFormat } from './filename';
export type { PdfExportOptions } from './pdf/render-section';
export { DEFAULT_PDF_OPTIONS } from './pdf/render-section';

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
    case 'musicxml':
      payload = writeMusicXml(request.score, request.trackIndexes);
      break;
    case 'midi':
      payload = writeMidi(request.score, request.trackIndexes);
      break;
    case 'pdf':
      payload = await renderSectionPdf(request.score, request.trackIndexes, { ...DEFAULT_PDF_OPTIONS, ...request.pdf }, request.context, { fonts: deps.fonts });
      break;
  }
  download(payload, filename, EXPORT_MIME[request.format]);
  return { filename, byteLength: typeof payload === 'string' ? new TextEncoder().encode(payload).length : payload.length };
}
