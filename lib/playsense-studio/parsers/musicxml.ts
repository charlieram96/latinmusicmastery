// PlaySense Studio — MusicXML → ScoreDocument.
//
// Handles both .musicxml (plain XML) and .mxl (zipped). For .mxl we open
// the META-INF/container.xml manifest, read the rootfile path, then load
// that XML inside the zip. Plain .musicxml just parses directly.
//
// What we extract:
//   - score-partwise structure (the only layout we support; if we get
//     score-timewise, we throw)
//   - parts → tracks. Each part becomes one Track in our model.
//   - measures → Measures with a single Voice each. Multi-voice support
//     would land in M8 alongside the visual editor.
//   - notes: pitch (step + octave + alter), rest, type (whole/half/etc.),
//     dot, chord (siblings of <chord/> are merged into the prior note).
//   - attributes: time signature, key signature (fifths), divisions.
//   - direction/sound tempo as initialTempo.
//
// Out of scope for v1: tuplets beyond triplets, ties (we emit them in the
// model but don't yet preserve <tied/> across imports), articulations,
// ornaments, lyrics, voltas. If a MusicXML file uses those, we still
// import what we understand and ignore the rest — the renderer doesn't
// support those features yet anyway.

import JSZip from 'jszip';
import type {
  Chord,
  Instrument,
  Measure,
  MusicalEvent,
  PercussionNotation,
  Note,
  Rest,
  ScoreDocument,
  Track,
  Voice,
} from '@/components/playsense-studio/shared/score-model/types';
import { gmToStrokeMidi, inferPercInstrument } from '../gm-percussion';
import { getPercStrokes, isPercussion } from '../perc-strokes';
import { musicXmlNotehead } from '../percussion-noteheads';

const TYPE_TO_QN: Record<string, number> = {
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
  '16th': 0.25,
  '32nd': 0.125,
  '64th': 0.0625,
  breve: 8,
  long: 16,
};

export interface ParseMusicXmlOptions {
  title?: string;
}

export async function parseMusicXmlBuffer(
  data: ArrayBuffer,
  filename: string,
  options: ParseMusicXmlOptions = {}
): Promise<ScoreDocument> {
  const xml = filename.toLowerCase().endsWith('.mxl')
    ? await extractMxl(data)
    : new TextDecoder('utf-8').decode(data);
  return parseMusicXmlString(xml, options);
}

export function parseMusicXmlString(
  xml: string,
  options: ParseMusicXmlOptions = {}
): ScoreDocument {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error(`MusicXML parse error: ${parserError.textContent ?? 'unknown'}`);
  }

  const root = doc.documentElement;
  if (root.tagName !== 'score-partwise') {
    throw new Error(
      `Unsupported MusicXML layout "${root.tagName}". Only score-partwise is supported.`
    );
  }

  const titleFromXml = doc.querySelector('work > work-title')?.textContent?.trim();
  const movementTitle = doc.querySelector('movement-title')?.textContent?.trim();

  // Extract initial tempo / time-signature / key from the first measure of
  // the first part. This matches MusicXML's typical structure where these
  // attributes are declared on measure 1 of part 1.
  const firstMeasure = doc.querySelector('part > measure');
  const initialTimeSignature = readTimeSignature(firstMeasure) ?? [4, 4];
  const initialKeyFifths = readKeyFifths(firstMeasure) ?? 0;
  const initialTempo = readTempo(doc) ?? 120;

  const partList = Array.from(
    doc.querySelectorAll('part-list > score-part')
  ) as Element[];
  const partInfo = new Map<
    string,
    { name: string; instrument: Instrument; instrumentGm: Map<string, number> }
  >();
  for (const sp of partList) {
    const id = sp.getAttribute('id') ?? '';
    const name = sp.querySelector('part-name')?.textContent?.trim() || id;
    const programEl = sp.querySelector('midi-instrument > midi-program');
    const program = programEl ? Number(programEl.textContent) : NaN;

    // Percussion parts declare one or more <midi-instrument> entries, each
    // optionally carrying a <midi-unpitched> General-MIDI key (1-based) and a
    // <midi-channel> (10 = drums). Collect them so each unpitched note can
    // resolve its GM key via the note's <instrument id> reference.
    const instrumentGm = new Map<string, number>();
    const gmNotes: number[] = [];
    let anyDrumChannel = false;
    for (const mi of Array.from(sp.querySelectorAll('midi-instrument'))) {
      const miId = mi.getAttribute('id') ?? '';
      if (Number(mi.querySelector('midi-channel')?.textContent) === 10) anyDrumChannel = true;
      const unpitchedEl = mi.querySelector('midi-unpitched');
      if (unpitchedEl) {
        const gm = Number(unpitchedEl.textContent) - 1; // MusicXML is 1-based
        if (Number.isInteger(gm) && gm >= 0 && gm <= 127) {
          if (miId) instrumentGm.set(miId, gm);
          gmNotes.push(gm);
        }
      }
    }

    const sourcePart = Array.from(root.querySelectorAll(':scope > part')).find(p => p.getAttribute('id') === id);
    const isUnpitched = instrumentGm.size > 0 || anyDrumChannel || !!sourcePart?.querySelector('unpitched')
      || sourcePart?.querySelector('clef > sign')?.textContent === 'percussion';
    const instrument = guessInstrument(program, name, { isUnpitched, gmNotes });
    partInfo.set(id, { name, instrument, instrumentGm });
  }

  const tracks: Track[] = [];
  const partEls = Array.from(doc.querySelectorAll('part')) as Element[];
  partEls.forEach((part, idx) => {
    const id = part.getAttribute('id') ?? '';
    const info =
      partInfo.get(id) ??
      { name: `Part ${idx + 1}`, instrument: 'staff' as const, instrumentGm: new Map<string, number>() };
    const measures = parsePartMeasures(part, initialTimeSignature, info.instrument, info.instrumentGm);
    tracks.push({
      index: idx,
      instrument: info.instrument,
      displayName: info.name,
      tuning: null,
      stringMultiplicity: 1,
      channel: null,
      defaultView: 'staff',
      measures,
    });
  });

  return {
    schemaVersion: 1,
    title:
      options.title?.trim() ||
      titleFromXml ||
      movementTitle ||
      'Imported MusicXML',
    sourceFormat: 'musicxml',
    initialTempo,
    initialTimeSignature,
    initialKeyFifths,
    tracks: tracks.length > 0 ? tracks : [{
      index: 0,
      instrument: 'staff',
      displayName: 'Staff',
      tuning: null,
      stringMultiplicity: 1,
      channel: null,
      defaultView: 'staff',
      measures: [],
    }],
  };
}

// ---------------------------------------------------------------------------
// .mxl extraction
// ---------------------------------------------------------------------------

async function extractMxl(data: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(data);
  // Read the manifest to find the main score file.
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) {
    // Fall back: pick the first .xml that's not the container.
    const candidate = zip.file(/\.xml$/i)?.[0];
    if (!candidate) throw new Error('.mxl missing both container.xml and any .xml file.');
    return candidate.async('string');
  }
  const manifestXml = await containerFile.async('string');
  const manifest = new DOMParser().parseFromString(manifestXml, 'application/xml');
  const rootfile = manifest.querySelector('rootfile')?.getAttribute('full-path');
  if (!rootfile) throw new Error('.mxl container.xml has no rootfile.');
  const main = zip.file(rootfile);
  if (!main) throw new Error(`.mxl rootfile "${rootfile}" not found in archive.`);
  return main.async('string');
}

// ---------------------------------------------------------------------------
// Part / measure parsing
// ---------------------------------------------------------------------------

function parsePartMeasures(
  part: Element,
  initialTimeSignature: [number, number],
  instrument: Instrument,
  instrumentGm: Map<string, number>
): Measure[] {
  const midiCtx: NoteMidiContext = { instrument, instrumentGm };
  let timeSignature: [number, number] = initialTimeSignature;
  let divisions = 1; // ticks per quarter, set by <attributes><divisions>
  const measureEls = Array.from(part.querySelectorAll(':scope > measure')) as Element[];
  const out: Measure[] = [];

  measureEls.forEach((m, idx) => {
    // attribute updates apply for THIS measure forward.
    const attrEl = m.querySelector(':scope > attributes');
    if (attrEl) {
      const ts = readTimeSignature(m);
      if (ts) timeSignature = ts;
      const div = attrEl.querySelector('divisions')?.textContent;
      if (div) {
        const n = Number(div);
        if (Number.isFinite(n) && n > 0) divisions = n;
      }
    }
    const tempoChange = readTempoChange(m);
    const keyFifths = readKeyFifths(m);

    const events: MusicalEvent[] = [];
    const noteEls = Array.from(m.querySelectorAll(':scope > note')) as Element[];

    for (const noteEl of noteEls) {
      const isChordContinuation = noteEl.querySelector(':scope > chord') !== null;
      const isRest = noteEl.querySelector(':scope > rest') !== null;
      const durationTicks = Number(
        noteEl.querySelector(':scope > duration')?.textContent ?? '0'
      );
      const durationQN = durationTicks / divisions;
      const typeEl = noteEl.querySelector(':scope > type')?.textContent?.trim();
      const dotted = noteEl.querySelectorAll(':scope > dot').length > 0;

      // Resolve duration: prefer <type> when available (more reliable across
      // engravings) and fall back to derived QN when missing.
      const baseQN = typeEl && TYPE_TO_QN[typeEl] !== undefined ? TYPE_TO_QN[typeEl] : durationQN;
      const finalDurationQN = dotted ? baseQN * 1.5 : baseQN;

      if (isChordContinuation) {
        // Merge into the previous event as a chord pitch.
        const prev = events[events.length - 1];
        if (prev && (prev.kind === 'note' || prev.kind === 'chord')) {
          const pitch = isRest ? null : noteToPitch(noteEl, midiCtx);
          if (pitch !== null) {
            if (prev.kind === 'note') {
              const chord: Chord = {
                kind: 'chord',
                durationQN: prev.durationQN,
                dotted: prev.dotted,
                notes: [
                  { midi: prev.midi, spellingHint: prev.spellingHint, percussion: prev.percussion },
                  pitch,
                ],
              };
              events[events.length - 1] = chord;
            } else {
              prev.notes.push(pitch);
            }
          }
        }
        continue;
      }

      if (isRest) {
        events.push({
          kind: 'rest',
          durationQN: finalDurationQN,
          dotted,
        } satisfies Rest);
      } else {
        const pitch = noteToPitch(noteEl, midiCtx);
        if (pitch === null) continue;
        events.push({
          kind: 'note',
          ...pitch,
          durationQN: finalDurationQN,
          dotted,
        } satisfies Note);
      }
    }

    const voice: Voice = { number: 1, events };
    out.push({
      number: idx + 1,
      timeSignature: m === measureEls[0] ? undefined : readTimeSignature(m) ?? undefined,
      tempoChange: tempoChange ?? undefined,
      keyFifths: keyFifths ?? undefined,
      voices: [voice],
    });
  });

  return out;
}

function readTimeSignature(measure: Element | null): [number, number] | null {
  if (!measure) return null;
  const time = measure.querySelector(':scope > attributes > time');
  if (!time) return null;
  const beats = Number(time.querySelector('beats')?.textContent);
  const beatType = Number(time.querySelector('beat-type')?.textContent);
  if (!Number.isFinite(beats) || !Number.isFinite(beatType)) return null;
  return [beats, beatType];
}

function readKeyFifths(measure: Element | null): number | null {
  if (!measure) return null;
  const key = measure.querySelector(':scope > attributes > key > fifths');
  if (!key) return null;
  const f = Number(key.textContent);
  return Number.isFinite(f) ? f : null;
}

function readTempo(doc: Document): number | null {
  // Find the first <sound tempo="..."> anywhere in the document.
  const sound = doc.querySelector('sound[tempo]');
  if (!sound) return null;
  const t = Number(sound.getAttribute('tempo'));
  return Number.isFinite(t) && t > 0 ? t : null;
}

function readTempoChange(measure: Element): number | null {
  const sound = measure.querySelector(':scope sound[tempo]');
  if (!sound) return null;
  const t = Number(sound.getAttribute('tempo'));
  return Number.isFinite(t) && t > 0 ? t : null;
}

interface NoteMidiContext {
  /** Resolved track instrument (drives GM → stroke mapping for unpitched notes). */
  instrument: Instrument;
  /** This part's <midi-instrument id> → General-MIDI key (0-based). */
  instrumentGm: Map<string, number>;
}

/** Import written percussion independently from playback. Finale may use one
 * playback key for several symbols, or even encode a drum as a pitched note. */
function noteToPitch(noteEl: Element, ctx: NoteMidiContext): Pick<Note, 'midi' | 'percussion'> | null {
  const pitch = noteEl.querySelector(':scope > pitch');
  const unpitched = noteEl.querySelector(':scope > unpitched');
  if (!isPercussion(ctx.instrument) && !unpitched) {
    const midi = pitchToMidi(noteEl);
    return midi === null ? null : { midi };
  }
  if (!pitch && !unpitched) return null;
  const instrId = noteEl.querySelector(':scope > instrument')?.getAttribute('id') ?? '';
  let gm = ctx.instrumentGm.get(instrId);
  if (gm === undefined && ctx.instrumentGm.size === 1) gm = ctx.instrumentGm.values().next().value;
  const step = (unpitched?.querySelector('display-step') ?? pitch?.querySelector('step'))?.textContent?.trim().toLowerCase();
  const octave = (unpitched?.querySelector('display-octave') ?? pitch?.querySelector('octave'))?.textContent?.trim();
  const headEl = noteEl.querySelector(':scope > notehead');
  const notehead = musicXmlNotehead(headEl?.textContent?.trim(), headEl?.getAttribute('smufl'));
  const marcato = !!noteEl.querySelector('notations > articulations > strong-accent');
  const hasPosition = !!step && /^[a-g]$/.test(step) && !!octave && /^[0-9]$/.test(octave);
  if (!hasPosition && gm !== undefined) return { midi: gmToStrokeMidi(gm, ctx.instrument) };

  const percussion: PercussionNotation = {
    staffLine: hasPosition ? `${step}/${octave}` : 'b/4',
    notehead, ...(marcato ? { marcato: true } : {}),
    ...(gm !== undefined ? { sourceMidi: gm } : {}),
  };
  const candidates = (getPercStrokes(ctx.instrument) ?? []).filter(s => {
    const shape = s.notehead ?? s.noteType ?? 'normal';
    return s.staffLine === percussion.staffLine
      && (shape === notehead || (shape === 'ornate-x' && notehead === 'x'))
      && !!s.marcato === marcato;
  });
  const stroke = candidates.find(s => gm !== undefined && s.midi === gmToStrokeMidi(gm, ctx.instrument)) ?? candidates[0];
  if (stroke) percussion.strokeId = stroke.id;
  // Unrecognized positions stay exactly as written and can be assigned a stroke
  // in the builder. Never collapse them onto the first palette entry.
  return { midi: stroke?.midi ?? gm ?? pitchToMidi(noteEl) ?? 60, percussion };
}

function pitchToMidi(noteEl: Element): number | null {
  const pitch = noteEl.querySelector(':scope > pitch');
  if (!pitch) return null;
  const stepRaw = pitch.querySelector('step')?.textContent?.trim();
  const octaveRaw = pitch.querySelector('octave')?.textContent?.trim();
  const alterRaw = pitch.querySelector('alter')?.textContent?.trim();
  if (!stepRaw || !octaveRaw) return null;
  const stepMap: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const step = stepMap[stepRaw];
  if (step === undefined) return null;
  const octave = Number(octaveRaw);
  const alter = alterRaw ? Number(alterRaw) : 0;
  if (!Number.isFinite(octave) || !Number.isFinite(alter)) return null;
  return (octave + 1) * 12 + step + alter;
}

function guessInstrument(
  program: number,
  name: string,
  perc?: { isUnpitched: boolean; gmNotes: number[] }
): Instrument {
  const lower = name.toLowerCase();
  if (lower.includes('tres')) return 'tres';
  if (lower.includes('cuatro')) return 'cuatro';
  if (lower.includes('tiple')) return 'tiple';
  if (lower.includes('mandolin')) return 'mandolin';
  if (lower.includes('ukulele')) return 'ukulele';
  if (lower.includes('bass')) return 'bass';
  if (lower.includes('guitar')) return 'guitar';
  if (lower.includes('piano')) return 'piano';
  if (lower.includes('conga')) return 'perc-conga';
  if (lower.includes('bongo')) return 'perc-bongo';
  if (lower.includes('timbal')) return 'perc-timbal';
  if (lower.includes('clave')) return 'perc-clave';
  if (lower.includes('drum') || lower.includes('kit') || lower.includes('bater')) return 'perc-kit';

  // Unpitched part with no telltale name → infer the family from its GM keys.
  if (perc?.isUnpitched) return inferPercInstrument(perc.gmNotes);

  if (Number.isFinite(program)) {
    if (program >= 24 && program <= 31) return 'guitar';
    if (program >= 32 && program <= 39) return 'bass';
  }
  return 'staff';
}
