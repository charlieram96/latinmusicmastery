// Compás — handwritten score fixtures used by tests and the M2 sandbox.
//
// These are intentionally small. The point is exercising the model + time
// math + serialization, not authoring real teaching content. They map cleanly
// to staff (guitar lick), percussion (conga pattern), and multi-track
// (son montuno) renderers.

import type {
  Chord,
  Measure,
  Note,
  Rest,
  ScoreDocument,
  Track,
} from '@/components/compas/shared/score-model/types';

// ---------------------------------------------------------------------------
// Construction helpers
// ---------------------------------------------------------------------------

function note(midi: number, durationQN: number, extras: Partial<Note> = {}): Note {
  return { kind: 'note', midi, durationQN, ...extras };
}

function rest(durationQN: number, extras: Partial<Rest> = {}): Rest {
  return { kind: 'rest', durationQN, ...extras };
}

function chord(midis: number[], durationQN: number): Chord {
  return {
    kind: 'chord',
    durationQN,
    notes: midis.map((midi) => ({ midi })),
  };
}

function measure(
  number: number,
  events: Array<Note | Rest | Chord>,
  options: { timeSignature?: [number, number]; tempoChange?: number } = {}
): Measure {
  return {
    number,
    timeSignature: options.timeSignature,
    tempoChange: options.tempoChange,
    voices: [{ number: 1, events }],
  };
}

// ---------------------------------------------------------------------------
// Fixture 1 — Guitar lick: C major scale ascending
//
// 2 measures of 4/4 at 120 BPM. Single track, single voice, eight quarter
// notes (C4 → C5). Used to exercise: staff render, click-to-seek hit testing,
// the "beat 4 of measure 2 = 3500 ms" demo from the plan.
// ---------------------------------------------------------------------------

const GUITAR_TRACK: Track = {
  index: 0,
  instrument: 'guitar',
  displayName: 'Guitar',
  tuning: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
  stringMultiplicity: 1,
  channel: 0,
  defaultView: 'staff',
  measures: [
    measure(1, [
      note(60, 1), // C4
      note(62, 1), // D4
      note(64, 1), // E4
      note(65, 1), // F4
    ]),
    measure(2, [
      note(67, 1), // G4
      note(69, 1), // A4
      note(71, 1), // B4
      note(72, 1), // C5
    ]),
  ],
};

export const GUITAR_LICK_FIXTURE: ScoreDocument = {
  schemaVersion: 1,
  title: 'C Major Scale Ascending',
  composer: 'Compás Test Fixture',
  sourceFormat: 'native',
  initialTempo: 120,
  initialTimeSignature: [4, 4],
  initialKeyFifths: 0,
  tracks: [GUITAR_TRACK],
};

// ---------------------------------------------------------------------------
// Fixture 2 — Conga tumbao (single bar, looping by repeat)
//
// 2 bars of 4/4 at 100 BPM. Standard 2-3 tumbao approximation using GM
// percussion MIDI numbers (62 = mute/slap, 63 = open low, 64 = open high).
// Track default view is rhythm-grid; staff view is also valid.
// ---------------------------------------------------------------------------

// Conga tumbao 2-3, simplified into eighth notes:
// |  S  -  O  O  |  B  -  O  O  |  (S=slap, O=open high, B=bass low)
const TUMBAO_BAR: Array<Note | Rest> = [
  note(62, 0.5), // 1   - slap
  rest(0.5),     // 1.5
  note(64, 0.5), // 2   - open high
  note(64, 0.5), // 2.5 - open high
  note(63, 0.5), // 3   - bass low
  rest(0.5),     // 3.5
  note(64, 0.5), // 4   - open high
  note(64, 0.5), // 4.5 - open high
];

const CONGA_TRACK: Track = {
  index: 0,
  instrument: 'perc-conga',
  displayName: 'Conga',
  tuning: null,
  stringMultiplicity: 1,
  channel: 9, // GM percussion channel
  defaultView: 'rhythm-grid',
  measures: [measure(1, TUMBAO_BAR), measure(2, TUMBAO_BAR)],
};

export const CONGA_TUMBAO_FIXTURE: ScoreDocument = {
  schemaVersion: 1,
  title: 'Conga Tumbao 2-3',
  composer: 'Compás Test Fixture',
  sourceFormat: 'native',
  initialTempo: 100,
  initialTimeSignature: [4, 4],
  initialKeyFifths: 0,
  tracks: [CONGA_TRACK],
};

// ---------------------------------------------------------------------------
// Fixture 3 — Son montuno (multi-track: tres + bass + conga)
//
// 4 bars of 4/4 starting at 96 BPM, with a tempo change to 110 BPM at bar 3
// to exercise tempo-change math. Three simultaneous tracks. Mirrors what
// admins are likely to upload for a beginner clave-locked example.
// ---------------------------------------------------------------------------

// Tres montuno: one chord per measure, anticipated on beat 4-and (offbeat).
// In the fixture we keep it on-beat to keep the math clean for tests.
const TRES_BAR_C = [chord([60, 64, 67], 1), rest(2), chord([60, 64, 67], 1)]; // C major
const TRES_BAR_F = [chord([60, 65, 69], 1), rest(2), chord([60, 65, 69], 1)]; // F major (1st inv)
const TRES_BAR_G = [chord([62, 67, 71], 1), rest(2), chord([62, 67, 71], 1)]; // G major

const TRES_TRACK: Track = {
  index: 0,
  instrument: 'tres',
  displayName: 'Tres',
  tuning: ['G3', 'C4', 'E4'],
  stringMultiplicity: 2,
  channel: 0,
  defaultView: 'tab',
  measures: [
    measure(1, TRES_BAR_C),
    measure(2, TRES_BAR_F),
    measure(3, TRES_BAR_G, { tempoChange: 110 }),
    measure(4, TRES_BAR_C),
  ],
};

// Bass walks on 1 and 3 (root and fifth).
const BASS_TRACK: Track = {
  index: 1,
  instrument: 'bass',
  displayName: 'Bass',
  tuning: ['E1', 'A1', 'D2', 'G2'],
  stringMultiplicity: 1,
  channel: 1,
  defaultView: 'tab',
  measures: [
    measure(1, [note(36, 1), rest(1), note(43, 1), rest(1)]), // C2, G2
    measure(2, [note(41, 1), rest(1), note(48, 1), rest(1)]), // F2, C3
    measure(3, [note(43, 1), rest(1), note(50, 1), rest(1)], { tempoChange: 110 }), // G2, D3
    measure(4, [note(36, 1), rest(1), note(43, 1), rest(1)]), // C2, G2
  ],
};

// Conga track repeats the tumbao with the tempo change at bar 3.
const SON_CONGA_TRACK: Track = {
  index: 2,
  instrument: 'perc-conga',
  displayName: 'Conga',
  tuning: null,
  stringMultiplicity: 1,
  channel: 9,
  defaultView: 'rhythm-grid',
  measures: [
    measure(1, TUMBAO_BAR),
    measure(2, TUMBAO_BAR),
    measure(3, TUMBAO_BAR, { tempoChange: 110 }),
    measure(4, TUMBAO_BAR),
  ],
};

export const SON_MONTUNO_FIXTURE: ScoreDocument = {
  schemaVersion: 1,
  title: 'Son Montuno (C / F / G / C)',
  composer: 'Compás Test Fixture',
  sourceFormat: 'native',
  initialTempo: 96,
  initialTimeSignature: [4, 4],
  initialKeyFifths: 0,
  tracks: [TRES_TRACK, BASS_TRACK, SON_CONGA_TRACK],
};

// ---------------------------------------------------------------------------
// Index by id for tests + sandbox
// ---------------------------------------------------------------------------

export const FIXTURES = {
  guitarLick: GUITAR_LICK_FIXTURE,
  congaTumbao: CONGA_TUMBAO_FIXTURE,
  sonMontuno: SON_MONTUNO_FIXTURE,
} as const;

export type FixtureId = keyof typeof FIXTURES;
