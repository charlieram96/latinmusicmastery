// Orchestrates fonts, row-plan, engrave, page-plan and svg-to-pdf into a
// finished PDF: header (title/composer/tempo/time signature), one system per
// page row with measure numbers and (when multi-track) track labels on the
// left, and a footer with the site line and page count.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { loadNotationFonts, type NotationFontBytes } from './fonts';
import { createGlyphOutliner } from './glyph-outlines';
import { buildRowPlan } from './row-plan';
import { engraveTrackRows, PRINT_PADDING_X, type EngravedTrack } from './engrave';
import { PAGE_MARGIN, PAGE_SIZES, planPages } from './page-plan';
import { drawSvgOnPage, type PdfFonts } from './svg-to-pdf';
import { winAnsiSafe } from './win-ansi';
import { ENGRAVE_WIDTH_PX, type PdfExportContext, type PdfExportOptions } from './options';

// Re-exported so every existing `from './pdf/render-section'` import keeps
// working; the declarations themselves live in the pdf-lib-free `options.ts`.
export { DEFAULT_PDF_OPTIONS, ENGRAVE_WIDTH_PX } from './options';
export type { PdfExportContext, PdfExportOptions } from './options';

const INK = rgb(0, 0, 0);
const MUTED = rgb(0.42, 0.4, 0.38);
// Kept deliberately compact: a 3-track score can need two tall systems (e.g. a
// bass part written in treble clef needs many ledger lines) that, at
// ENGRAVE_WIDTH_PX with the page-plan's fixed margins/gaps, leave under 57pt
// of combined header+footer budget on a Letter page. These heights are sized
// to the header's actual drawn content below, with a couple points to spare.
const HEADER_HEIGHT = { withBranding: 42, plain: 28 };
const FOOTER_HEIGHT = 10;
const SITE_LINE = 'Latin Music Mastery · latinmusicmastery.com';
/** SMuFL metNoteQuarterUp — the quarter note used in the tempo mark. */
const TEMPO_NOTE_CODEPOINT = 0xeca5;

function headerHeight(o: PdfExportOptions): number {
  if (!o.includeHeader) return o.includeBranding ? 12 : 0;
  return o.includeBranding ? HEADER_HEIGHT.withBranding : HEADER_HEIGHT.plain;
}

function drawCentered(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color = INK) {
  const safe = winAnsiSafe(text);
  const w = font.widthOfTextAtSize(safe, size);
  page.drawText(safe, { x: (page.getWidth() - w) / 2, y, size, font, color });
}

/** Width of "♩ = <bpm>" at a given size: the Bravura quarter-note glyph's
 * advance (or a plain "q" fallback) plus the bold " = <bpm>" text. Shared by
 * the measuring and drawing passes so the tempo mark can be right-aligned. */
function tempoMarkWidth(bpm: number, bravura: PdfFonts['bravura'], bold: PDFFont, size: number): number {
  const glyphScale = size / bravura.unitsPerEm;
  const outline = bravura.outline(TEMPO_NOTE_CODEPOINT);
  const noteWidth = outline ? outline.advance * glyphScale + 3 : bold.widthOfTextAtSize('q', size) + 3;
  return noteWidth + bold.widthOfTextAtSize(winAnsiSafe(` = ${bpm}`), size);
}

/** Draws "♩ = <bpm>" at (x, y): the Bravura quarter-note outline followed by
 * Helvetica-Bold text, falling back to a plain "q" when the font has no
 * outline for the glyph. Returns the total width drawn. */
function drawTempoMark(page: PDFPage, x: number, y: number, bpm: number, bravura: PdfFonts['bravura'], bold: PDFFont, size: number): number {
  const glyphScale = size / bravura.unitsPerEm;
  const outline = bravura.outline(TEMPO_NOTE_CODEPOINT);
  let penX = x;
  if (outline) {
    page.drawSvgPath(outline.d, { x: penX, y, scale: glyphScale, color: INK, borderWidth: 0 });
    penX += outline.advance * glyphScale + 3;
  } else {
    page.drawText('q', { x: penX, y, size, font: bold, color: INK });
    penX += bold.widthOfTextAtSize('q', size) + 3;
  }
  const rest = winAnsiSafe(` = ${bpm}`);
  page.drawText(rest, { x: penX, y, size, font: bold, color: INK });
  return penX + bold.widthOfTextAtSize(rest, size) - x;
}

/** Compact 2-3 line header: an optional small section-context line, the
 * title, and a shared row with the composer on the left and the tempo mark +
 * time signature grouped on the right. Kept short so it plus the footer never
 * exceeds the page's spare vertical budget (see HEADER_HEIGHT above). */
function drawHeader(
  page: PDFPage,
  score: ScoreDocument,
  o: PdfExportOptions,
  c: PdfExportContext,
  bold: PDFFont,
  regular: PDFFont,
  bravura: PdfFonts['bravura'],
) {
  const top = page.getHeight() - PAGE_MARGIN;
  let y = top - 8;
  if (o.includeBranding) {
    drawCentered(page, `${c.classItemTitle} · Section ${c.sectionIndex + 1} of ${c.sectionCount}`, y, regular, 7, MUTED);
    y -= 14;
  }
  if (!o.includeHeader) return;
  drawCentered(page, score.title || 'Untitled section', y, bold, 14);
  y -= 16;

  if (score.composer) {
    page.drawText(winAnsiSafe(score.composer), { x: PAGE_MARGIN, y, size: 8, font: regular, color: INK });
  }
  const ts = winAnsiSafe(`${score.initialTimeSignature[0]}/${score.initialTimeSignature[1]}`);
  const tsSize = 9;
  const tsWidth = regular.widthOfTextAtSize(ts, tsSize);
  const groupWidth = tempoMarkWidth(Math.round(score.initialTempo), bravura, bold, tsSize) + 8 + tsWidth;
  const groupX = page.getWidth() - PAGE_MARGIN - groupWidth;
  const tempoWidth = drawTempoMark(page, groupX, y, Math.round(score.initialTempo), bravura, bold, tsSize);
  page.drawText(ts, { x: groupX + tempoWidth + 8, y, size: tsSize, font: regular, color: MUTED });
}

function drawFooter(page: PDFPage, pageNo: number, pageCount: number, o: PdfExportOptions, regular: PDFFont) {
  if (!o.includeBranding) return;
  const y = PAGE_MARGIN - 18;
  page.drawText(winAnsiSafe(SITE_LINE), { x: PAGE_MARGIN, y, size: 8, font: regular, color: MUTED });
  const label = winAnsiSafe(`Page ${pageNo} of ${pageCount}`);
  page.drawText(label, { x: page.getWidth() - PAGE_MARGIN - regular.widthOfTextAtSize(label, 8), y, size: 8, font: regular, color: MUTED });
}

export async function renderSectionPdf(
  score: ScoreDocument,
  trackIndexes: number[],
  options: PdfExportOptions,
  context: PdfExportContext,
  deps: { fonts?: () => Promise<NotationFontBytes> } = {},
): Promise<Uint8Array> {
  if (trackIndexes.length === 0) throw new Error('Select at least one track to export.');
  const fontBytes = await (deps.fonts ?? loadNotationFonts)();

  const plan = buildRowPlan(score, trackIndexes, ENGRAVE_WIDTH_PX, { expandRepeats: options.expandRepeats });
  const tracks: EngravedTrack[] = trackIndexes.map(t => engraveTrackRows(plan, t));

  // When tracks cannot be aligned, print them one after another as one "track"
  // per system slot with a single row each, so every row still lands whole.
  const systems: EngravedTrack[][] = plan.aligned
    ? Array.from({ length: plan.rows.length }, () => tracks)
    : tracks.flatMap(t => t.rows.map(() => [t]));
  const rowIndexFor = (system: number): number => {
    if (plan.aligned) return system;
    let offset = system;
    for (const t of tracks) { if (offset < t.rows.length) return offset; offset -= t.rows.length; }
    return 0;
  };
  const trackForSlot = (system: number, slot: number): EngravedTrack => systems[system][slot];

  const doc = await PDFDocument.create();
  doc.setTitle(score.title);
  doc.setProducer('Latin Music Mastery · PlaySense Studio');
  const fonts: PdfFonts = {
    bravura: createGlyphOutliner(fontBytes.bravura),
    academico: createGlyphOutliner(fontBytes.academico),
    helvetica: await doc.embedFont(StandardFonts.Helvetica),
  };
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const rowWidthPx = plan.availWidth + 2 * PRINT_PADDING_X;
  const pages = planPages({
    pageSize: options.pageSize,
    rowWidthPx,
    trackRowHeights: plan.aligned ? tracks.map(t => t.rowHeight) : [Math.max(...tracks.map(t => t.rowHeight))],
    systemCount: systems.length,
    headerHeight: headerHeight(options),
    footerHeight: options.includeBranding ? FOOTER_HEIGHT : 0,
  });

  const { width, height } = PAGE_SIZES[options.pageSize];
  pages.pages.forEach((placed, pageIndex) => {
    const page = doc.addPage([width, height]);
    if (pageIndex === 0) drawHeader(page, score, options, context, bold, fonts.helvetica, fonts.bravura);
    drawFooter(page, pageIndex + 1, pages.pages.length, options, fonts.helvetica);

    for (const r of placed) {
      const track = trackForSlot(r.system, r.trackSlot);
      const row = track.rows[rowIndexFor(r.system)];
      drawSvgOnPage(page, row.svg, fonts, { x: r.x, yTop: r.yTop, scale: r.scale, pageHeight: height });

      const isFirstRowOfSystemOnPage = placed.find(p => p.system === r.system) === r;
      if (isFirstRowOfSystemOnPage && options.includeMeasureNumbers) {
        page.drawText(winAnsiSafe(String(row.firstMeasureNumber)), {
          x: r.x + PRINT_PADDING_X * r.scale, y: height - r.yTop - (row.staffTopY - 14) * r.scale,
          size: 7, font: fonts.helvetica, color: MUTED,
        });
      }
      if (trackIndexes.length > 1) {
        const label = winAnsiSafe(track.displayName);
        page.drawText(label, {
          x: r.x - 4 - fonts.helvetica.widthOfTextAtSize(label, 7),
          y: height - r.yTop - (row.staffTopY + 22) * r.scale,
          size: 7, font: fonts.helvetica, color: MUTED,
        });
      }
    }
  });

  return doc.save();
}
