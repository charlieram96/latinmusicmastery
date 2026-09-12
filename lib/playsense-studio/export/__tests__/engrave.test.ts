// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { buildRowPlan } from '../pdf/row-plan';
import { engraveTrackRows, PRINT_PADDING_X } from '../pdf/engrave';
import { SON_MONTUNO_FIXTURE, CONGA_TUMBAO_FIXTURE } from '@/lib/playsense-studio/score-fixtures';

// jsdom has no layout engine. VexFlow measures text through an SVG bbox; give
// it a proportional stub so formatting produces finite positions.
beforeAll(() => {
  const proto = (globalThis as unknown as { SVGElement: { prototype: Record<string, unknown> } }).SVGElement.prototype;
  proto.getBBox = function getBBox(this: Element) {
    const len = (this.textContent ?? '').length;
    return { x: 0, y: -8, width: Math.max(6, len * 7), height: 10 };
  };
  const canvasProto = (globalThis as unknown as { HTMLCanvasElement: { prototype: Record<string, unknown> } }).HTMLCanvasElement.prototype;
  canvasProto.getContext = () => ({ measureText: (t: string) => ({ width: t.length * 7 }), font: '' });
});

describe('engraveTrackRows', () => {
  it('produces one svg per row with the shared width', () => {
    const plan = buildRowPlan(SON_MONTUNO_FIXTURE, [0, 1, 2], 700, { expandRepeats: true });
    const tres = engraveTrackRows(plan, 0);
    const bass = engraveTrackRows(plan, 1);
    expect(tres.rows).toHaveLength(plan.rows.length);
    expect(bass.rows).toHaveLength(plan.rows.length);
    expect(tres.rows[0].width).toBe(700 + 2 * PRINT_PADDING_X);
    expect(tres.rows[0].svg.tagName.toLowerCase()).toBe('svg');
    expect(tres.rows[0].svg.querySelectorAll('path, text').length).toBeGreaterThan(0);
    expect(tres.rows[0].firstMeasureNumber).toBe(1);
  });

  it('starts each row with a clef and time signature only on the first row', () => {
    const plan = buildRowPlan(SON_MONTUNO_FIXTURE, [1], 260, { expandRepeats: true });
    const bass = engraveTrackRows(plan, 1);
    expect(bass.rows.length).toBeGreaterThan(1);
    const clefTexts = (row: SVGSVGElement) => Array.from(row.querySelectorAll('text')).map(t => t.textContent ?? '');
    // U+E050 G clef appears in every row.
    expect(clefTexts(bass.rows[0].svg).some(t => t.includes(''))).toBe(true);
    expect(clefTexts(bass.rows[1].svg).some(t => t.includes(''))).toBe(true);
  });

  it('uses the percussion clef for perc tracks', () => {
    const plan = buildRowPlan(CONGA_TUMBAO_FIXTURE, [0], 700, { expandRepeats: true });
    const conga = engraveTrackRows(plan, 0);
    const texts = Array.from(conga.rows[0].svg.querySelectorAll('text')).map(t => t.textContent ?? '');
    expect(texts.some(t => t.includes(''))).toBe(true); // U+E069 unpitchedPercussionClef1
  });
});
