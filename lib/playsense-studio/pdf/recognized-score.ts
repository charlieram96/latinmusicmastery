// What the recognizer asks the model for, and how that becomes a ScoreDocument.
//
// The model-facing shape is deliberately flat and fully required (nulls for
// absence) so it converts cleanly to a structured-output JSON schema. Real
// validation happens afterwards through parseScoreDocument, and repeats are
// expanded by the editor's own structural edit so an imported repeat is
// indistinguishable from one authored in the studio.

import { z } from 'zod';
import type {
  Instrument,
  Measure,
  MusicalEvent,
  PercussionNotation,
  ScoreDocument,
  Track,
} from '@/components/playsense-studio/shared/score-model/types';
import { parseScoreDocument } from '@/components/playsense-studio/shared/score-model/serialization';
import { applyMeasureEdit } from '../measure-edits';
import { getPercStrokes, type PercStroke } from '../perc-strokes';
import { RecognitionError } from './recognition-error';
import { effectiveDurationQN } from '../time-mapping';

const INSTRUMENTS = [
  'guitar', 'bass', 'tres', 'cuatro', 'tiple', 'ukulele', 'mandolin', 'piano', 'staff',
  'perc-kit', 'perc-conga', 'perc-bongo', 'perc-timbal', 'perc-clave',
] as const satisfies readonly Instrument[];

const NOTEHEADS = ['normal', 'x', 'ornate-x', 'plus', 'circled', 'slash', 'slashed', 'diamond', 'triangle-up', 'triangle-down', 'square'] as const;

const pitchShape = {
  /** Pitched instruments: MIDI number. Percussion: null. */
  midi: z.number().nullable(),
  /** Percussion: written position like "a/4". Pitched: null. */
  staffLine: z.string().nullable(),
  notehead: z.enum(NOTEHEADS).nullable(),
};

const eventSchema = z.object({
  kind: z.enum(['note', 'rest', 'chord']),
  /** Quarter-note units: 1 = quarter, 0.5 = eighth, 2 = half. Dots and triplets are flags, not folded in. */
  durationQN: z.number(),
  dotted: z.boolean(),
  triplet: z.boolean(),
  tieToNext: z.boolean(),
  marcato: z.boolean(),
  ...pitchShape,
  /** Chords only; null otherwise. */
  notes: z.array(z.object(pitchShape)).nullable().optional(),
});

const measureSchema = z.object({
  /** Only when the meter changes at this bar. */
  timeSignature: z.tuple([z.number(), z.number()]).nullable(),
  voices: z.array(z.object({ events: z.array(eventSchema) })),
});

const trackSchema = z.object({
  displayName: z.string(),
  instrument: z.enum(INSTRUMENTS),
  measures: z.array(measureSchema),
  /** Repeated passages, written once in `measures` and expanded here. 1-based, inclusive. */
  repeats: z.array(z.object({ fromMeasure: z.number(), throughMeasure: z.number(), count: z.number() })),
});

export const recognitionOutputSchema = z.object({
  pieces: z.array(z.object({
    title: z.string(),
    /** Printed tempo, or a sensible default when none is printed. */
    initialTempo: z.number(),
    timeSignature: z.tuple([z.number(), z.number()]),
    /** Key signature as fifths: negative = flats, positive = sharps. */
    keyFifths: z.number(),
    tracks: z.array(trackSchema),
  })),
});

export type RecognitionOutput = z.infer<typeof recognitionOutputSchema>;
export type RecognizedEvent = z.infer<typeof eventSchema>;
type RecognizedPitch = z.infer<typeof eventSchema>['notes'] extends (infer T)[] | null | undefined ? T : never;

const positive = (n: number) => Number.isFinite(n) && n > 0;
const integer = (n: number, lo: number, hi: number) => Number.isInteger(n) && n >= lo && n <= hi;

function strokeFor(strokes: PercStroke[], pitch: RecognizedPitch, marcato: boolean): PercStroke {
  const shape = pitch.notehead ?? 'normal';
  return strokes.find(s => s.staffLine === pitch.staffLine && (s.notehead ?? s.noteType ?? 'normal') === shape && !!s.marcato === marcato)
    ?? strokes.find(s => s.staffLine === pitch.staffLine && (s.notehead ?? s.noteType ?? 'normal') === shape)
    ?? strokes.find(s => s.staffLine === pitch.staffLine)
    ?? strokes[0];
}

/** A pitched note needs a MIDI number; a percussion note is placed by its written symbol. */
function resolvePitch(instrument: Instrument, pitch: RecognizedPitch, marcato: boolean): { midi: number; percussion?: PercussionNotation } | null {
  const strokes = getPercStrokes(instrument);
  if (strokes) {
    const stroke = strokeFor(strokes, pitch, marcato);
    const percussion: PercussionNotation = {
      staffLine: /^[a-g]\/[0-9]$/.test(pitch.staffLine ?? '') ? pitch.staffLine! : stroke.staffLine,
      notehead: pitch.notehead ?? stroke.notehead ?? stroke.noteType ?? 'normal',
      strokeId: stroke.id,
    };
    if (marcato || stroke.marcato) percussion.marcato = true;
    return { midi: stroke.midi, percussion };
  }
  if (pitch.midi == null || !integer(pitch.midi, 0, 127)) return null;
  return { midi: pitch.midi };
}

function convertEvent(instrument: Instrument, event: RecognizedEvent): MusicalEvent | null {
  if (!positive(event.durationQN)) return null;
  // The model returns the written value plus flags (see the prompt); the app stores the real length.
  const durationQN = effectiveDurationQN(event.durationQN, { dotted: event.dotted, triplet: event.triplet });
  const base = { durationQN, ...(event.dotted ? { dotted: true } : {}), ...(event.triplet ? { triplet: true } : {}) };
  if (event.kind === 'rest') return { kind: 'rest', ...base };
  const tie = event.tieToNext ? { tieToNext: true } : {};
  if (event.kind === 'chord') {
    const notes = (event.notes ?? []).map(n => resolvePitch(instrument, n, event.marcato)).filter((n): n is NonNullable<typeof n> => !!n);
    if (notes.length >= 2) return { kind: 'chord', notes, ...base, ...tie };
    if (notes.length === 1) return { kind: 'note', ...notes[0], ...base, ...tie };
    return { kind: 'rest', ...base };
  }
  const pitch = resolvePitch(instrument, event, event.marcato);
  // Timing matters more than a lost pitch: keep the slot as a rest for review.
  if (!pitch) return { kind: 'rest', ...base };
  return { kind: 'note', ...pitch, ...base, ...tie };
}

function convertTrack(index: number, track: RecognitionOutput['pieces'][number]['tracks'][number], meter: [number, number]): Track | null {
  const measures: Measure[] = track.measures.map((m, i) => {
    const voices = m.voices
      .map((v, vi) => ({ number: vi + 1, events: v.events.map(e => convertEvent(track.instrument, e)).filter((e): e is MusicalEvent => !!e) }))
      .filter(v => v.events.length > 0)
      .slice(0, 2);
    const measure: Measure = { number: i + 1, voices: voices.length ? voices : [{ number: 1, events: [] }] };
    const ts = m.timeSignature;
    if (ts && integer(ts[0], 1, 32) && integer(ts[1], 1, 64) && (ts[0] !== meter[0] || ts[1] !== meter[1])) measure.timeSignature = [ts[0], ts[1]];
    return measure;
  });
  if (!measures.length) return null;
  return {
    index,
    instrument: track.instrument,
    displayName: track.displayName.trim() || track.instrument,
    tuning: null,
    stringMultiplicity: 1,
    channel: null,
    defaultView: 'staff',
    measures,
  };
}

function applyRepeats(score: ScoreDocument, repeats: RecognitionOutput['pieces'][number]['tracks'][number]['repeats'], trackIndex: number): ScoreDocument {
  // Later passages first, so expanding one never shifts the indices of the next.
  const ordered = [...repeats].sort((a, b) => b.fromMeasure - a.fromMeasure);
  let next = score;
  for (const r of ordered) {
    const start = r.fromMeasure - 1;
    const end = r.throughMeasure - 1;
    if (!integer(start, 0, 511) || !integer(end, start, 511) || !integer(r.count, 2, 8)) continue;
    const result = applyMeasureEdit(next, { type: 'repeat-measures', trackIndex, start, end, count: r.count, id: crypto.randomUUID() });
    if (result.ok) next = result.score;
  }
  return next;
}

/** Turn recognized output into validated documents, one per detected piece. */
export function toScoreDocuments(output: RecognitionOutput, options: { title: string }): ScoreDocument[] {
  const documents: ScoreDocument[] = [];
  for (const piece of output.pieces) {
    const [num, den] = piece.timeSignature;
    const meter: [number, number] = integer(num, 1, 32) && integer(den, 1, 64) ? [num, den] : [4, 4];
    const converted = piece.tracks
      .map(t => ({ track: convertTrack(0, t, meter), repeats: t.repeats }))
      .filter((c): c is { track: Track; repeats: typeof c.repeats } => !!c.track)
      .map((c, index) => ({ ...c, track: { ...c.track, index } }));
    if (!converted.length) continue;
    let score: ScoreDocument = {
      schemaVersion: 1,
      title: piece.title.trim() || options.title,
      sourceFormat: 'pdf',
      initialTempo: positive(piece.initialTempo) ? Math.min(400, Math.max(20, Math.round(piece.initialTempo))) : 100,
      initialTimeSignature: meter,
      initialKeyFifths: integer(piece.keyFifths, -7, 7) ? piece.keyFifths : 0,
      tracks: converted.map(c => c.track),
    };
    converted.forEach((c, trackIndex) => { score = applyRepeats(score, c.repeats, trackIndex); });
    try {
      documents.push(parseScoreDocument(score));
    } catch {
      // A piece the schema rejects is dropped; the others still import.
    }
  }
  if (!documents.length) throw new RecognitionError('No playable notation was found. Try a clearer scan, or import the original MusicXML file.', 422);
  return documents;
}
