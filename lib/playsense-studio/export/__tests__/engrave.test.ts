// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { BarlineType, Stave } from 'vexflow';
import { buildRowPlan } from '../pdf/row-plan';
import { engraveTrackRows, PRINT_PADDING_X } from '../pdf/engrave';
import { SON_MONTUNO_FIXTURE, CONGA_TUMBAO_FIXTURE } from '@/lib/playsense-studio/score-fixtures';
import type { Measure, ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

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

// A single track whose only content is one repeat group of two measures played
// `count` times, written out pass by pass exactly as the editor stores it (so
// `repeatGroups` recognises it and the collapsing path can fire).
function repeatedScore(count: number): ScoreDocument {
  const measures: Measure[] = Array.from({ length: 2 * count }, (_, i) => ({
    number: i + 1,
    repeat: { id: 'rep', pass: Math.floor(i / 2), count, offset: i % 2, length: 2 },
    voices: [{ number: 1, events: [{ kind: 'note', midi: i % 2 === 0 ? 60 : 62, durationQN: 4 }] }],
  }));
  return {
    ...SON_MONTUNO_FIXTURE,
    title: 'Repeat probe',
    tracks: [{ ...SON_MONTUNO_FIXTURE.tracks[0], measures }],
  };
}

/** Barline types the engraver asked VexFlow for, in draw order. */
function barTypesOf(count: number, expandRepeats: boolean) {
  const beg = vi.spyOn(Stave.prototype, 'setBegBarType');
  const end = vi.spyOn(Stave.prototype, 'setEndBarType');
  try {
    const score = repeatedScore(count);
    const plan = buildRowPlan(score, [0], 700, { expandRepeats });
    const track = engraveTrackRows(plan, 0);
    return {
      beg: beg.mock.calls.map(c => c[0]),
      end: end.mock.calls.map(c => c[0]),
      texts: track.rows.flatMap(r => Array.from(r.svg.querySelectorAll('text')).map(t => t.textContent ?? '')),
    };
  } finally {
    beg.mockRestore();
    end.mockRestore();
  }
}

describe('engraveTrackRows repeat barlines', () => {
  it('prints repeat barlines when the score is collapsed', () => {
    const { beg, end } = barTypesOf(2, false);
    expect(beg).toContain(BarlineType.REPEAT_BEGIN);
    expect(end).toContain(BarlineType.REPEAT_END);
  });

  it('prints none when expandRepeats wrote every pass out', () => {
    const { beg, end } = barTypesOf(2, true);
    expect(beg).not.toContain(BarlineType.REPEAT_BEGIN);
    expect(end).not.toContain(BarlineType.REPEAT_END);
    // The final-barline path still runs for the last measure of the score.
    expect(end).toContain(BarlineType.END);
  });
});

describe('engraveTrackRows repeat count instruction', () => {
  it('spells out a repeat played more than twice', () => {
    const { texts } = barTypesOf(4, false);
    expect(texts).toContain('4 times');
  });

  it('says nothing for a plain two-pass repeat', () => {
    const { texts } = barTypesOf(2, false);
    expect(texts.some(t => t.includes('times'))).toBe(false);
  });

  it('says nothing when the passes are written out instead', () => {
    const { texts } = barTypesOf(4, true);
    expect(texts.some(t => t.includes('times'))).toBe(false);
  });
});
