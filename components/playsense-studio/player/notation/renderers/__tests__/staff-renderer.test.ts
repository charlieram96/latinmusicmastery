import { describe, expect, it } from 'vitest';
import type { Track } from '@/components/playsense-studio/shared/score-model/types';
import { GUITAR_LICK_FIXTURE } from '@/lib/playsense-studio/score-fixtures';
import { extractTrackEvents } from '@/lib/playsense-studio/score-to-vexflow';
import { formatMeasureVoice } from '../staff-renderer';

const TS: [number, number] = [4, 4];

/** Guitar lick with a blank bar spliced in as measure 2 (the studio persists these). */
function trackWithBlankMeasure(): Track {
  const src = GUITAR_LICK_FIXTURE.tracks[0];
  return {
    ...src,
    measures: [
      src.measures[0],
      { number: 2, voices: [{ number: 1, events: [] }] },
      { ...src.measures[1], number: 3 },
    ],
  };
}

describe('formatMeasureVoice', () => {
  it('returns null for a blank measure instead of justifying an empty VexFlow voice', () => {
    // VexFlow's Formatter throws "Cannot read properties of undefined (reading
    // 'getMetrics')" when format() is given a voice with no tickables and a
    // positive width — the production lesson crash.
    expect(formatMeasureVoice([], TS, 200)).toBeNull();
  });

  it('lays out a populated measure with one StaveNote per event, left to right', () => {
    const blocks = extractTrackEvents(GUITAR_LICK_FIXTURE.tracks[0], TS, 0);
    const laid = formatMeasureVoice(blocks[0].events, blocks[0].timeSignature, 200);
    expect(laid).not.toBeNull();
    expect(laid!.vexNotes).toHaveLength(4);
    expect(laid!.voice.getTickables()).toHaveLength(4);
    const xs = laid!.vexNotes.map((n) => n.getX());
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
  });

  it('skips only the blank bar of a track; the bar still occupies its time', () => {
    const blocks = extractTrackEvents(trackWithBlankMeasure(), TS, 0);
    expect(blocks).toHaveLength(3);
    expect(blocks[1].events).toEqual([]);
    expect(blocks[1].cumulativeQN).toBe(4);
    expect(blocks[2].cumulativeQN).toBe(8);

    const laid = blocks.map((b) => formatMeasureVoice(b.events, b.timeSignature, 200));
    expect(laid[0]).not.toBeNull();
    expect(laid[1]).toBeNull();
    expect(laid[2]).not.toBeNull();
  });
});
