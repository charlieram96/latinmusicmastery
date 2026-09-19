import { describe, expect, it } from 'vitest';
import { toScoreDocuments, type RecognitionOutput, type RecognizedEvent } from '../pdf/recognized-score';
import { applyMeasureEdit } from '../measure-edits';
import { parseScoreDocument } from '@/components/playsense-studio/shared/score-model/serialization';

const note = (over: Partial<RecognizedEvent>): RecognizedEvent => ({ kind: 'note', durationQN: 1, dotted: false, triplet: false, tieToNext: false,
  midi: null, staffLine: null, notehead: null, marcato: false, ...over });
const rest = (durationQN = 1): RecognizedEvent => ({ kind: 'rest', durationQN, dotted: false, triplet: false, tieToNext: false, midi: null, staffLine: null, notehead: null, marcato: false });

function output(over: Partial<RecognitionOutput['pieces'][number]> = {}): RecognitionOutput {
  return { pieces: [{
    title: 'Cáscara', initialTempo: 96, timeSignature: [4, 4], keyFifths: 0,
    tracks: [{
      displayName: 'Timbal', instrument: 'perc-timbal', repeats: [],
      measures: [
        { timeSignature: null, voices: [{ events: [note({ staffLine: 'a/4', notehead: 'plus' }), note({ staffLine: 'a/4', notehead: 'normal' }), rest(2)] }] },
        { timeSignature: null, voices: [{ events: [note({ staffLine: 'f/4', notehead: 'slash' }), rest(3)] }] },
      ],
    }],
    ...over,
  }] };
}

describe('toScoreDocuments', () => {
  it('converts model output into a valid score and resolves percussion strokes from the legend', () => {
    const [score] = toScoreDocuments(output(), { title: 'fallback' });
    expect(() => parseScoreDocument(score)).not.toThrow();
    expect(score.title).toBe('Cáscara');
    expect(score.sourceFormat).toBe('pdf');
    expect(score.initialTempo).toBe(96);
    const events = score.tracks[0].measures[0].voices[0].events;
    expect(events[0]).toMatchObject({ kind: 'note', midi: 65, percussion: { staffLine: 'a/4', notehead: 'plus', strokeId: 'cascara' } });
    expect(events[1]).toMatchObject({ kind: 'note', midi: 64, percussion: { strokeId: 'high' } });
    expect(events[2]).toMatchObject({ kind: 'rest', durationQN: 2 });
    expect(score.tracks[0].measures[1].voices[0].events[0]).toMatchObject({ midi: 67, percussion: { strokeId: 'low-mute' } });
    expect(score.tracks[0].measures.map(m => m.number)).toEqual([1, 2]);
  });

  it('keeps pitched notes by midi and turns a pitchless note into a rest so timing survives', () => {
    const [score] = toScoreDocuments(output({ tracks: [{ displayName: 'Piano', instrument: 'piano', repeats: [], measures: [
      { timeSignature: null, voices: [{ events: [note({ midi: 60 }), note({ midi: null }), note({ kind: 'chord', notes: [{ midi: 60, staffLine: null, notehead: null }, { midi: 64, staffLine: null, notehead: null }] })] }] },
    ] }] }), { title: 'x' });
    const events = score.tracks[0].measures[0].voices[0].events;
    expect(events[0]).toMatchObject({ kind: 'note', midi: 60 });
    expect(events[1]).toMatchObject({ kind: 'rest', durationQN: 1 });
    expect(events[2]).toMatchObject({ kind: 'chord', notes: [{ midi: 60 }, { midi: 64 }] });
  });

  it('expands repeats exactly as the editor does', () => {
    const [plain] = toScoreDocuments(output(), { title: 'x' });
    const [repeated] = toScoreDocuments(output({ tracks: [{ ...output().pieces[0].tracks[0], repeats: [{ fromMeasure: 1, throughMeasure: 2, count: 3 }] }] }), { title: 'x' });
    const expected = applyMeasureEdit(plain, { type: 'repeat-measures', trackIndex: 0, start: 0, end: 1, count: 3, id: 'x' });
    if (!expected.ok) throw new Error(expected.problem);
    const strip = (s: typeof plain) => s.tracks[0].measures.map(m => ({ ...m, repeat: m.repeat && { ...m.repeat, id: 'id' } }));
    expect(strip(repeated)).toEqual(strip(expected.score));
    expect(repeated.tracks[0].measures).toHaveLength(6);
  });

  it('drops tracks with no measures and rejects an output with nothing playable', () => {
    const [score] = toScoreDocuments(output({ tracks: [{ displayName: 'Empty', instrument: 'piano', repeats: [], measures: [] }, ...output().pieces[0].tracks] }), { title: 'x' });
    expect(score.tracks.map(t => t.displayName)).toEqual(['Timbal']);
    expect(() => toScoreDocuments({ pieces: [{ ...output().pieces[0], tracks: [] }] }, { title: 'x' })).toThrow(expect.objectContaining({ status: 422 }));
  });

  it('falls back to the PDF name when the model returns no title', () => {
    const [score] = toScoreDocuments(output({ title: '' }), { title: 'my-score' });
    expect(score.title).toBe('my-score');
  });
});
