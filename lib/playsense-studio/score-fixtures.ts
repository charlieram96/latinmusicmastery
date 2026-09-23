// PlaySense Studio — handwritten score fixtures used by tests and the M2 sandbox.
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
} from '@/components/playsense-studio/shared/score-model/types';

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
  composer: 'PlaySense Studio Test Fixture',
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
  composer: 'PlaySense Studio Test Fixture',
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
  composer: 'PlaySense Studio Test Fixture',
  sourceFormat: 'native',
  initialTempo: 96,
  initialTimeSignature: [4, 4],
  initialKeyFifths: 0,
  tracks: [TRES_TRACK, BASS_TRACK, SON_CONGA_TRACK],
};

// ---------------------------------------------------------------------------
// Fixture 4 — Reference excerpt (Studio rework P2 notation reference)
//
// The violin line from the reference image (spec §2.3), extended to show every
// mark P2 must draw. 3/4, F major after bar 3, ♩ = 96.
// ---------------------------------------------------------------------------

/** The violin line from the reference image (spec §2.3), extended to show every
 * mark P2 must draw. 3/4, F major after bar 3, ♩ = 96. */
export const REFERENCE_EXCERPT_FIXTURE: ScoreDocument = {
  schemaVersion: 1, title: 'Reference excerpt', sourceFormat: 'native', initialTempo: 96, initialTimeSignature: [3, 4], initialKeyFifths: 0,
  tracks: [{ index: 0, instrument: 'staff', displayName: 'Violin', tuning: null, stringMultiplicity: 1, channel: null, defaultView: 'staff', measures: [
    { number: 1, voices: [{ number: 1, events: [
      { kind: 'rest', id: 'r1', durationQN: 1 },
      { kind: 'note', id: 'n1', midi: 65, durationQN: 1 / 3, triplet: true, tuplet: { id: 't1', n: 3, m: 2 }, dynamic: 'mp' },
      { kind: 'note', id: 'n2', midi: 67, durationQN: 1 / 3, triplet: true, tuplet: { id: 't1', n: 3, m: 2 } },
      { kind: 'note', id: 'n3', midi: 69, durationQN: 1 / 3, triplet: true, tuplet: { id: 't1', n: 3, m: 2 } },
      { kind: 'note', id: 'n4', midi: 71, durationQN: 0.25 },
      { kind: 'note', id: 'n5', midi: 72, durationQN: 0.25 },
      { kind: 'note', id: 'n6', midi: 73, durationQN: 0.25, spelling: { step: 'D', alter: -1 } },
      { kind: 'note', id: 'n7', midi: 75, durationQN: 0.25, spelling: { step: 'E', alter: -1 } },
    ] }] },
    { number: 2, voices: [{ number: 1, events: [
      { kind: 'note', id: 'n8', midi: 76, durationQN: 1, spelling: { step: 'E', alter: 0, showAccidental: 'always' }, dynamic: 'f' },
      { kind: 'note', id: 'n9', midi: 79, durationQN: 1 },
      { kind: 'rest', id: 'r2', durationQN: 0.5 },
      { kind: 'note', id: 'n10', midi: 84, durationQN: 0.5, articulation: 'staccato' },   // legacy field on purpose
    ] }] },
    { number: 3, keyFifths: -1, voices: [{ number: 1, events: [
      { kind: 'note', id: 'n11', midi: 86, durationQN: 1, grace: [{ midi: 85, spelling: { step: 'C', alter: 1 }, slash: true }] },
      { kind: 'note', id: 'n12', midi: 88, durationQN: 0.2, tuplet: { id: 't2', n: 5, m: 4 } },
      { kind: 'note', id: 'n13', midi: 86, durationQN: 0.2, tuplet: { id: 't2', n: 5, m: 4 } },
      { kind: 'note', id: 'n14', midi: 84, durationQN: 0.2, tuplet: { id: 't2', n: 5, m: 4 } },
      { kind: 'note', id: 'n15', midi: 82, durationQN: 0.2, tuplet: { id: 't2', n: 5, m: 4 } },
      { kind: 'note', id: 'n16', midi: 81, durationQN: 0.2, tuplet: { id: 't2', n: 5, m: 4 } },
      { kind: 'note', id: 'n17', midi: 79, durationQN: 1, ornament: 'trill', articulations: ['fermata'] },
    ] }] },
    { number: 4, voices: [
      { number: 1, events: [
        { kind: 'note', id: 'n18', midi: 71, durationQN: 1.75, dots: 2, spelling: { step: 'B', alter: 0 }, text: 'dolce' },
        { kind: 'note', id: 'n19', midi: 69, durationQN: 0.25 },
        { kind: 'chord', id: 'n20', durationQN: 1, articulations: ['accent', 'tenuto'], notes: [{ midi: 70 }, { midi: 74 }] },
      ] },
      { number: 2, events: [
        { kind: 'note', id: 'v2a', midi: 62, durationQN: 2 },
        { kind: 'rest', id: 'v2b', durationQN: 1 },
      ] },
    ] },
    { number: 5, clef: 'bass', endBarline: 'final', voices: [{ number: 1, events: [
      { kind: 'note', id: 'n21', midi: 53, durationQN: 3, dots: undefined, dotted: true, dynamic: 'ff', articulations: ['marcato'] },
    ] }] },
  ] }],
  spans: [
    { id: 's1', type: 'cresc', from: 'n1', to: 'n7' },
    { id: 's2', type: 'slur', from: 'n8', to: 'n9' },
    { id: 's3', type: 'slur', from: 'n10', to: 'n11' },
    { id: 's4', type: 'dim', from: 'n12', to: 'n17' },
  ],
}

// ---------------------------------------------------------------------------
// Index by id for tests + sandbox
// ---------------------------------------------------------------------------

export const FIXTURES = {
  guitarLick: GUITAR_LICK_FIXTURE,
  congaTumbao: CONGA_TUMBAO_FIXTURE,
  sonMontuno: SON_MONTUNO_FIXTURE,
  REFERENCE_EXCERPT: REFERENCE_EXCERPT_FIXTURE,
} as const;

export type FixtureId = keyof typeof FIXTURES;
