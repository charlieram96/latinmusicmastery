import { describe, expect, it } from 'vitest';
import type { Measure, ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { copySectionScore } from '../copy-section';

const bar = (n: number, ids: string[], extra: Partial<Measure> = {}): Measure => ({
  number: n,
  voices: [{ number: 1, events: ids.map((id) => ({ kind: 'note' as const, id, midi: 60, durationQN: 1 })) }],
  ...extra,
});

function score(
  measures: Measure[],
  extra: Partial<Omit<ScoreDocument, 'tracks'>> & { trackMeta?: Partial<ScoreDocument['tracks'][number]> } = {}
): ScoreDocument {
  const { trackMeta, ...rest } = extra;
  return {
    schemaVersion: 1,
    title: 'Untitled',
    sourceFormat: 'native',
    initialTempo: 100,
    initialTimeSignature: [4, 4],
    initialKeyFifths: 0,
    ...rest,
    tracks: [
      {
        index: 0,
        instrument: 'piano',
        displayName: 'Piano',
        tuning: null,
        stringMultiplicity: 1,
        channel: 0,
        defaultView: 'staff',
        measures,
        ...trackMeta,
      },
    ],
  };
}

describe('copySectionScore', () => {
  it('replaces the target notes with the source, stripping repeat tags and giving fresh ids, keeping the target identity', () => {
    const source = score(
      [
        bar(1, ['a', 'b'], {
          repeat: { id: 'r', pass: 0, count: 2, offset: 0, length: 1 },
          repeatStart: true,
          repeatEnd: true,
          volta: '1.',
        }),
        bar(2, ['c']),
      ],
      {
        title: 'Verse A',
        initialTimeSignature: [3, 4],
        initialKeyFifths: 2,
        spans: [{ id: 's1', type: 'slur', from: 'a', to: 'b' }],
      }
    );
    const target = score([bar(1, ['x'])], {
      title: 'Exercise',
      initialTempo: 120,
      initialTimeSignature: [4, 4],
      initialKeyFifths: 0,
      trackMeta: { instrument: 'perc-conga', displayName: 'Conga' },
    });

    const result = copySectionScore(source, target);

    // The target's own identity survives.
    expect(result.title).toBe('Exercise');
    expect(result.initialTempo).toBe(120);
    expect(result.tracks[0].instrument).toBe('perc-conga');
    expect(result.tracks[0].displayName).toBe('Conga');

    // The source's meter/key are taken.
    expect(result.initialTimeSignature).toEqual([3, 4]);
    expect(result.initialKeyFifths).toBe(2);

    // Repeat tags are gone from every copied measure.
    const [m1, m2] = result.tracks[0].measures;
    expect(m1.repeat).toBeUndefined();
    expect(m1.repeatStart).toBeUndefined();
    expect(m1.repeatEnd).toBeUndefined();
    expect(m1.volta).toBeUndefined();
    expect(m2.repeat).toBeUndefined();

    // Every event gets a fresh, unique id — none of the source's or the
    // target's old ids survive.
    const ids = result.tracks[0].measures.flatMap((m) => m.voices[0].events.map((e) => e.id));
    expect(ids).toHaveLength(3);
    expect(ids).not.toContain('a');
    expect(ids).not.toContain('b');
    expect(ids).not.toContain('c');
    expect(ids).not.toContain('x');
    expect(new Set(ids).size).toBe(ids.length);

    // The slur survives the copy, now pointing at the fresh ids.
    expect(result.spans).toHaveLength(1);
    expect(result.spans![0].from).toBe(ids[0]);
    expect(result.spans![0].to).toBe(ids[1]);
    expect(result.spans![0].id).not.toBe('s1');
  });

  it("prunes the target's own spans, which pointed at the now-replaced notes", () => {
    const source = score([bar(1, ['a'])]);
    const target = score([bar(1, ['x', 'y'])], {
      spans: [{ id: 'old', type: 'slur', from: 'x', to: 'y' }],
    });

    const result = copySectionScore(source, target);

    expect(result.spans).toEqual([]);
  });

  it('leaves the target unchanged when either side has no track', () => {
    const source = score([bar(1, ['a'])]);
    const emptyTarget: ScoreDocument = { ...score([bar(1, ['x'])]), tracks: [] };
    expect(copySectionScore(source, emptyTarget)).toBe(emptyTarget);

    const emptySource: ScoreDocument = { ...score([bar(1, ['a'])]), tracks: [] };
    const target = score([bar(1, ['x'])]);
    expect(copySectionScore(emptySource, target)).toBe(target);
  });
});
