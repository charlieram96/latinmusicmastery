// The PDF exporter's option shape and defaults, deliberately split out of
// `render-section.ts` so the UI (the admin dialog, the student menu's shared
// option reducer) can read them synchronously without dragging pdf-lib and
// fontkit — about 1 MB of client JS — into a route that may never export a
// PDF. Keep this module dependency-free apart from the page-size type.
import type { PageSize } from './page-plan';

export interface PdfExportOptions {
  pageSize: PageSize;
  includeHeader: boolean;
  includeMeasureNumbers: boolean;
  includeBranding: boolean;
  expandRepeats: boolean;
}

export interface PdfExportContext { classItemTitle: string; sectionIndex: number; sectionCount: number }

export const DEFAULT_PDF_OPTIONS: PdfExportOptions = {
  pageSize: 'letter', includeHeader: true, includeMeasureNumbers: true, includeBranding: true, expandRepeats: false,
};

/** Model px the rows are engraved at before scaling to the page. */
export const ENGRAVE_WIDTH_PX = 700;
