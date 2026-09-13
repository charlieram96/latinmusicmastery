// lib/playsense-studio/export/midi-writer.ts
// ScoreDocument -> Standard MIDI File bytes. Pure module; no DOM.
import { Midi } from '@tonejs/midi';
import type { Instrument, ScoreDocument, Track } from '@/components/playsense-studio/shared/score-model/types';
import { walkMeasures } from '@/lib/playsense-studio/time-mapping';
import { isPercussion } from '@/lib/playsense-studio/perc-strokes';
import { GM_PERCUSSION } from '@/lib/playsense-studio/gm-percussion';

const VELOCITY = 0.8;

/** Inverse of gmToStrokeMidi: our stroke midi -> a General-MIDI percussion key.
 * Prefers a recorded source key (round-tripped from an imported MIDI file), then
 * looks up the GM table for a matching (instrument, strokeMidi) pair, else 60. */
export function strokeToGm(instrument: Instrument, strokeMidi: number, sourceMidi?: number): number {
  if (sourceMidi !== undefined) return sourceMidi;
  for (const [gm, entry] of Object.entries(GM_PERCUSSION)) {
    if (entry.instrument === instrument && entry.strokeMidi === strokeMidi) return Number(gm);
  }
  return 60;
}

interface PendingNote { midi: number; startQN: number; durationQN: number }

function trackNotes(track: Track, score: ScoreDocument): PendingNote[] {
  const perc = isPercussion(track.instrument);
  const done: PendingNote[] = [];
  const open = new Map<number, PendingNote>(); // tied notes waiting for their continuation, by midi

  for (const { measure, state } of walkMeasures(track, score)) {
    for (const voice of measure.voices) {
      let qn = state.cumulativeQN;
      for (const e of voice.events) {
        if (e.kind !== 'rest') {
          const pitches = e.kind === 'note'
            ? [{ midi: e.midi, tie: !!e.tieToNext, source: e.percussion?.sourceMidi }]
            : e.notes.map(n => ({ midi: n.midi, tie: !!(n.tieToNext ?? e.tieToNext), source: n.percussion?.sourceMidi }));
          for (const p of pitches) {
            const key = perc ? strokeToGm(track.instrument, p.midi, p.source) : p.midi;
            const held = open.get(key);
            if (held) {
              held.durationQN += e.durationQN;
              if (!p.tie) { open.delete(key); done.push(held); }
              continue;
            }
            const note = { midi: key, startQN: qn, durationQN: e.durationQN };
            if (p.tie) open.set(key, note); else done.push(note);
          }
        }
        qn += e.durationQN;
      }
    }
  }
  done.push(...open.values());
  return done.sort((a, b) => a.startQN - b.startQN || a.midi - b.midi);
}

export function writeMidi(score: ScoreDocument, trackIndexes: number[]): Uint8Array {
  const midi = new Midi();
  midi.name = score.title;
  const ppq = midi.header.ppq;
  const toTicks = (qn: number) => Math.round(qn * ppq);

  // Tempo + meter from the first selected track's walk (all tracks share them).
  const reference = score.tracks[trackIndexes[0]] ?? score.tracks[0];
  midi.header.tempos = [];
  midi.header.timeSignatures = [];
  let lastTempo = -1;
  let lastTs = '';
  for (const { state } of walkMeasures(reference, score)) {
    if (state.tempo !== lastTempo) { midi.header.tempos.push({ ticks: toTicks(state.cumulativeQN), bpm: state.tempo }); lastTempo = state.tempo; }
    const tsKey = state.timeSignature.join('/');
    if (tsKey !== lastTs) { midi.header.timeSignatures.push({ ticks: toTicks(state.cumulativeQN), timeSignature: [...state.timeSignature] }); lastTs = tsKey; }
  }
  midi.header.update();

  for (const index of trackIndexes) {
    const track = score.tracks[index];
    if (!track) continue;
    const out = midi.addTrack();
    out.name = track.displayName;
    out.channel = isPercussion(track.instrument) ? 9 : trackIndexes.indexOf(index) % 9;
    for (const n of trackNotes(track, score)) {
      out.addNote({ midi: n.midi, ticks: toTicks(n.startQN), durationTicks: Math.max(1, toTicks(n.durationQN)), velocity: VELOCITY });
    }
  }
  return midi.toArray();
}
