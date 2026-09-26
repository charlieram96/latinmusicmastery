// lib/playsense-studio/export/midi-writer.ts
// ScoreDocument -> Standard MIDI File bytes. Pure module; no DOM.
import { Midi } from '@tonejs/midi';
import type { Instrument, ScoreDocument, Track } from '@/components/playsense-studio/shared/score-model/types';
import { walkMeasures } from '@/lib/playsense-studio/time-mapping';
import { isPercussion } from '@/lib/playsense-studio/perc-strokes';
import { GM_PERCUSSION } from '@/lib/playsense-studio/gm-percussion';

const VELOCITY = 0.8;

// Reverse of gmToStrokeMidi's perc-timbal auxiliary table (gm-percussion.ts) —
// stroke midi -> the (lowest) GM note that forward-maps to it. Strokes 73-76
// (the bongo/cha-cha bell heads) have no forward GM entry at all; they land
// on GM 56 (Cowbell), the closest available auxiliary-metal sound.
const TIMBAL_STROKE_TO_GM: Record<number, number> = {
  69: 37,
  70: 49,
  71: 56,
  72: 75,
  73: 56,
  74: 56,
  75: 56,
  76: 56,
};

/** Inverse of gmToStrokeMidi: our stroke midi -> a General-MIDI percussion key.
 * Preference order: a recorded source key (round-tripped from an imported MIDI
 * file); the identity mapping when GM_PERCUSSION already keys this exact GM
 * note back to this (instrument, strokeMidi) pair (this is why perc-kit's
 * stroke ids equal GM drum numbers — without it, e.g. kit snare 38 would match
 * gm=37's "Side Stick -> snare" entry first and export as a rimshot); the
 * lowest GM note whose table entry maps to this stroke; a perc-timbal-only
 * reverse of the auxiliary table (bell/cáscara strokes gmToStrokeMidi reaches
 * that GM_PERCUSSION itself doesn't cover); else 60. */
export function strokeToGm(instrument: Instrument, strokeMidi: number, sourceMidi?: number): number {
  if (sourceMidi !== undefined) return sourceMidi;
  const identity = GM_PERCUSSION[strokeMidi];
  if (identity?.instrument === instrument && identity.strokeMidi === strokeMidi) return strokeMidi;
  for (const [gm, entry] of Object.entries(GM_PERCUSSION)) {
    if (entry.instrument === instrument && entry.strokeMidi === strokeMidi) return Number(gm);
  }
  if (instrument === 'perc-timbal' && TIMBAL_STROKE_TO_GM[strokeMidi] !== undefined) {
    return TIMBAL_STROKE_TO_GM[strokeMidi];
  }
  return 60;
}

interface PendingNote { midi: number; startQN: number; durationQN: number }

function trackNotes(track: Track, score: ScoreDocument): PendingNote[] {
  const perc = isPercussion(track.instrument);
  const done: PendingNote[] = [];
  // One open-ties map per voice NUMBER for the life of the track — held outside
  // the measure loop so a tie in voice 2 crossing a barline survives into the
  // next measure exactly like voice 1's does (mirrors musicxml-writer.ts's
  // per-voice VoiceState / stateFor). Keying a single shared map only by pitch
  // let one voice's dangling tie swallow another voice's unrelated note of the
  // same pitch, and rests never cleared it, so it could keep absorbing notes
  // arbitrarily far down the track.
  const openByVoice = new Map<number, Map<number, PendingNote>>();
  const openFor = (voiceNumber: number): Map<number, PendingNote> => {
    let open = openByVoice.get(voiceNumber);
    if (!open) { open = new Map<number, PendingNote>(); openByVoice.set(voiceNumber, open); }
    return open;
  };

  for (const { measure, state } of walkMeasures(track, score)) {
    for (const voice of measure.voices) {
      const open = openFor(voice.number);
      let qn = state.cumulativeQN;
      for (const e of voice.events) {
        if (e.kind === 'rest') {
          // An unresolved tie ends at a rest — flush this voice's open notes.
          done.push(...open.values());
          open.clear();
          qn += e.durationQN;
          continue;
        }
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
        qn += e.durationQN;
      }
    }
  }
  for (const open of openByVoice.values()) done.push(...open.values());
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
