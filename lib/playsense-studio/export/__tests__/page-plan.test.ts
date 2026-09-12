import { describe, expect, it } from 'vitest';
import { PAGE_MARGIN, PAGE_SIZES, planPages, SYSTEM_GAP_PT, TRACK_GAP_PT } from '../pdf/page-plan';

const base = { rowWidthPx: 724, trackRowHeights: [120, 120], headerHeight: 90, footerHeight: 24 };

describe('planPages', () => {
  it('scales rows to the printable width', () => {
    const plan = planPages({ ...base, pageSize: 'letter', systemCount: 1 });
    expect(plan.scale).toBeCloseTo((PAGE_SIZES.letter.width - 2 * PAGE_MARGIN) / 724, 6);
    expect(plan.pages).toHaveLength(1);
    expect(plan.pages[0]).toHaveLength(2);
  });

  it('stacks the tracks of one system with the track gap', () => {
    const plan = planPages({ ...base, pageSize: 'letter', systemCount: 1 });
    const [a, b] = plan.pages[0];
    expect(a.yTop).toBe(PAGE_MARGIN + 90);
    expect(b.yTop).toBeCloseTo(a.yTop + 120 * plan.scale + TRACK_GAP_PT, 6);
  });

  it('never splits a system across pages and leaves room for the footer', () => {
    const plan = planPages({ ...base, pageSize: 'a4', systemCount: 12 });
    const bottomLimit = PAGE_SIZES.a4.height - PAGE_MARGIN - 24;
    for (const page of plan.pages) {
      const systems = new Set(page.map(r => r.system));
      for (const s of systems) expect(page.filter(r => r.system === s)).toHaveLength(2);
      const last = page[page.length - 1];
      expect(last.yTop + 120 * plan.scale).toBeLessThanOrEqual(bottomLimit + 1e-6);
    }
    expect(plan.pages.flat().filter(r => r.trackSlot === 0)).toHaveLength(12);
  });

  it('gives later pages more room because the header is on page 1 only', () => {
    const plan = planPages({ ...base, pageSize: 'letter', systemCount: 20 });
    const perPage = plan.pages.map(p => new Set(p.map(r => r.system)).size);
    expect(perPage[1]).toBeGreaterThanOrEqual(perPage[0]);
    expect(plan.pages[1][0].yTop).toBe(PAGE_MARGIN);
    void SYSTEM_GAP_PT;
  });
});
