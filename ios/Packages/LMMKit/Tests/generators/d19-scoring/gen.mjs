// D19 golden-fixture generator. Executes the REAL lib/play-sense TypeScript (bundled
// verbatim by build.mjs via esbuild, no logic edits) and records inputs + outputs as
// JSON fixtures for the Swift PlaySenseCore parity suite.
//
// Usage:  node build.mjs && node gen.mjs
// Output: ios/Packages/LMMKit/Tests/PlaySenseCoreTests/Fixtures/*.json
//
// Determinism: every random value comes from the single mulberry32 stream in prng.mjs
// (SEED recorded in each file + the README), so a regen is byte-identical.

import fs from 'node:fs';
import path from 'node:path';
import * as lib from './bundle.mjs';
import { SEED, randFloat, randInt, randBool, randChoice, shuffle } from './prng.mjs';

const REPO = '/Users/charlieramirez/Desktop/latinmusicmastery';
const OUT_DIR = path.join(REPO, 'ios/Packages/LMMKit/Tests/PlaySenseCoreTests/Fixtures');
fs.mkdirSync(OUT_DIR, { recursive: true });

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];
const SURFACES = ['quinto', 'conga', 'tumba', 'macho', 'hembra', 'cascara', 'cencerro', 'clave', 'campana', 'jamblock'];
const TECHNIQUES = ['open', 'slap', 'mute', 'bass', 'touch', 'rim', 'shell', 'bell', 'tip', 'heel'];
const CATEGORIES = ['percussion', 'pitched'];
const ALL_INSTRUMENTS = [
  'conga', 'timbale', 'bongo', 'clave', 'cowbell', 'guiro',
  'guitar', 'bass', 'piano', 'tres', 'cuatro', 'trumpet', 'saxophone', 'flute', 'violin',
];

function writeFixture(filename, payload) {
  const file = path.join(OUT_DIR, filename);
  fs.writeFileSync(file, JSON.stringify({ seed: SEED, ...payload }, null, 1) + '\n');
  const n = payload.cases ? payload.cases.length
    : Object.values(payload).reduce((s, v) => s + (Array.isArray(v) ? v.length : 0), 0);
  console.log(`${filename}: ${n} cases`);
  return n;
}

// ---------------------------------------------------------------------------
// Shared input builders
// ---------------------------------------------------------------------------

/** Random ExpectedEvent list. Timestamps may collide on purpose (chords / stable-sort). */
function randomExpectedEvents({ pitched = false, chordGroups = false } = {}) {
  const count = randInt(1, 8);
  const events = [];
  let t = randFloat(0, 2);
  for (let i = 0; i < count; i++) {
    // Occasionally repeat the previous timestamp exactly (ties exercise stable order).
    if (i > 0 && randBool(0.15)) {
      t = events[i - 1].timestamp;
    } else {
      t += randFloat(0.05, 1.2);
    }
    const ev = { eventIndex: i, timestamp: t };
    if (pitched ? randBool(0.9) : randBool(0.15)) ev.expectedPitch = randInt(36, 88);
    if (randBool(0.5)) ev.expectedTechnique = randChoice(TECHNIQUES);
    if (randBool(0.4)) ev.expectedDurationSec = randFloat(0.1, 2);
    if (!pitched && randBool(0.5)) ev.expectedSurface = randChoice(SURFACES);
    if (chordGroups && randBool(0.5)) ev.chordId = `c${randInt(0, 2)}`;
    events.push(ev);
  }
  return events;
}

function centsToFreq(baseMidi, cents) {
  const baseFreq = 440 * Math.pow(2, (baseMidi - 69) / 12);
  return baseFreq * Math.pow(2, cents / 1200);
}

// ---------------------------------------------------------------------------
// 1. gradeSingleOnset
// ---------------------------------------------------------------------------

function genGradeSingleOnset() {
  const cases = [];

  const push = (name, input) => {
    const matchedIndices = new Set(input.matchedIndices);
    const result = lib.gradeSingleOnset(
      input.onsetTimestamp,
      input.onsetEnergy,
      input.expectedEvents,
      matchedIndices,
      input.difficulty,
      input.calibrationOffsetSec,
      input.widenMs,
      input.instrumentCategory,
      input.detectedMidiNote,
      input.detectedFrequency,
      input.detectedSurface
    );
    cases.push({
      name,
      input,
      output: { result, matchedIndices: [...matchedIndices].sort((a, b) => a - b) },
    });
  };

  // --- vitest-derived cases (lib/play-sense/__tests__/scoring.test.ts) ---
  const A4 = 440;
  const pitchedEvent = () => [{ eventIndex: 0, timestamp: 1.0, expectedPitch: 69 }];
  const vitestGrade = (name, freq, difficulty = 'beginner', onsetTimestamp = 1.0) =>
    push(name, {
      onsetTimestamp,
      onsetEnergy: 1.0,
      expectedEvents: pitchedEvent(),
      matchedIndices: [],
      difficulty,
      calibrationOffsetSec: 0,
      widenMs: 0,
      instrumentCategory: 'pitched',
      detectedMidiNote: freq != null ? Math.round(69 + 12 * Math.log2(freq / 440)) : null,
      detectedFrequency: freq,
      detectedSurface: null,
    });
  vitestGrade('vitest: in-tune on-time perfect', A4);
  vitestGrade('vitest: slightly flat within tolerance', centsToFreq(69, -40));
  vitestGrade('vitest: octave error beginner', A4 * 2);
  vitestGrade('vitest: octave error advanced', A4 * 2, 'advanced');
  vitestGrade('vitest: tritone wrong pitch downgrade', centsToFreq(69, 600));
  vitestGrade('vitest: expected pitch nothing detected', null);
  push('vitest: percussion timing only', {
    onsetTimestamp: 1.0,
    onsetEnergy: 1.0,
    expectedEvents: [{ eventIndex: 0, timestamp: 1.0 }],
    matchedIndices: [],
    difficulty: 'beginner',
    calibrationOffsetSec: 0,
    widenMs: 0,
    instrumentCategory: 'percussion',
    detectedMidiNote: null,
    detectedFrequency: null,
    detectedSurface: null,
  });

  // --- seeded property cases ---
  const CENT_POOL = [-1250, -1200, -600, -90, -81, -80, -79, -55, -40, -35, -20, 0,
    20, 35, 40, 55, 79, 80, 81, 90, 600, 1200, 1250];
  for (let i = 0; i < 500; i++) {
    const instrumentCategory = randChoice(CATEGORIES);
    const pitched = instrumentCategory === 'pitched';
    const expectedEvents = randomExpectedEvents({ pitched });
    const matchedIndices = expectedEvents.filter(() => randBool(0.2)).map((e) => e.eventIndex);
    const anchor = randChoice(expectedEvents);
    const calibrationOffsetSec = randChoice([0, 0, randFloat(-0.08, 0.08)]);
    const widenMs = randChoice([0, 0, 0, 10, randFloat(0, 40)]);
    // Mostly near an event (exercising all grade windows), sometimes nowhere near.
    const offsetSec = randBool(0.85) ? randFloat(-0.16, 0.16) : randFloat(0.5, 3);
    const onsetTimestamp = anchor.timestamp + calibrationOffsetSec + offsetSec;

    let detectedFrequency = null;
    let detectedMidiNote = null;
    if (pitched) {
      const mode = randInt(0, 3); // 0: freq(+midi), 1: freq only, 2: midi only, 3: nothing
      const refMidi = anchor.expectedPitch ?? randInt(40, 84);
      if (mode <= 1) {
        const cents = randBool(0.7) ? randChoice(CENT_POOL) + randFloat(-3, 3) : randFloat(-2400, 2400);
        detectedFrequency = centsToFreq(refMidi, cents);
        if (mode === 0) detectedMidiNote = Math.round(69 + 12 * Math.log2(detectedFrequency / 440));
      } else if (mode === 2) {
        detectedMidiNote = refMidi + randChoice([0, 0, 0, 1, -1, 12, -12, 7, 5]);
      }
    }
    const detectedSurface = randBool(0.5)
      ? (randBool(0.6) && anchor.expectedSurface ? anchor.expectedSurface : randChoice(SURFACES))
      : null;

    push(`prop-${i}`, {
      onsetTimestamp,
      onsetEnergy: randFloat(0.01, 1.5),
      expectedEvents,
      matchedIndices,
      difficulty: randChoice(DIFFICULTIES),
      calibrationOffsetSec,
      widenMs,
      instrumentCategory,
      detectedMidiNote,
      detectedFrequency,
      detectedSurface,
    });
  }

  return writeFixture('grade_single_onset.json', { cases });
}

// ---------------------------------------------------------------------------
// 2. gradeChordOnset
// ---------------------------------------------------------------------------

function genGradeChordOnset() {
  const cases = [];

  const push = (name, input) => {
    const matchedIndices = new Set(input.matchedIndices);
    const results = lib.gradeChordOnset(
      input.onsetTimestamp,
      input.onsetEnergy,
      input.expectedEvents,
      matchedIndices,
      input.chordId,
      input.difficulty,
      input.calibrationOffsetSec,
      input.widenMs,
      input.chroma
    );
    cases.push({
      name,
      input,
      output: { results, matchedIndices: [...matchedIndices].sort((a, b) => a - b) },
    });
  };

  // --- vitest-derived cases (chord-scoring.test.ts): C major triad ---
  const triad = () => [
    { eventIndex: 0, timestamp: 1.0, expectedPitch: 60, chordId: 'c0' },
    { eventIndex: 1, timestamp: 1.0, expectedPitch: 64, chordId: 'c0' },
    { eventIndex: 2, timestamp: 1.0, expectedPitch: 67, chordId: 'c0' },
  ];
  const chromaWith = (pcs) => {
    const c = new Array(12).fill(0);
    for (const pc of pcs) c[pc] = 1;
    return c;
  };
  const vitestTriad = (name, chroma, difficulty = 'beginner') =>
    push(name, {
      onsetTimestamp: 1.0,
      onsetEnergy: 1.0,
      expectedEvents: triad(),
      matchedIndices: [],
      chordId: 'c0',
      difficulty,
      calibrationOffsetSec: 0,
      widenMs: 0,
      chroma,
    });
  vitestTriad('vitest: full triad perfect', chromaWith([0, 4, 7]));
  vitestTriad('vitest: 2of3 beginner hit', chromaWith([0, 4]));
  vitestTriad('vitest: 2of3 advanced downgraded', chromaWith([0, 4]), 'advanced');
  vitestTriad('vitest: 1of3 heavy downgrade', chromaWith([0]));
  vitestTriad('vitest: extra pitch classes no penalty', chromaWith([0, 4, 7, 1, 6]));
  {
    const quiet = chromaWith([0, 4]);
    quiet[7] = 0.2;
    vitestTriad('vitest: quiet bin below 35pct threshold', quiet, 'advanced');
  }
  vitestTriad('vitest: missing chroma lenient', null);

  // --- seeded property cases ---
  for (let i = 0; i < 500; i++) {
    const groupSize = randInt(1, 5);
    const chordId = `c${randInt(0, 3)}`;
    const chordTs = randFloat(0.5, 6);
    const events = [];
    for (let g = 0; g < groupSize; g++) {
      events.push({
        eventIndex: g,
        timestamp: chordTs,
        expectedPitch: randBool(0.92) ? randInt(36, 90) : undefined,
        chordId,
      });
    }
    // Occasionally duplicate a pitch class inside the group (distinct-set path).
    if (groupSize >= 2 && randBool(0.3)) events[1].expectedPitch = (events[0].expectedPitch ?? 60) + 12;
    // Non-group bystander events (different or missing chordId).
    const extraCount = randInt(0, 3);
    for (let e = 0; e < extraCount; e++) {
      events.push({
        eventIndex: groupSize + e,
        timestamp: randFloat(0, 8),
        expectedPitch: randBool(0.8) ? randInt(36, 90) : undefined,
        chordId: randBool(0.5) ? `x${e}` : undefined,
      });
    }

    let chroma;
    const chromaMode = randInt(0, 5);
    if (chromaMode === 0) chroma = null;
    else if (chromaMode === 1) chroma = new Array(12).fill(0); // all-zero → Infinity floor path
    else if (chromaMode === 2) chroma = new Array(randChoice([0, 6, 11, 13])).fill(0.5); // wrong length → lenient
    else {
      chroma = new Array(12).fill(0).map(() => (randBool(0.4) ? randFloat(0, 1) : 0));
      // Ensure the group's pitch classes are present in a slice of cases.
      if (randBool(0.5)) {
        for (const ev of events.slice(0, groupSize)) {
          if (ev.expectedPitch != null && randBool(0.75)) {
            chroma[((ev.expectedPitch % 12) + 12) % 12] = randFloat(0.3, 1);
          }
        }
      }
    }

    push(`prop-${i}`, {
      onsetTimestamp: chordTs + randFloat(-0.15, 0.15),
      onsetEnergy: randFloat(0.01, 1.5),
      expectedEvents: events,
      matchedIndices: [],
      chordId: randBool(0.9) ? chordId : 'missing-id', // sometimes no group → []
      difficulty: randChoice(DIFFICULTIES),
      calibrationOffsetSec: randChoice([0, 0, randFloat(-0.08, 0.08)]),
      widenMs: randChoice([0, 0, randFloat(0, 40)]),
      chroma,
    });
  }

  return writeFixture('grade_chord_onset.json', { cases });
}

// ---------------------------------------------------------------------------
// 3. greedyMatch
// ---------------------------------------------------------------------------

function genGreedyMatch() {
  const cases = [];

  const push = (name, input) => {
    const results = lib.greedyMatch(
      input.expectedEvents,
      input.detectedOnsets,
      input.difficulty,
      input.calibrationOffsetSec,
      input.widenMs
    );
    cases.push({ name, input, output: { results } });
  };

  for (let i = 0; i < 500; i++) {
    const expectedEvents = randBool(0.03) ? [] : randomExpectedEvents({ pitched: randBool(0.3) });
    // Present expected events in shuffled order — greedyMatch must sort internally.
    const shuffledExpected = shuffle(expectedEvents);
    const onsetCount = randInt(0, expectedEvents.length + 4);
    const detectedOnsets = [];
    for (let o = 0; o < onsetCount; o++) {
      const anchor = expectedEvents.length > 0 ? randChoice(expectedEvents) : { timestamp: randFloat(0, 6) };
      // Near hits, borderline "ok" hits (lookahead territory) and extras.
      const mode = randInt(0, 3);
      const offset = mode === 0 ? randFloat(-0.04, 0.04)
        : mode === 1 ? randChoice([-1, 1]) * randFloat(0.04, 0.12)
        : mode === 2 ? randChoice([-1, 1]) * randFloat(0.1, 0.4)
        : randFloat(-1, 6);
      const onset = { timestamp: anchor.timestamp + offset, energy: randFloat(0.01, 1.5) };
      if (randBool(0.2)) onset.surface = randChoice(SURFACES);
      if (randBool(0.15)) onset.midiNote = randInt(36, 90);
      if (randBool(0.1)) onset.frequency = randFloat(80, 1000);
      detectedOnsets.push(onset);
    }
    // Duplicate an onset timestamp sometimes (equidistant tie-breaking).
    if (detectedOnsets.length >= 2 && randBool(0.2)) {
      detectedOnsets[1].timestamp = detectedOnsets[0].timestamp;
    }

    push(`prop-${i}`, {
      expectedEvents: shuffledExpected,
      detectedOnsets: shuffle(detectedOnsets),
      difficulty: randChoice(DIFFICULTIES),
      calibrationOffsetSec: randChoice([0, 0, randFloat(-0.1, 0.1)]),
      widenMs: randChoice([0, 0, 15, randFloat(0, 50)]),
    });
  }

  return writeFixture('greedy_match.json', { cases });
}

// ---------------------------------------------------------------------------
// 4. matchOnsetToExpected
// ---------------------------------------------------------------------------

function genMatchOnsetToExpected() {
  const cases = [];

  const push = (name, input) => {
    const matchedIndices = new Set(input.matchedIndices);
    const before = new Set(matchedIndices);
    const matched = lib.matchOnsetToExpected(
      input.onsetTimestamp,
      input.expectedEvents,
      matchedIndices,
      input.difficulty,
      input.calibrationOffsetSec,
      input.widenMs
    );
    if (matchedIndices.size !== before.size) throw new Error('matchOnsetToExpected mutated the set');
    cases.push({ name, input, output: { matchedEventIndex: matched ? matched.eventIndex : null } });
  };

  // vitest cases (chord-scoring.test.ts routing helper)
  const triad = [
    { eventIndex: 0, timestamp: 1.0, expectedPitch: 60, chordId: 'c0' },
    { eventIndex: 1, timestamp: 1.0, expectedPitch: 64, chordId: 'c0' },
    { eventIndex: 2, timestamp: 1.0, expectedPitch: 67, chordId: 'c0' },
  ];
  push('vitest: onset in window returns chord event', {
    onsetTimestamp: 1.0, expectedEvents: triad, matchedIndices: [],
    difficulty: 'beginner', calibrationOffsetSec: 0, widenMs: 0,
  });
  push('vitest: onset outside window returns null', {
    onsetTimestamp: 5.0, expectedEvents: triad, matchedIndices: [],
    difficulty: 'beginner', calibrationOffsetSec: 0, widenMs: 0,
  });

  for (let i = 0; i < 250; i++) {
    const expectedEvents = randomExpectedEvents({ pitched: randBool(0.5), chordGroups: randBool(0.5) });
    const anchor = randChoice(expectedEvents);
    push(`prop-${i}`, {
      onsetTimestamp: anchor.timestamp + (randBool(0.8) ? randFloat(-0.15, 0.15) : randFloat(0.3, 3)),
      expectedEvents,
      matchedIndices: expectedEvents.filter(() => randBool(0.3)).map((e) => e.eventIndex),
      difficulty: randChoice(DIFFICULTIES),
      calibrationOffsetSec: randChoice([0, randFloat(-0.08, 0.08)]),
      widenMs: randChoice([0, randFloat(0, 40)]),
    });
  }

  return writeFixture('match_onset_to_expected.json', { cases });
}

// ---------------------------------------------------------------------------
// 5. computeStats
// ---------------------------------------------------------------------------

function genComputeStats() {
  const cases = [];
  const GRADES = ['perfect', 'good', 'ok', 'miss'];

  const push = (name, input) => {
    cases.push({ name, input, output: lib.computeStats(input.results, input.extraHits, input.durationSeconds) });
  };

  // Named edge cases pinning the tri-state + arithmetic behavior.
  push('edge: empty results', { results: [], extraHits: 0, durationSeconds: 0 });
  push('edge: empty results with extra hits', { results: [], extraHits: 5, durationSeconds: 12.345 });
  push('edge: all pitchCorrect undefined → pitchAccuracy null', {
    results: [
      { eventIndex: 0, grade: 'perfect', offsetMs: 1.25, timing: 'on_time', onsetEnergy: 0.5 },
      { eventIndex: 1, grade: 'miss', offsetMs: null, timing: null, onsetEnergy: null },
    ],
    extraHits: 0,
    durationSeconds: 4,
  });
  push('edge: pitchCorrect null counts in denominator only', {
    results: [
      { eventIndex: 0, grade: 'perfect', offsetMs: 0, timing: 'on_time', onsetEnergy: 0.5, pitchCorrect: null },
      { eventIndex: 1, grade: 'perfect', offsetMs: 2, timing: 'on_time', onsetEnergy: 0.5, pitchCorrect: true },
      { eventIndex: 2, grade: 'good', offsetMs: -60, timing: 'early', onsetEnergy: 0.5, pitchCorrect: false },
      { eventIndex: 3, grade: 'ok', offsetMs: 90, timing: 'late', onsetEnergy: 0.5 }, // undefined → excluded
    ],
    extraHits: 0,
    durationSeconds: 8,
  });
  push('edge: miss with non-null offset still averaged', {
    results: [
      { eventIndex: 0, grade: 'miss', offsetMs: 100, timing: 'late', onsetEnergy: 0.2 },
      { eventIndex: 1, grade: 'perfect', offsetMs: -3, timing: 'on_time', onsetEnergy: 0.9 },
    ],
    extraHits: 0,
    durationSeconds: 2,
  });
  {
    // Long perfect run → combo multiplier ramps to the 4x cap; 45 events (> 30 cap point).
    const results = [];
    for (let i = 0; i < 45; i++) {
      results.push({ eventIndex: i, grade: 'perfect', offsetMs: randFloat(-20, 20), timing: 'on_time', onsetEnergy: 1 });
    }
    push('edge: 45 perfect combo cap', { results, extraHits: 0, durationSeconds: 30 });
  }
  push('edge: heavy extra-hit penalty floors at 0', {
    results: [{ eventIndex: 0, grade: 'ok', offsetMs: 80, timing: 'late', onsetEnergy: 0.4 }],
    extraHits: 40,
    durationSeconds: 3,
  });

  for (let i = 0; i < 500; i++) {
    const count = randInt(0, 30);
    const results = [];
    for (let r = 0; r < count; r++) {
      const grade = randChoice(GRADES);
      const isMiss = grade === 'miss';
      const res = {
        eventIndex: r,
        grade,
        offsetMs: isMiss
          ? (randBool(0.9) ? null : Math.round(randFloat(-120, 120) * 100) / 100)
          : Math.round(randFloat(-110, 110) * 100) / 100,
        timing: isMiss ? null : randChoice(['early', 'on_time', 'late']),
        onsetEnergy: isMiss ? null : randFloat(0.01, 1.5),
      };
      const pitchMode = randInt(0, 3); // 0: undefined, 1: null, 2: true, 3: false
      if (pitchMode === 1) res.pitchCorrect = null;
      else if (pitchMode === 2) res.pitchCorrect = true;
      else if (pitchMode === 3) res.pitchCorrect = false;
      if (randBool(0.3)) res.pitchCents = randInt(-50, 50);
      if (randBool(0.2)) res.surfaceCorrect = randBool(0.7);
      results.push(res);
    }
    push(`prop-${i}`, {
      results,
      extraHits: randChoice([0, 0, 0, randInt(1, 12)]),
      durationSeconds: randFloat(1, 120),
    });
  }

  return writeFixture('compute_stats.json', { cases });
}

// ---------------------------------------------------------------------------
// 6. exercise-utils
// ---------------------------------------------------------------------------

function fullExerciseEvent(partial) {
  return {
    beat: 1,
    measure: 1,
    instrument: 'conga',
    technique: 'open',
    hand: 'R',
    duration: 1,
    vexKey: 'g/5',
    accent: false,
    ...partial,
  };
}

function randomExerciseDefinition(idx) {
  const timeSignature = randChoice([[4, 4], [3, 4], [6, 8], [2, 4], [5, 4], [12, 8]]);
  const measures = randInt(1, 3);
  const instrument = randChoice(ALL_INSTRUMENTS);
  const pitched = lib.getInstrumentCategory(instrument) === 'pitched';
  const events = [];
  let chordCounter = 0;
  for (let m = 1; m <= measures; m++) {
    const eventCount = randInt(1, 6);
    for (let e = 0; e < eventCount; e++) {
      const beat = 1 + randChoice([0, 0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 3.5]);
      const chordId = pitched && randBool(0.25) ? `c${chordCounter++}` : undefined;
      const noteCount = chordId ? randInt(2, 3) : 1;
      for (let n = 0; n < noteCount; n++) {
        events.push(fullExerciseEvent({
          beat,
          measure: m,
          instrument,
          technique: randChoice(TECHNIQUES),
          hand: randChoice(['R', 'L']),
          duration: randChoice([0.25, 0.5, 1, 2]),
          vexKey: 'c/4',
          accent: randBool(0.2),
          expectedPitch: pitched ? randInt(40, 84) : undefined,
          expectedNoteName: pitched ? 'C4' : undefined,
          surface: !pitched && randBool(0.7) ? randChoice(SURFACES) : undefined,
          chordId,
        }));
      }
    }
  }
  return {
    id: `ex-${idx}`,
    title: `Property exercise ${idx}`,
    description: '',
    instrument,
    bpm: randChoice([randInt(40, 220), randFloat(50, 200)]),
    timeSignature,
    swing: randChoice([0, 0, 0, 33, 50, 66.7, 100, randFloat(0, 100)]),
    difficulty: randChoice(DIFFICULTIES),
    measures,
    loopCount: randInt(1, 4),
    events,
  };
}

function genExerciseUtils() {
  const beatToTimestamp = [];
  for (let i = 0; i < 300; i++) {
    const input = {
      event: fullExerciseEvent({
        beat: randChoice([1, 1.25, 1.5, 2, 2.5, 2.505, 2.51, 3, 3.75, 4.5, randFloat(1, 8), 0.5]),
        measure: randInt(1, 8),
      }),
      bpm: randChoice([randInt(40, 220), randFloat(45, 210)]),
      timeSignature: randChoice([[4, 4], [3, 4], [6, 8], [2, 4], [12, 8]]),
      loopIndex: randInt(0, 3),
      totalMeasures: randInt(0, 8),
      swing: randChoice([0, 0, 33, 50, 67, 100, randFloat(0, 100)]),
    };
    beatToTimestamp.push({
      name: `prop-${i}`,
      input,
      output: lib.beatToTimestamp(
        input.event, input.bpm, input.timeSignature, input.loopIndex, input.totalMeasures, input.swing
      ),
    });
  }

  const generateExpectedTimestamps = [];
  for (let i = 0; i < 120; i++) {
    const exercise = randomExerciseDefinition(i);
    generateExpectedTimestamps.push({
      name: `prop-${i}`,
      input: exercise,
      output: lib.generateExpectedTimestamps(exercise),
    });
  }

  const getExerciseDuration = generateExpectedTimestamps.map((c, i) => ({
    name: `prop-${i}`,
    input: c.input,
    output: lib.getExerciseDuration(c.input),
  }));

  const getCountInDuration = [];
  for (const bpm of [40, 60, 90.5, 100, 120, 178.3, 220]) {
    for (const beats of [1, 2, 3, 4, 6, 8]) {
      getCountInDuration.push({ name: `bpm${bpm}-beats${beats}`, input: { bpm, countInBeats: beats }, output: lib.getCountInDuration(bpm, beats) });
    }
  }

  const getLetterGrade = [];
  for (let s = 0; s <= 200; s++) {
    const score = s / 2; // 0, 0.5 … 100
    getLetterGrade.push({ name: `score-${score}`, input: score, output: lib.getLetterGrade(score) });
  }
  for (const score of [59.999, 69.999, 74.999, 79.999, 84.999, 89.999, 94.999, 95.0001, 100.5, -3]) {
    getLetterGrade.push({ name: `edge-${score}`, input: score, output: lib.getLetterGrade(score) });
  }

  const beatDurationToVexDuration = [];
  for (const d of [4, 4.5, 2, 3, 1, 1.5, 0.5, 0.75, 0.25, 0.375, 0.125, 0.1, 0.0625, 8]) {
    beatDurationToVexDuration.push({ name: `dur-${d}`, input: d, output: lib.beatDurationToVexDuration(d) });
  }

  const frequencyToMidi = [];
  for (const f of [440, 441, 220, 110, 27.5, 4186, 261.626, 466.16, 445, 435, 452.9, 100, 80.5, 1000]) {
    frequencyToMidi.push({ name: `freq-${f}`, input: f, output: lib.frequencyToMidi(f) });
  }
  for (let i = 0; i < 60; i++) {
    const f = randFloat(30, 4000);
    frequencyToMidi.push({ name: `prop-${i}`, input: f, output: lib.frequencyToMidi(f) });
  }

  const midiToNoteName = [];
  for (let midi = 0; midi <= 127; midi++) {
    midiToNoteName.push({ name: `midi-${midi}`, input: midi, output: lib.midiToNoteName(midi) });
  }
  for (const midi of [-1, -12, -13, 128, 140]) {
    midiToNoteName.push({ name: `edge-${midi}`, input: midi, output: lib.midiToNoteName(midi) });
  }

  // Math.round golden vectors — the jsRound trap (half toward +∞, unlike Swift's rounded()).
  const jsRound = [];
  const roundInputs = [-2.5, -1.5, -0.5, -0.49999999999999994, 0.49999999999999994, 0.5, 1.5, 2.5,
    -100.5, 100.5, 33.335, -33.335, 0.005, -0.005, 1e15 + 0.5, -(1e15 + 0.5), 0, -0];
  for (let i = 0; i < 100; i++) roundInputs.push(randFloat(-500, 500));
  for (const x of roundInputs) {
    jsRound.push({ input: x, output: Math.round(x) });
  }

  return writeFixture('exercise_utils.json', {
    beatToTimestamp,
    generateExpectedTimestamps,
    getExerciseDuration,
    getCountInDuration,
    getLetterGrade,
    beatDurationToVexDuration,
    frequencyToMidi,
    midiToNoteName,
    jsRound,
  });
}

// ---------------------------------------------------------------------------
// 7. scoreToExerciseDefinition
// ---------------------------------------------------------------------------

function genScoreToExercise() {
  const cases = [];

  const push = (name, score, options) => {
    const output = lib.scoreToExerciseDefinition(score, options);
    cases.push({
      name,
      input: { score, options },
      output,
      // Chained pipeline check: expected timestamps derived from the produced definition.
      expectedTimestamps: lib.generateExpectedTimestamps(output),
    });
  };

  // vitest cases (score-to-exercise.test.ts)
  push('vitest: guitar lick default', lib.GUITAR_LICK_FIXTURE, { audioUrl: 'v.mp4' });
  push('vitest: conga tumbao default', lib.CONGA_TUMBAO_FIXTURE, {});
  push('vitest: son montuno track 1 bass', lib.SON_MONTUNO_FIXTURE, { trackIndex: 1 });
  push('vitest: son montuno default tres chords', lib.SON_MONTUNO_FIXTURE, {});

  // Option variations on the handwritten fixtures.
  push('options: full overrides', lib.GUITAR_LICK_FIXTURE, {
    trackIndex: 0, difficulty: 'advanced', audioUrl: 'a.mp3', id: 'custom-id', title: 'T', description: 'D',
  });
  push('options: out-of-range trackIndex falls back to track 0', lib.SON_MONTUNO_FIXTURE, { trackIndex: 99 });
  push('options: conga difficulty beginner', lib.CONGA_TUMBAO_FIXTURE, { difficulty: 'beginner' });
  push('edge: empty tracks', { ...lib.GUITAR_LICK_FIXTURE, tracks: [] }, { audioUrl: 'x.mp4' });

  // Full production corpus totality: every track of every corpus doc.
  const corpus = JSON.parse(fs.readFileSync(
    path.join(REPO, 'ios/Packages/LMMKit/Tests/ScoreModelTests/Fixtures/score_documents_corpus.json'),
    'utf8'
  ));
  corpus.forEach((row, docIdx) => {
    const score = row.parsed_score;
    score.tracks.forEach((_, trackIdx) => {
      push(`corpus-${docIdx}-track-${trackIdx} (${row.title})`, score, { trackIndex: trackIdx });
    });
  });

  return writeFixture('score_to_exercise.json', { cases });
}

// ---------------------------------------------------------------------------
// 8. onset-config + playsense-mappings + instrument category
// ---------------------------------------------------------------------------

function genOnsetConfig() {
  const getInstrumentConfig = [];
  for (const instrument of ALL_INSTRUMENTS) {
    for (const noisyRoom of [false, true]) {
      for (const speakerSafe of [false, true]) {
        getInstrumentConfig.push({
          name: `${instrument}-noisy${noisyRoom}-safe${speakerSafe}`,
          input: { instrument, noisyRoom, speakerSafe },
          output: lib.getInstrumentConfig(instrument, noisyRoom, speakerSafe),
        });
      }
    }
  }

  const instrumentNeedsPitchDetection = ALL_INSTRUMENTS.map((instrument) => ({
    input: instrument,
    output: lib.instrumentNeedsPitchDetection(instrument),
  }));

  const getInstrumentCategory = ALL_INSTRUMENTS.map((instrument) => ({
    input: instrument,
    output: lib.getInstrumentCategory(instrument),
  }));

  const getInstrumentLabel = [...ALL_INSTRUMENTS, 'unknown-thing'].map((instrument) => ({
    input: instrument,
    output: lib.getInstrumentLabel(instrument),
  }));

  const getPlaySenseMapping = ['conga', 'congas', 'timbale', 'timbales', 'guitar', 'bongo', ''].map((key) => ({
    input: key,
    output: lib.getPlaySenseMapping(key),
  }));

  return writeFixture('onset_config.json', {
    getInstrumentConfig,
    instrumentNeedsPitchDetection,
    getInstrumentCategory,
    getInstrumentLabel,
    getPlaySenseMapping,
  });
}

// ---------------------------------------------------------------------------

let total = 0;
total += genGradeSingleOnset();
total += genGradeChordOnset();
total += genGreedyMatch();
total += genMatchOnsetToExpected();
total += genComputeStats();
total += genExerciseUtils();
total += genScoreToExercise();
total += genOnsetConfig();
console.log(`TOTAL: ${total} fixture cases (seed ${SEED})`);
