export type PageSize = 'letter' | 'a4';

export const PAGE_SIZES: Record<PageSize, { width: number; height: number }> = {
  letter: { width: 612, height: 792 },
  a4: { width: 595.28, height: 841.89 },
};
export const PAGE_MARGIN = 54;
export const SYSTEM_GAP_PT = 22;
export const TRACK_GAP_PT = 10;

export interface PagePlanInput {
  pageSize: PageSize;
  /** Model px width the rows were engraved at (plan.availWidth + 2 * PRINT_PADDING_X). */
  rowWidthPx: number;
  /** One entry per track: row heights in model px (all rows of a track share a height). */
  trackRowHeights: number[];
  systemCount: number;
  headerHeight: number; // points, page 1 only (0 when header off)
  footerHeight: number; // points, every page (0 when footer off)
}

export interface PlacedRow { system: number; trackSlot: number; x: number; yTop: number; scale: number }
export interface PagePlan { pageSize: PageSize; pages: PlacedRow[][]; scale: number }

export function planPages(input: PagePlanInput): PagePlan {
  const { width, height } = PAGE_SIZES[input.pageSize];
  const widthScale = (width - 2 * PAGE_MARGIN) / input.rowWidthPx;

  // A system placed unconditionally as "system 0" of a page can never be
  // pushed to a later page (there's nowhere emptier to push it to), so if it
  // were taller than the printable area it would silently overflow past the
  // footer. Guard against that by additionally downscaling the whole
  // document so the tallest system (all its track rows, plus the fixed
  // point-space gaps between them) always fits within the tightest page —
  // page 1 (header + footer) or page 2+ (footer only), whichever leaves less
  // room. This can only shrink `scale` below `widthScale`, never grow it.
  const trackGapCount = Math.max(0, input.trackRowHeights.length - 1);
  const gapsPt = TRACK_GAP_PT * trackGapCount;
  const systemModelHeight = input.trackRowHeights.reduce((a, b) => a + b, 0);
  const printableRest = height - 2 * PAGE_MARGIN - input.footerHeight;
  const printableFirst = printableRest - input.headerHeight;
  const available = Math.min(printableRest, printableFirst) - gapsPt;
  const heightScale = systemModelHeight > 0 ? available / systemModelHeight : Infinity;
  const scale = Math.min(widthScale, heightScale);

  if (input.systemCount === 0) {
    return { pageSize: input.pageSize, pages: [[]], scale };
  }

  const rowHeightsPt = input.trackRowHeights.map(h => h * scale);
  const systemHeight = rowHeightsPt.reduce((a, b) => a + b, 0) + gapsPt;
  const bottomLimit = height - PAGE_MARGIN - input.footerHeight;

  const pages: PlacedRow[][] = [];
  let page: PlacedRow[] = [];
  let y = PAGE_MARGIN + input.headerHeight;

  for (let system = 0; system < input.systemCount; system++) {
    const needsNewPage = page.length > 0 && y + systemHeight > bottomLimit;
    if (needsNewPage) {
      pages.push(page);
      page = [];
      y = PAGE_MARGIN;
    }
    let rowY = y;
    rowHeightsPt.forEach((h, trackSlot) => {
      page.push({ system, trackSlot, x: PAGE_MARGIN, yTop: rowY, scale });
      rowY += h + TRACK_GAP_PT;
    });
    y += systemHeight + SYSTEM_GAP_PT;
  }
  if (page.length) pages.push(page);
  return { pageSize: input.pageSize, pages, scale };
}
