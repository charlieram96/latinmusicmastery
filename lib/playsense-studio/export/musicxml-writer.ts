// lib/playsense-studio/export/musicxml-writer.ts
// ScoreDocument -> MusicXML 4.0 partwise. Pure string building; no DOM.
import type { Chord, Measure, MusicalEvent, Note, NoteBase, PercussionNotation, ScoreDocument, Track, Voice } from '@/components/playsense-studio/shared/score-model/types';
import { isPercussion, percussionNotation } from '@/lib/playsense-studio/perc-strokes';
import { isFretted } from '@/lib/playsense-studio/instruments';
import { repeatGroups } from '@/lib/playsense-studio/repeats';
import { vexflowDurationCode } from '@/lib/playsense-studio/score-to-vexflow';
import { measureLengthInQN } from '@/lib/playsense-studio/time-mapping';

export const DIVISIONS = 960;

const TYPE_BY_CODE: Record<string, string> = { w: 'whole', h: 'half', q: 'quarter', '8': 'eighth', '16': '16th', '32': '32nd', '64': '64th', '128': '128th' };
const SMUFL_BY_NOTEHEAD: Record<Exclude<PercussionNotation['notehead'], 'normal'>, string> = {
  x: 'noteheadXBlack', 'ornate-x': 'noteheadXOrnate', plus: 'noteheadPlusBlack', circled: 'noteheadCircledBlack',
  slash: 'noteheadSlashHorizontalEnds', slashed: 'noteheadSlashedBlack1', diamond: 'noteheadDiamondBlack',
  'triangle-up': 'noteheadTriangleUpBlack', 'triangle-down': 'noteheadTriangleDownBlack', square: 'noteheadSquareBlack',
};
const SHARP_STEPS = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'];
const SHARP_ALTER = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
const FLAT_STEPS = ['C', 'D', 'D', 'E', 'E', 'F', 'G', 'G', 'A', 'A', 'B', 'B'];
const FLAT_ALTER = [0, -1, 0, -1, 0, 0, -1, 0, -1, 0, -1, 0];

export function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function pitchXml(midi: number, hint?: string): string {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const useFlat = !!hint && /^[A-G]b/i.test(hint);
  const step = useFlat ? FLAT_STEPS[pc] : SHARP_STEPS[pc];
  const alter = useFlat ? FLAT_ALTER[pc] : SHARP_ALTER[pc];
  return `<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ''}<octave>${octave}</octave></pitch>`;
}

function unpitchedXml(p: PercussionNotation): string {
  const [step, octave] = p.staffLine.split('/');
  return `<unpitched><display-step>${step.toUpperCase()}</display-step><display-octave>${octave}</display-octave></unpitched>`;
}

function durationXml(e: NoteBase): string {
  const base = e.triplet ? e.durationQN * 1.5 : e.durationQN;
  const code = vexflowDurationCode(base, e.dotted);
  const parts = [`<duration>${Math.round(e.durationQN * DIVISIONS)}</duration>`];
  parts.push(`<type>${TYPE_BY_CODE[code] ?? 'quarter'}</type>`);
  if (e.dotted) parts.push('<dot/>');
  if (e.triplet) parts.push('<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>');
  return parts.join('');
}

interface NoteFlags { tieStop: boolean; slurStop: boolean }

function notationsXml(e: NoteBase, flags: NoteFlags, tieStart: boolean, fingering?: Note['fingering'], marcato?: boolean): string {
  const items: string[] = [];
  if (flags.tieStop) items.push('<tied type="stop"/>');
  if (tieStart) items.push('<tied type="start"/>');
  if (flags.slurStop) items.push('<slur type="stop" number="1"/>');
  if (e.slurToNext) items.push('<slur type="start" number="1"/>');
  const arts: string[] = [];
  if (e.articulation) arts.push(`<${e.articulation}/>`);
  if (marcato) arts.push('<strong-accent type="up"/>');
  if (arts.length) items.push(`<articulations>${arts.join('')}</articulations>`);
  if (fingering) items.push(`<technical><string>${fingering.string}</string><fret>${fingering.fret}</fret>${fingering.finger ? `<fingering>${fingering.finger}</fingering>` : ''}</technical>`);
  return items.length ? `<notations>${items.join('')}</notations>` : '';
}

function oneNote(
  track: Track, e: NoteBase, pitch: { midi: number; spellingHint?: string; percussion?: PercussionNotation; fingering?: Note['fingering']; tieToNext?: boolean },
  voice: number, flags: NoteFlags, chordTail: boolean, instrumentIds: Map<number, string>,
): string {
  const perc = isPercussion(track.instrument) ? percussionNotation(track.instrument, pitch) : null;
  const tieStart = !!(pitch.tieToNext ?? e.tieToNext);
  const parts: string[] = ['<note>'];
  if (chordTail) parts.push('<chord/>');
  parts.push(perc ? unpitchedXml(perc) : pitchXml(pitch.midi, pitch.spellingHint));
  parts.push(durationXml(e));
  if (flags.tieStop) parts.push('<tie type="stop"/>');
  if (tieStart) parts.push('<tie type="start"/>');
  if (perc?.sourceMidi !== undefined && instrumentIds.has(perc.sourceMidi)) parts.push(`<instrument id="${instrumentIds.get(perc.sourceMidi)}"/>`);
  parts.push(`<voice>${voice}</voice>`);
  if (perc && perc.notehead !== 'normal') parts.push(`<notehead smufl="${SMUFL_BY_NOTEHEAD[perc.notehead]}">other</notehead>`);
  parts.push(notationsXml(e, flags, tieStart, pitch.fingering, perc?.marcato));
  parts.push('</note>');
  return parts.join('');
}

function eventXml(track: Track, e: MusicalEvent, voice: number, flags: NoteFlags, instrumentIds: Map<number, string>): string {
  if (e.kind === 'rest') {
    return `<note><rest/>${durationXml(e)}<voice>${voice}</voice>${notationsXml(e, flags, false)}</note>`;
  }
  if (e.kind === 'note') return oneNote(track, e, e, voice, flags, false, instrumentIds);
  const chord = e as Chord;
  return chord.notes.map((n, i) => oneNote(track, chord, n, voice, i === 0 ? flags : { tieStop: false, slurStop: false }, i > 0, instrumentIds)).join('');
}

function voiceXml(track: Track, v: Voice, state: { pendingTie: boolean; pendingSlur: boolean }, instrumentIds: Map<number, string>): string {
  return v.events.map(e => {
    const flags = { tieStop: state.pendingTie, slurStop: state.pendingSlur };
    const xml = eventXml(track, e, v.number, flags, instrumentIds);
    state.pendingTie = e.kind === 'chord' ? e.notes.some(n => n.tieToNext) || !!e.tieToNext : !!e.tieToNext;
    state.pendingSlur = !!e.slurToNext;
    return xml;
  }).join('');
}

function clefXml(track: Track): string {
  if (isPercussion(track.instrument)) return '<clef><sign>percussion</sign><line>2</line></clef>';
  if (track.instrument === 'bass') return '<clef><sign>F</sign><line>4</line></clef>';
  if (isFretted(track.instrument)) return '<clef><sign>G</sign><line>2</line><clef-octave-change>-1</clef-octave-change></clef>';
  return '<clef><sign>G</sign><line>2</line></clef>';
}

function tuningXml(track: Track): string {
  if (!track.tuning || !isFretted(track.instrument)) return '';
  const lines = track.tuning.map((name, i) => {
    const m = /^([A-G])([#b]?)(-?\d+)$/.exec(name);
    if (!m) return '';
    const alter = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
    return `<staff-tuning line="${i + 1}"><tuning-step>${m[1]}</tuning-step>${alter ? `<tuning-alter>${alter}</tuning-alter>` : ''}<tuning-octave>${m[3]}</tuning-octave></staff-tuning>`;
  }).join('');
  return `<staff-details><staff-lines>${track.tuning.length}</staff-lines>${lines}</staff-details>`;
}

function tempoXml(bpm: number): string {
  return `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${Math.round(bpm)}</per-minute></metronome></direction-type><sound tempo="${Math.round(bpm)}"/></direction>`;
}

function attributesXml(track: Track, score: ScoreDocument, m: Measure, first: boolean): string {
  const items: string[] = [];
  if (first) items.push(`<divisions>${DIVISIONS}</divisions>`);
  const key = first ? (m.keyFifths ?? score.initialKeyFifths) : m.keyFifths;
  if (key !== undefined) items.push(`<key><fifths>${key}</fifths></key>`);
  const ts = first ? (m.timeSignature ?? score.initialTimeSignature) : m.timeSignature;
  if (ts) items.push(`<time><beats>${ts[0]}</beats><beat-type>${ts[1]}</beat-type></time>`);
  if (first) items.push(clefXml(track), tuningXml(track));
  return items.length ? `<attributes>${items.join('')}</attributes>` : '';
}

/** Measures to write, with repeat groups collapsed to their first pass. */
function collapsed(track: Track): Array<{ measure: Measure; repeatStart?: number; repeatEnd?: number }> {
  const groups = repeatGroups(track);
  const out: Array<{ measure: Measure; repeatStart?: number; repeatEnd?: number }> = [];
  track.measures.forEach((measure, i) => {
    const group = groups.find(g => i >= g.start && i < g.start + g.length * g.count);
    if (!group) { out.push({ measure }); return; }
    const offset = i - group.start;
    if (offset >= group.length) return; // later passes are implied by the repeat barline
    out.push({ measure, repeatStart: offset === 0 ? group.count : undefined, repeatEnd: offset === group.length - 1 ? group.count : undefined });
  });
  return out;
}

function partXml(score: ScoreDocument, track: Track, partId: string, instrumentIds: Map<number, string>): string {
  const measures = collapsed(track);
  const state = { pendingTie: false, pendingSlur: false };
  let timeSignature = score.initialTimeSignature;
  const body = measures.map((entry, i) => {
    const m = entry.measure;
    if (m.timeSignature) timeSignature = m.timeSignature;
    const parts: string[] = [`<measure number="${i + 1}">`];
    if (entry.repeatStart) parts.push('<barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>');
    parts.push(attributesXml(track, score, m, i === 0));
    if (i === 0) parts.push(tempoXml(score.initialTempo));
    else if (m.tempoChange !== undefined) parts.push(tempoXml(m.tempoChange));
    const [v1, ...rest] = m.voices;
    if (v1) parts.push(voiceXml(track, v1, state, instrumentIds));
    for (const v of rest) {
      parts.push(`<backup><duration>${Math.round(measureLengthInQN(timeSignature) * DIVISIONS)}</duration></backup>`);
      parts.push(voiceXml(track, v, { pendingTie: false, pendingSlur: false }, instrumentIds));
    }
    const last = i === measures.length - 1;
    if (entry.repeatEnd) parts.push(`<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward" times="${entry.repeatEnd}"/></barline>`);
    else if (m.endBarline === 'final' || (last && m.endBarline !== 'single')) parts.push('<barline location="right"><bar-style>light-heavy</bar-style></barline>');
    parts.push('</measure>');
    return parts.join('');
  }).join('');
  return `<part id="${partId}">${body}</part>`;
}

function percussionInstruments(track: Track): Map<number, string> {
  const ids = new Map<number, string>();
  if (!isPercussion(track.instrument)) return ids;
  for (const m of track.measures) for (const v of m.voices) for (const e of v.events) {
    const pitches = e.kind === 'note' ? [e] : e.kind === 'chord' ? e.notes : [];
    for (const p of pitches) {
      const gm = p.percussion?.sourceMidi;
      if (gm !== undefined && !ids.has(gm)) ids.set(gm, `I${gm}`);
    }
  }
  return ids;
}

export function writeMusicXml(score: ScoreDocument, trackIndexes: number[]): string {
  const tracks = trackIndexes.map(i => score.tracks[i]).filter(Boolean);
  const partIds = tracks.map((_, k) => `P${k + 1}`);
  const instrumentIdsByPart = tracks.map((t, k) => {
    const ids = percussionInstruments(t);
    return new Map(Array.from(ids, ([gm, id]) => [gm, `${partIds[k]}-${id}`]));
  });

  const partList = tracks.map((t, k) => {
    const midi = Array.from(instrumentIdsByPart[k], ([gm, id]) =>
      `<score-instrument id="${id}"><instrument-name>${escapeXml(t.displayName)}</instrument-name></score-instrument>` +
      `<midi-instrument id="${id}"><midi-channel>10</midi-channel><midi-unpitched>${gm + 1}</midi-unpitched></midi-instrument>`).join('');
    return `<score-part id="${partIds[k]}"><part-name>${escapeXml(t.displayName)}</part-name>${midi}</score-part>`;
  }).join('');

  const parts = tracks.map((t, k) => partXml(score, t, partIds[k], instrumentIdsByPart[k])).join('');
  const composer = score.composer ? `<identification><creator type="composer">${escapeXml(score.composer)}</creator><encoding><software>Latin Music Mastery PlaySense Studio</software></encoding></identification>`
    : '<identification><encoding><software>Latin Music Mastery PlaySense Studio</software></encoding></identification>';

  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n' +
    `<score-partwise version="4.0"><work><work-title>${escapeXml(score.title)}</work-title></work>${composer}<part-list>${partList}</part-list>${parts}</score-partwise>`;
}
