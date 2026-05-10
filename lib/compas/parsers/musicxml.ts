// Compás — MusicXML → ScoreDocument.
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
  Note,
  Rest,
  ScoreDocument,
  Track,
  Voice,
} from '@/components/compas/shared/score-model/types';

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
  const partInfo = new Map<string, { name: string; instrument: Instrument }>();
  for (const sp of partList) {
    const id = sp.getAttribute('id') ?? '';
    const name = sp.querySelector('part-name')?.textContent?.trim() || id;
    const programEl = sp.querySelector('midi-instrument > midi-program');
    const channelEl = sp.querySelector('midi-instrument > midi-channel');
    const program = programEl ? Number(programEl.textContent) : NaN;
    const channel = channelEl ? Number(channelEl.textContent) : NaN;
    const instrument = guessInstrument(program, channel, name);
    partInfo.set(id, { name, instrument });
  }

  const tracks: Track[] = [];
  const partEls = Array.from(doc.querySelectorAll('part')) as Element[];
  partEls.forEach((part, idx) => {
    const id = part.getAttribute('id') ?? '';
    const info = partInfo.get(id) ?? { name: `Part ${idx + 1}`, instrument: 'staff' as const };
    const measures = parsePartMeasures(part, initialTimeSignature);
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
  initialTimeSignature: [number, number]
): Measure[] {
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
          const midi = isRest ? null : pitchToMidi(noteEl);
          if (midi !== null) {
            if (prev.kind === 'note') {
              const chord: Chord = {
                kind: 'chord',
                durationQN: prev.durationQN,
                dotted: prev.dotted,
                notes: [
                  { midi: prev.midi, spellingHint: prev.spellingHint },
                  { midi },
                ],
              };
              events[events.length - 1] = chord;
            } else {
              prev.notes.push({ midi });
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
        const midi = pitchToMidi(noteEl);
        if (midi === null) continue;
        events.push({
          kind: 'note',
          midi,
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
  channel: number,
  name: string
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
  if (lower.includes('drum') || lower.includes('kit')) return 'perc-kit';
  if (Number.isFinite(channel) && channel === 9) return 'staff';
  if (Number.isFinite(program)) {
    if (program >= 24 && program <= 31) return 'guitar';
    if (program >= 32 && program <= 39) return 'bass';
  }
  return 'staff';
}
