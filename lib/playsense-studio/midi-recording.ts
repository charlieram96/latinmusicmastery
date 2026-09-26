import type { Instrument, Measure, MusicalEvent, ScoreDocument, Track } from '@/components/playsense-studio/shared/score-model/types';
import { measureLengthInQN } from './time-mapping';
import { gmToStrokeMidi } from './gm-percussion';
import { isPercussion } from './perc-strokes';
import { newEventId } from './event-ids';

export const MAX_TAKE_MS = 180_000;
export const MAX_TAKE_NOTES = 4096;
export type RecordedMidiNote = { id: number; midi: number; channel: number; velocity: number; startMs: number; endMs: number };
export type MidiTake = { notes: RecordedMidiNote[]; durationMs: number; bpm: number; timeSignature: [number, number]; startVideoSeconds?: number };
export type MidiNotationBar = { startQN: number; endQN: number; bpm: number; timeSignature: [number, number] };
export type MidiNotationTimeline = { toQN: (elapsedMs: number) => number; bars: MidiNotationBar[] };

/** Message timestamps are relative to the first downbeat, never arrival/render time. */
export class MidiNoteCapture {
  private notes: RecordedMidiNote[] = [];
  private held = new Map<string, RecordedMidiNote>();
  private sustained = new Map<string, RecordedMidiNote>();
  private pedal = new Set<number>();
  constructor(private readonly followPedal = true) {}
  get count() { return this.notes.length; }
  get pitches() { return [...new Set([...this.held.values(), ...this.sustained.values()].map(n => n.midi))].sort((a, b) => a - b); }
  message(data: ArrayLike<number>, timeMs: number) {
    if (data.length < 3 || !Number.isFinite(timeMs) || timeMs < 0 || timeMs > MAX_TAKE_MS) return;
    const [status, key, value] = [data[0], data[1], data[2]];
    if (!Number.isInteger(status) || status < 0x80 || status > 0xef || !Number.isInteger(key) || key < 0 || key > 127 || !Number.isInteger(value) || value < 0 || value > 127) return;
    const channel = status & 15;
    const type = status & 0xf0;
    const id = `${channel}:${key}`;
    const finish = (note: RecordedMidiNote) => { note.endMs = Math.max(note.startMs + 1, timeMs); };
    if (type === 0xb0) {
      if (key === 64 && this.followPedal) {
        if (value >= 64) this.pedal.add(channel);
        else {
          this.pedal.delete(channel);
          for (const [k, note] of this.sustained) if (note.channel === channel) { finish(note); this.sustained.delete(k); }
        }
      } else if (key === 120 || key === 123) {
        for (const map of [this.held, this.sustained]) for (const [k, note] of map) if (note.channel === channel) { finish(note); map.delete(k); }
        this.pedal.delete(channel);
      }
      return;
    }
    if (type !== 0x90 && type !== 0x80) return;
    if (type === 0x90 && value > 0) {
      for (const map of [this.held, this.sustained]) {
        const previous = map.get(id);
        if (previous) { finish(previous); map.delete(id); }
      }
      if (this.notes.length >= MAX_TAKE_NOTES) return;
      const note = { id: this.notes.length, midi: key, channel, velocity: value, startMs: timeMs, endMs: timeMs + 1 };
      this.notes.push(note); this.held.set(id, note);
    } else {
      const note = this.held.get(id);
      if (!note) return;
      this.held.delete(id);
      if (this.pedal.has(channel)) this.sustained.set(id, note);
      else finish(note);
    }
  }
  finish(timeMs: number) {
    const end = Math.max(0, Math.min(MAX_TAKE_MS, timeMs));
    for (const note of [...this.held.values(), ...this.sustained.values()]) note.endMs = Math.max(note.startMs + 1, end);
    this.held.clear(); this.sustained.clear(); this.pedal.clear();
    return this.notes.map(note => ({ ...note }));
  }
}

export function recordingContext(score: ScoreDocument, track: Track, start: number) {
  let bpm = score.initialTempo;
  let timeSignature = score.initialTimeSignature;
  let keyFifths = score.initialKeyFifths;
  for (const measure of track.measures.slice(0, start + 1)) {
    bpm = measure.tempoChange ?? bpm;
    timeSignature = measure.timeSignature ?? timeSignature;
    keyFifths = measure.keyFifths ?? keyFifths;
  }
  return { bpm, timeSignature, keyFifths };
}

/** Split the timeline at every attack/release/barline. Held pitches receive ties,
 * including across changing chords, so polyphony never becomes extra attacks. */
export function midiTakeToMeasures(take: MidiTake, gridQN: number, instrument: Instrument, gmPercussion = true, timeline?: MidiNotationTimeline): Measure[] {
  if (!take.notes.length) return [];
  if (!Number.isFinite(take.bpm) || take.bpm < 20 || take.bpm > 400 || ![0, .125, .25, .5, 1].includes(gridQN)) throw new Error('Choose a supported tempo and quantization.');
  const bar = measureLengthInQN(take.timeSignature);
  if (!Number.isFinite(bar) || bar <= 0 || bar > 32) throw new Error('This time signature is not supported for recording.');
  const snap = (qn: number) => gridQN ? Math.round(qn / gridQN) * gridQN : Math.round(qn * 1e6) / 1e6;
  const toQN = timeline?.toQN ?? ((ms: number) => ms * take.bpm / 60000);
  const notes = take.notes.slice(0, MAX_TAKE_NOTES).map((note) => {
    const start = Math.max(0, snap(toQN(note.startMs)));
    return { ...note, midi: isPercussion(instrument) && gmPercussion ? gmToStrokeMidi(note.midi, instrument) : note.midi,
      start, end: Math.max(start + (gridQN || .001), snap(toQN(note.endMs))) };
  });
  if (notes.some(n => !Number.isFinite(n.start + n.end) || (!timeline && n.end > MAX_TAKE_MS * take.bpm / 60000 + 1))) throw new Error('This take is too long. Record a shorter section.');
  const lastQN = Math.max(snap(toQN(take.durationMs)), ...notes.map(n => n.end));
  const bars = timeline ? timeline.bars.filter(b => b.startQN < lastQN - 1e-7) : Array.from({ length: Math.ceil((lastQN - 1e-7) / bar) }, (_, i) => ({ startQN: i * bar, endQN: (i + 1) * bar, bpm: take.bpm, timeSignature: take.timeSignature }));
  if (!bars.length || bars.length > 256 || bars.at(-1)!.endQN < lastQN - 1e-7) throw new Error('Record up to 256 measures at a time.');
  const end = bars.at(-1)!.endQN;
  const boundaries = new Set<number>([0, end, ...notes.flatMap(n => [n.start, n.end])]);
  for (const b of bars) boundaries.add(b.startQN);
  const times = [...boundaries].filter(n => n <= end).sort((a, b) => a - b);
  const measures: Measure[] = bars.map((b, i) => ({ number: i + 1, tempoChange: b.bpm, timeSignature: b.timeSignature, voices: [{ number: 1, events: [] }] }));
  let measureIndex = 0;
  for (let i = 0; i + 1 < times.length; i++) {
    let cursor = times[i];
    const limit = times[i + 1];
    // Same pitch from multiple channels still engraves as one pitch.
    const active = [...new Map(notes.filter(n => n.start <= cursor + 1e-7 && n.end > cursor + 1e-7).map(n => [n.midi, n])).values()].sort((a, b) => a.midi - b.midi);
    while (limit - cursor > 1e-7) {
      const remainder = limit - cursor;
      const durationQN = gridQN ? ([4, 3, 2, 1.5, 1, .75, .5, .375, .25, .125].find(d => d <= remainder + 1e-7) ?? remainder) : remainder;
      const next = cursor + durationQN;
      const tied = (n: typeof active[number]) => n.end > next + 1e-7;
      const modifier = [3, 1.5, .75, .375].some(d => Math.abs(durationQN - d) < 1e-7) ? { dotted: true } : {};
      let event: MusicalEvent;
      if (!active.length) event = { kind: 'rest', durationQN, ...modifier, id: newEventId() };
      else if (active.length === 1) event = { kind: 'note', midi: active[0].midi, durationQN, ...modifier, ...(tied(active[0]) ? { tieToNext: true } : {}), id: newEventId() };
      else event = { kind: 'chord', durationQN, ...modifier, notes: active.map(n => ({ midi: n.midi, ...(tied(n) ? { tieToNext: true } : {}) })), id: newEventId() };
      while (measureIndex + 1 < bars.length && cursor >= bars[measureIndex].endQN - 1e-7) measureIndex++;
      measures[measureIndex].voices[0].events.push(event);
      cursor = next;
    }
  }
  return measures;
}

/** Capture insertion is atomic and never silently edits repeated passages. */
export function insertMidiMeasures(score: ScoreDocument, trackIndex: number, start: number, replaceCount: number, measures: Measure[]): ScoreDocument {
  const track = score.tracks[trackIndex];
  if (!track || !Number.isInteger(start) || start < 0 || start > track.measures.length || !Number.isInteger(replaceCount) || replaceCount < 0 || replaceCount > measures.length || !measures.length || measures.length > 256) throw new Error('Choose a valid recording destination.');
  const previous = track.measures[start - 1]?.repeat;
  const current = track.measures[start]?.repeat;
  if ((previous && current?.id === previous.id) || track.measures.slice(start, start + replaceCount).some(m => m.repeat)) throw new Error('Unlink these repeated measures before recording over them, or append the take.');
  const next = structuredClone(score);
  const target = next.tracks[trackIndex];
  const resumeIndex = Math.min(track.measures.length, start + replaceCount);
  const resume = recordingContext(score, track, resumeIndex);
  const recorded = structuredClone(measures);
  recorded[0].keyFifths ??= recordingContext(score, track, start).keyFifths;
  target.measures.splice(start, replaceCount, ...recorded);
  const following = target.measures[start + measures.length];
  if (following) { following.tempoChange = resume.bpm; following.timeSignature = resume.timeSignature; following.keyFifths = resume.keyFifths; }
  target.measures.forEach((measure, index) => { measure.number = index + 1; });
  return next;
}
