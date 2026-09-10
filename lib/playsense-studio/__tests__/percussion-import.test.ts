// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import legends from './fixtures/percussion-legends.json';
import { parseMusicXmlString } from '../parsers/musicxml';
import { getPercStrokes } from '../perc-strokes';
import { extractTrackEvents } from '../score-to-vexflow';
import { parseScoreDocument, serializeScoreDocument } from '@/components/playsense-studio/shared/score-model/serialization';
import type { Instrument } from '@/components/playsense-studio/shared/score-model/types';
import { editorReducer, type EditorState } from '../editor-state';
import { scoreToExerciseDefinition } from '@/lib/play-sense/score-to-exercise';

function note(staffLine: string, smufl: string, marcato = false, chord = false) {
  const [step, octave] = staffLine.split('/');
  return `<note>${chord ? '<chord/>' : ''}<unpitched><display-step>${step.toUpperCase()}</display-step><display-octave>${octave}</display-octave></unpitched><instrument id="drum"/><duration>1</duration><type>quarter</type><notehead smufl="${smufl}">other</notehead>${marcato ? '<notations><articulations><strong-accent type="up"/></articulations></notations>' : ''}</note>`;
}
function xml(name: string, notes: string, midi = 64) {
  // Deliberately use the SAME playback sound for every stroke. Written notation
  // from the supplied Finale legends must still distinguish every one of them.
  return `<score-partwise version="4.0"><part-list><score-part id="p"><part-name>${name}</part-name><midi-instrument id="drum"><midi-channel>10</midi-channel><midi-unpitched>${midi}</midi-unpitched></midi-instrument></score-part></part-list><part id="p"><measure number="1"><attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>percussion</sign></clef></attributes>${notes}</measure></part></score-partwise>`;
}
function state(score: ReturnType<typeof parseMusicXmlString>): EditorState {
  return { score, past: [], future: [], isDirty: false };
}

describe('Finale percussion legends', () => {
  it.each(legends)('imports $instrument / $strokeId at its written position', row => {
    const score = parseMusicXmlString(xml(row.instrument, note(row.staffLine, row.smufl, row.marcato)));
    const stroke = getPercStrokes(row.instrument as Instrument)!.find(s => s.id === row.strokeId)!;
    const event = score.tracks[0].measures[0].voices[0].events[0];
    expect(event).toMatchObject({ midi: stroke.midi, percussion: { staffLine: row.staffLine, notehead: row.notehead, strokeId: row.strokeId } });
    const saved = parseScoreDocument(serializeScoreDocument(score));
    expect(saved).toEqual(score);
    const drawn = extractTrackEvents(saved.tracks[0], [4, 4])[0].events[0];
    expect(drawn.keys).toEqual([row.staffLine]);
    expect(drawn.percussion?.[0].notehead).toBe(row.notehead);
    expect(scoreToExerciseDefinition(saved).events[0].surface).toBeTruthy();
  });

  it.each(['perc-conga', 'perc-timbal'] as const)('authors every %s stroke with undo and redo', instrument => {
    const score = parseMusicXmlString(xml(instrument, ''));
    for (const stroke of getPercStrokes(instrument)!) {
      const before = state(score);
      const inserted = editorReducer(before, { type: 'add-note', trackIndex: 0, measureIndex: 0, midi: stroke.midi, durationQN: 1 });
      const expected = legends.find(r => r.instrument === instrument && r.strokeId === stroke.id)!;
      expect(expected).toBeDefined();
      const d = extractTrackEvents(inserted.score.tracks[0], [4, 4])[0].events[0];
      expect(d.keys).toEqual([expected.staffLine]);
      expect(d.percussion?.[0].notehead).toBe(expected.notehead);
      expect(editorReducer(editorReducer(inserted, { type: 'undo' }), { type: 'redo' }).score).toEqual(inserted.score);
    }
  });

  it('preserves an unfamiliar staff position instead of moving it to the first stroke', () => {
    const score = parseMusicXmlString(xml('Congas', note('c/6', 'noteheadDiamondBlack')));
    const event = score.tracks[0].measures[0].voices[0].events[0];
    expect(event.kind === 'note' && event.percussion?.strokeId).toBeUndefined();
    expect(extractTrackEvents(score.tracks[0], [4, 4])[0].events[0].keys).toEqual(['c/6']);
    expect(scoreToExerciseDefinition(score).events[0].surface).toBeUndefined();
    const edited = editorReducer(state(score), { type: 'set-event-pitch', trackIndex: 0, measureIndex: 0, eventIndex: 0, midi: 66 });
    expect(extractTrackEvents(edited.score.tracks[0], [4, 4])[0].events[0].percussion?.[0]).toMatchObject({ staffLine: 'e/5', notehead: 'plus' });
    expect(editorReducer(edited, { type: 'undo' }).score).toEqual(score);
  });

  it('keeps individual positions and noteheads in simultaneous hits', () => {
    const score = parseMusicXmlString(xml('Timbales', note('a/4', 'noteheadBlack') + note('f/4', 'noteheadPlusBlack', false, true)));
    const saved = parseScoreDocument(serializeScoreDocument(score));
    const d = extractTrackEvents(saved.tracks[0], [4, 4])[0].events[0];
    expect(d.keys).toEqual(['a/4', 'f/4']);
    expect(d.percussion?.map(n => n.notehead)).toEqual(['normal', 'plus']);
    expect(scoreToExerciseDefinition(saved).events.map(e => e.technique)).toEqual(['open', 'shell']);
  });

  it('accepts percussion encoded with pitched display notes', () => {
    const score = parseMusicXmlString(xml('Timbales', '<note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type><notehead smufl="noteheadSlashedBlack1">slashed</notehead></note>'));
    expect(score.tracks[0].measures[0].voices[0].events[0]).toMatchObject({ percussion: { strokeId: 'low-cross-stick', staffLine: 'f/4' } });
  });

  it('keeps the GM-only fallback when there is no written position', () => {
    const score = parseMusicXmlString(xml('Congas', '<note><unpitched/><instrument id="drum"/><duration>1</duration><type>quarter</type></note>', 65));
    expect(score.tracks[0].measures[0].voices[0].events[0]).toMatchObject({ midi: 63 });
  });
});
