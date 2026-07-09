// ../../../../../../../Users/charlieramirez/Desktop/latinmusicmastery/lib/play-sense/types.ts
function getInstrumentCategory(instrument) {
  const percussion = ["conga", "timbale", "bongo", "clave", "cowbell", "guiro"];
  return percussion.includes(instrument) ? "percussion" : "pitched";
}
var TOLERANCE_BY_DIFFICULTY = {
  beginner: { perfect: 40, good: 70, ok: 110 },
  intermediate: { perfect: 30, good: 55, ok: 85 },
  advanced: { perfect: 20, good: 40, ok: 65 }
};
var PITCH_TOLERANCE_CENTS = {
  beginner: 80,
  intermediate: 55,
  advanced: 35
};
var PITCH_OCTAVE_AGNOSTIC = {
  beginner: true,
  intermediate: true,
  advanced: false
};
var CHORD_PRESENCE_RATIO = {
  beginner: 0.66,
  intermediate: 0.8,
  advanced: 1
};
var CHROMA_PRESENCE_THRESHOLD = 0.35;
var GRADE_POINTS = {
  perfect: 100,
  good: 70,
  ok: 40,
  miss: 0
};
var GRADE_COLORS = {
  perfect: "#22c55e",
  good: "#eab308",
  ok: "#f97316",
  miss: "#ef4444"
};

// ../../../../../../../Users/charlieramirez/Desktop/latinmusicmastery/lib/play-sense/scoring.ts
function downgradeGrade(grade) {
  switch (grade) {
    case "perfect":
      return "good";
    case "good":
      return "ok";
    case "ok":
      return "miss";
    default:
      return "miss";
  }
}
function greedyMatch(expectedEvents, detectedOnsets, difficulty, calibrationOffsetSec = 0, widenMs = 0) {
  const tolerance = TOLERANCE_BY_DIFFICULTY[difficulty];
  const effectiveTolerance = {
    perfect: tolerance.perfect + widenMs,
    good: tolerance.good + widenMs,
    ok: tolerance.ok + widenMs
  };
  const sorted = [...expectedEvents].sort((a, b) => a.timestamp - b.timestamp);
  const onsets = [...detectedOnsets].map((o) => ({
    ...o,
    timestamp: o.timestamp - calibrationOffsetSec
  })).sort((a, b) => a.timestamp - b.timestamp);
  const matchedOnsets = /* @__PURE__ */ new Set();
  const results = [];
  for (let i = 0; i < sorted.length; i++) {
    const expected = sorted[i];
    const expectedMs = expected.timestamp * 1e3;
    let bestIdx = -1;
    let bestAbsOffset = Infinity;
    for (let j = 0; j < onsets.length; j++) {
      if (matchedOnsets.has(j)) continue;
      const onsetMs = onsets[j].timestamp * 1e3;
      const absOffset = Math.abs(onsetMs - expectedMs);
      if (absOffset > effectiveTolerance.ok) {
        if (onsetMs > expectedMs + effectiveTolerance.ok / 1e3 * 1e3) break;
        continue;
      }
      if (absOffset < bestAbsOffset) {
        bestAbsOffset = absOffset;
        bestIdx = j;
      }
    }
    if (bestIdx === -1) {
      results.push({
        eventIndex: expected.eventIndex,
        grade: "miss",
        offsetMs: null,
        timing: null,
        onsetEnergy: null
      });
      continue;
    }
    const offsetMs = onsets[bestIdx].timestamp * 1e3 - expectedMs;
    const grade = gradeHit(Math.abs(offsetMs), effectiveTolerance);
    if (grade === "ok" && i + 1 < sorted.length) {
      const nextExpectedMs = sorted[i + 1].timestamp * 1e3;
      const nextAbsOffset = Math.abs(onsets[bestIdx].timestamp * 1e3 - nextExpectedMs);
      if (nextAbsOffset < bestAbsOffset) {
        results.push({
          eventIndex: expected.eventIndex,
          grade: "miss",
          offsetMs: null,
          timing: null,
          onsetEnergy: null
        });
        continue;
      }
    }
    matchedOnsets.add(bestIdx);
    const timing = offsetMs < -5 ? "early" : offsetMs > 5 ? "late" : "on_time";
    results.push({
      eventIndex: expected.eventIndex,
      grade,
      offsetMs: Math.round(offsetMs * 100) / 100,
      timing,
      onsetEnergy: onsets[bestIdx].energy
    });
  }
  return results;
}
function gradeHit(absOffsetMs, tolerance) {
  if (absOffsetMs <= tolerance.perfect) return "perfect";
  if (absOffsetMs <= tolerance.good) return "good";
  if (absOffsetMs <= tolerance.ok) return "ok";
  return "miss";
}
function gradeSingleOnset(onsetTimestamp, onsetEnergy, expectedEvents, matchedIndices, difficulty, calibrationOffsetSec = 0, widenMs = 0, instrumentCategory = "percussion", detectedMidiNote, detectedFrequency, detectedSurface) {
  const tolerance = TOLERANCE_BY_DIFFICULTY[difficulty];
  const effectiveTolerance = {
    perfect: tolerance.perfect + widenMs,
    good: tolerance.good + widenMs,
    ok: tolerance.ok + widenMs
  };
  const correctedTimestamp = onsetTimestamp - calibrationOffsetSec;
  const correctedMs = correctedTimestamp * 1e3;
  let bestIdx = -1;
  let bestAbsOffset = Infinity;
  for (let i = 0; i < expectedEvents.length; i++) {
    if (matchedIndices.has(expectedEvents[i].eventIndex)) continue;
    const expectedMs2 = expectedEvents[i].timestamp * 1e3;
    const absOffset = Math.abs(correctedMs - expectedMs2);
    if (absOffset <= effectiveTolerance.ok && absOffset < bestAbsOffset) {
      bestAbsOffset = absOffset;
      bestIdx = i;
    }
  }
  if (bestIdx === -1) return null;
  const matched = expectedEvents[bestIdx];
  const expectedMs = matched.timestamp * 1e3;
  const offsetMs = correctedMs - expectedMs;
  let grade = gradeHit(Math.abs(offsetMs), effectiveTolerance);
  const timing = offsetMs < -5 ? "early" : offsetMs > 5 ? "late" : "on_time";
  let pitchCorrect = null;
  let pitchCents = null;
  if (instrumentCategory === "pitched" && matched.expectedPitch != null) {
    const toleranceCents = PITCH_TOLERANCE_CENTS[difficulty];
    const octaveAgnostic = PITCH_OCTAVE_AGNOSTIC[difficulty];
    if (detectedFrequency != null) {
      const expectedFreq = 440 * Math.pow(2, (matched.expectedPitch - 69) / 12);
      const rawCents = 1200 * Math.log2(detectedFrequency / expectedFreq);
      const semitoneCents = rawCents - 100 * Math.round(rawCents / 100);
      pitchCents = Math.max(-50, Math.min(50, Math.round(semitoneCents)));
      const trueCents = octaveAgnostic ? rawCents - 1200 * Math.round(rawCents / 1200) : rawCents;
      pitchCorrect = Math.abs(trueCents) <= toleranceCents;
    } else if (detectedMidiNote != null) {
      pitchCorrect = octaveAgnostic ? detectedMidiNote % 12 === matched.expectedPitch % 12 : detectedMidiNote === matched.expectedPitch;
    } else {
      pitchCorrect = false;
      grade = "miss";
    }
    if (pitchCorrect === false && (detectedFrequency != null || detectedMidiNote != null)) {
      grade = downgradeGrade(grade);
    }
  }
  let techniqueCorrect = null;
  if (instrumentCategory === "percussion" && matched.expectedTechnique) {
    techniqueCorrect = null;
  }
  let surfaceCorrect = null;
  let detectedSurfaceResult = detectedSurface ?? null;
  if (matched.expectedSurface && detectedSurface != null) {
    surfaceCorrect = detectedSurface === matched.expectedSurface;
    if (!surfaceCorrect) {
      grade = "miss";
    }
  }
  matchedIndices.add(matched.eventIndex);
  return {
    eventIndex: matched.eventIndex,
    grade,
    offsetMs: Math.round(offsetMs * 100) / 100,
    timing,
    onsetEnergy,
    detectedPitch: detectedFrequency ?? null,
    pitchCorrect,
    pitchCents,
    techniqueCorrect,
    surfaceCorrect,
    detectedSurface: detectedSurfaceResult
  };
}
function matchOnsetToExpected(onsetTimestamp, expectedEvents, matchedIndices, difficulty, calibrationOffsetSec = 0, widenMs = 0) {
  const tolerance = TOLERANCE_BY_DIFFICULTY[difficulty];
  const okWindow = tolerance.ok + widenMs;
  const correctedMs = (onsetTimestamp - calibrationOffsetSec) * 1e3;
  let best = null;
  let bestAbsOffset = Infinity;
  for (const ev of expectedEvents) {
    if (matchedIndices.has(ev.eventIndex)) continue;
    const absOffset = Math.abs(correctedMs - ev.timestamp * 1e3);
    if (absOffset <= okWindow && absOffset < bestAbsOffset) {
      bestAbsOffset = absOffset;
      best = ev;
    }
  }
  return best;
}
function gradeChordOnset(onsetTimestamp, onsetEnergy, expectedEvents, matchedIndices, chordId, difficulty, calibrationOffsetSec = 0, widenMs = 0, chroma) {
  const group = expectedEvents.filter((e) => e.chordId === chordId);
  if (group.length === 0) return [];
  const tolerance = TOLERANCE_BY_DIFFICULTY[difficulty];
  const effectiveTolerance = {
    perfect: tolerance.perfect + widenMs,
    good: tolerance.good + widenMs,
    ok: tolerance.ok + widenMs
  };
  const expectedMs = group[0].timestamp * 1e3;
  const correctedMs = (onsetTimestamp - calibrationOffsetSec) * 1e3;
  const offsetMs = correctedMs - expectedMs;
  const timingGrade = gradeHit(Math.abs(offsetMs), effectiveTolerance);
  const timing = offsetMs < -5 ? "early" : offsetMs > 5 ? "late" : "on_time";
  const pitchClasses = Array.from(
    new Set(
      group.map((e) => e.expectedPitch).filter((p) => p != null).map((p) => (p % 12 + 12) % 12)
    )
  );
  const present = /* @__PURE__ */ new Set();
  if (chroma && chroma.length === 12) {
    const max = Math.max(...chroma);
    const floor = max > 0 ? max * CHROMA_PRESENCE_THRESHOLD : Infinity;
    for (const pc of pitchClasses) {
      if (chroma[pc] >= floor) present.add(pc);
    }
  } else {
    pitchClasses.forEach((pc) => present.add(pc));
  }
  const ratio = pitchClasses.length > 0 ? present.size / pitchClasses.length : 1;
  const required = CHORD_PRESENCE_RATIO[difficulty];
  let chordGrade = timingGrade;
  if (ratio < required) {
    let levels;
    if (ratio >= 0.6) levels = 1;
    else if (ratio >= 0.4) levels = 2;
    else levels = 3;
    for (let i = 0; i < levels; i++) chordGrade = downgradeGrade(chordGrade);
  }
  return group.map((ev) => {
    const pc = ev.expectedPitch != null ? (ev.expectedPitch % 12 + 12) % 12 : null;
    const notePresent = pc != null ? present.has(pc) : null;
    matchedIndices.add(ev.eventIndex);
    return {
      eventIndex: ev.eventIndex,
      grade: chordGrade,
      offsetMs: Math.round(offsetMs * 100) / 100,
      timing,
      onsetEnergy,
      detectedPitch: null,
      pitchCorrect: notePresent,
      pitchCents: null,
      techniqueCorrect: null,
      surfaceCorrect: null,
      detectedSurface: null
    };
  });
}
function frequencyToMidi(freq) {
  return Math.round(69 + 12 * Math.log2(freq / 440));
}
function midiToNoteName(midi) {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const note2 = names[(midi % 12 + 12) % 12];
  const octave = Math.floor((midi - 12) / 12);
  return `${note2}${octave}`;
}
function computeStats(results, extraHits, durationSeconds) {
  const perfectCount = results.filter((r) => r.grade === "perfect").length;
  const goodCount = results.filter((r) => r.grade === "good").length;
  const okCount = results.filter((r) => r.grade === "ok").length;
  const missCount = results.filter((r) => r.grade === "miss").length;
  const totalEvents = results.length;
  const accuracy = totalEvents > 0 ? (perfectCount + goodCount) / totalEvents * 100 : 0;
  let combo = 0;
  let maxCombo = 0;
  let streak = 0;
  let maxStreak = 0;
  let totalScore = 0;
  for (const result of results) {
    if (result.grade !== "miss") {
      combo++;
      maxCombo = Math.max(maxCombo, combo);
      if (result.grade === "perfect") {
        streak++;
        maxStreak = Math.max(maxStreak, streak);
      } else {
        streak = 0;
      }
    } else {
      combo = 0;
      streak = 0;
    }
    const multiplier = Math.min(Math.floor(combo / 10) + 1, 4);
    totalScore += GRADE_POINTS[result.grade] * multiplier;
  }
  let maxPossibleScore = 0;
  for (let i = 0; i < totalEvents; i++) {
    const maxMultiplier = Math.min(Math.floor((i + 1) / 10) + 1, 4);
    maxPossibleScore += GRADE_POINTS.perfect * maxMultiplier;
  }
  let score = maxPossibleScore > 0 ? totalScore / maxPossibleScore * 100 : 0;
  if (extraHits > 0 && score > 0) {
    const penalty = extraHits * 2;
    score = Math.max(0, score - penalty);
  }
  const hitResults = results.filter((r) => r.offsetMs !== null);
  const avgOffsetMs = hitResults.length > 0 ? hitResults.reduce((sum, r) => sum + r.offsetMs, 0) / hitResults.length : 0;
  const driftWindow = hitResults.slice(-8);
  const tempoDriftMs = driftWindow.length > 0 ? driftWindow.reduce((sum, r) => sum + r.offsetMs, 0) / driftWindow.length : 0;
  const pitchedResults = results.filter((r) => r.pitchCorrect !== void 0);
  const pitchAccuracy = pitchedResults.length > 0 ? Math.round(
    pitchedResults.filter((r) => r.pitchCorrect === true).length / pitchedResults.length * 1e4
  ) / 100 : null;
  return {
    score: Math.round(score * 100) / 100,
    accuracy: Math.round(accuracy * 100) / 100,
    perfectCount,
    goodCount,
    okCount,
    missCount,
    extraHits,
    maxCombo,
    maxStreak,
    avgOffsetMs: Math.round(avgOffsetMs * 100) / 100,
    tempoDriftMs: Math.round(tempoDriftMs * 100) / 100,
    durationSeconds: Math.round(durationSeconds * 100) / 100,
    pitchAccuracy
  };
}

// ../../../../../../../Users/charlieramirez/Desktop/latinmusicmastery/lib/play-sense/exercise-utils.ts
function beatToTimestamp(event, bpm, timeSignature, loopIndex = 0, totalMeasures = 0, swing = 0) {
  const beatsPerMeasure = timeSignature[0];
  const beatDuration = 60 / bpm;
  const loopOffsetBeats = loopIndex * totalMeasures * beatsPerMeasure;
  const measureOffset = (event.measure - 1) * beatsPerMeasure;
  const beatOffset = event.beat - 1;
  let timestamp = (loopOffsetBeats + measureOffset + beatOffset) * beatDuration;
  if (swing > 0) {
    const fractionalBeat = (event.beat - 1) % 1;
    if (Math.abs(fractionalBeat - 0.5) < 0.01) {
      const swingRatio = swing / 100;
      const swingOffset = swingRatio * beatDuration * 0.5;
      timestamp += swingOffset;
    }
  }
  return timestamp;
}
function generateExpectedTimestamps(exercise) {
  const results = [];
  const beatDuration = 60 / exercise.bpm;
  for (let loop = 0; loop < exercise.loopCount; loop++) {
    for (let i = 0; i < exercise.events.length; i++) {
      const event = exercise.events[i];
      const timestamp = beatToTimestamp(
        event,
        exercise.bpm,
        exercise.timeSignature,
        loop,
        exercise.measures,
        exercise.swing
      );
      results.push({
        eventIndex: results.length,
        timestamp,
        expectedPitch: event.expectedPitch,
        expectedTechnique: event.technique,
        expectedDurationSec: event.duration * beatDuration,
        expectedSurface: event.surface,
        // Make the chord group id loop-unique so notes from different loop
        // iterations aren't grouped together.
        chordId: event.chordId != null ? `${loop}:${event.chordId}` : void 0
      });
    }
  }
  return results.sort((a, b) => a.timestamp - b.timestamp);
}
function getExerciseDuration(exercise) {
  const beatsPerMeasure = exercise.timeSignature[0];
  const totalBeats = exercise.measures * beatsPerMeasure * exercise.loopCount;
  return totalBeats * 60 / exercise.bpm;
}
function getCountInDuration(bpm, countInBeats = 4) {
  return countInBeats * 60 / bpm;
}
function beatDurationToVexDuration(duration) {
  if (duration >= 4) return "w";
  if (duration >= 2) return "h";
  if (duration >= 1) return "q";
  if (duration >= 0.5) return "8";
  if (duration >= 0.25) return "16";
  return "32";
}
function groupEventsByMeasure(events, measures) {
  const grouped = /* @__PURE__ */ new Map();
  for (let m = 1; m <= measures; m++) {
    grouped.set(m, []);
  }
  for (const event of events) {
    const measureEvents = grouped.get(event.measure);
    if (measureEvents) {
      measureEvents.push(event);
    }
  }
  for (const [, measureEvents] of grouped) {
    measureEvents.sort((a, b) => a.beat - b.beat);
  }
  return grouped;
}
function getLetterGrade(score) {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 85) return "B+";
  if (score >= 80) return "B";
  if (score >= 75) return "C+";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}
function getInstrumentLabel(instrument) {
  const labels = {
    conga: "Congas",
    timbale: "Timbales",
    bongo: "Bongos",
    clave: "Clave",
    cowbell: "Cowbell",
    guiro: "Guiro",
    guitar: "Guitar",
    bass: "Bass",
    piano: "Piano",
    tres: "Tres",
    cuatro: "Cuatro",
    trumpet: "Trumpet",
    saxophone: "Saxophone",
    flute: "Flute",
    violin: "Violin"
  };
  return labels[instrument] || instrument;
}
function getDifficultyColor(difficulty) {
  switch (difficulty) {
    case "beginner":
      return "text-green-500";
    case "intermediate":
      return "text-yellow-500";
    case "advanced":
      return "text-red-500";
    default:
      return "text-muted-foreground";
  }
}

// ../../../../../../../Users/charlieramirez/Desktop/latinmusicmastery/lib/playsense-studio/time-mapping.ts
function measureLengthInQN(timeSignature) {
  const [numerator, denominator] = timeSignature;
  return numerator * 4 / denominator;
}
function beatLengthInQN(timeSignature) {
  const [, denominator] = timeSignature;
  return 4 / denominator;
}
var QN_EPS = 1e-7;
function effectiveDurationQN(baseDurationQN, modifiers) {
  let qn = baseDurationQN;
  if (modifiers?.dotted) qn *= 1.5;
  if (modifiers?.triplet) qn *= 2 / 3;
  return qn;
}
function occupiedQN(events) {
  return events.reduce((sum, e) => sum + e.durationQN, 0);
}
function isFillerRest(events, timeSignature) {
  return events.length === 1 && events[0].kind === "rest" && Math.abs(events[0].durationQN - measureLengthInQN(timeSignature)) < QN_EPS;
}
function qnToMs(qn, tempo) {
  return qn * 6e4 / tempo;
}
function* walkMeasures(track, score) {
  let cumulativeQN = 0;
  let cumulativeMs = 0;
  let timeSignature = score.initialTimeSignature;
  let tempo = score.initialTempo;
  for (const measure2 of track.measures) {
    if (measure2.timeSignature) timeSignature = measure2.timeSignature;
    if (measure2.tempoChange !== void 0) tempo = measure2.tempoChange;
    yield {
      measure: measure2,
      state: { cumulativeQN, cumulativeMs, timeSignature, tempo }
    };
    const measureQN = measureLengthInQN(timeSignature);
    cumulativeQN += measureQN;
    cumulativeMs += qnToMs(measureQN, tempo);
  }
}
function trackDurationMs(track, score) {
  let cumulativeMs = 0;
  for (const { state, measure: _measure } of walkMeasures(track, score)) {
    const { tempo, timeSignature } = state;
    cumulativeMs = state.cumulativeMs + qnToMs(measureLengthInQN(timeSignature), tempo);
  }
  return cumulativeMs;
}
function trackDurationQN(track, score) {
  let cumulativeQN = 0;
  for (const { state } of walkMeasures(track, score)) {
    cumulativeQN = state.cumulativeQN + measureLengthInQN(state.timeSignature);
  }
  return cumulativeQN;
}
function measureBeatToQN(track, score, measureNumber, beatInMeasure) {
  for (const { measure: measure2, state } of walkMeasures(track, score)) {
    if (measure2.number === measureNumber) {
      const beatsFromDownbeat = beatInMeasure - 1;
      return state.cumulativeQN + beatsFromDownbeat * beatLengthInQN(state.timeSignature);
    }
  }
  return null;
}
function measureBeatToMs(track, score, measureNumber, beatInMeasure) {
  for (const { measure: measure2, state } of walkMeasures(track, score)) {
    if (measure2.number === measureNumber) {
      const beatsFromDownbeat = beatInMeasure - 1;
      const qnIntoMeasure = beatsFromDownbeat * beatLengthInQN(state.timeSignature);
      return state.cumulativeMs + qnToMs(qnIntoMeasure, state.tempo);
    }
  }
  return null;
}
function qnToTrackMs(track, score, qn) {
  if (qn < 0) return -qnToMs(-qn, score.initialTempo);
  let lastTempo = score.initialTempo;
  let lastTimeSig = score.initialTimeSignature;
  let lastCumulativeQN = 0;
  let lastCumulativeMs = 0;
  for (const { state } of walkMeasures(track, score)) {
    const { cumulativeQN, cumulativeMs, timeSignature, tempo } = state;
    const measureQN = measureLengthInQN(timeSignature);
    const measureEndQN = cumulativeQN + measureQN;
    if (qn <= measureEndQN) {
      const qnIntoMeasure = qn - cumulativeQN;
      return cumulativeMs + qnToMs(qnIntoMeasure, tempo);
    }
    lastTempo = tempo;
    lastTimeSig = timeSignature;
    lastCumulativeQN = measureEndQN;
    lastCumulativeMs = cumulativeMs + qnToMs(measureQN, tempo);
  }
  void lastTimeSig;
  return lastCumulativeMs + qnToMs(qn - lastCumulativeQN, lastTempo);
}

// ../../../../../../../Users/charlieramirez/Desktop/latinmusicmastery/lib/playsense-studio/perc-strokes.ts
var PERC_STROKES = {
  "perc-conga": [
    { id: "open-high", label: "Open High", midi: 64, staffLine: "g/5" },
    { id: "slap", label: "Slap", midi: 62, staffLine: "g/5", noteType: "x" },
    { id: "open-low", label: "Open Low", midi: 63, staffLine: "e/5" },
    { id: "mute", label: "Mute", midi: 61, staffLine: "d/5", noteType: "x" },
    { id: "bass", label: "Bass", midi: 60, staffLine: "c/5" }
  ],
  "perc-bongo": [
    { id: "macho-open", label: "Macho Open", midi: 64, staffLine: "g/5" },
    { id: "macho-slap", label: "Macho Slap", midi: 63, staffLine: "g/5", noteType: "x" },
    { id: "hembra-open", label: "Hembra Open", midi: 62, staffLine: "e/5" },
    { id: "hembra-slap", label: "Hembra Slap", midi: 61, staffLine: "e/5", noteType: "x" }
  ],
  "perc-timbal": [
    { id: "cascara", label: "C\xE1scara", midi: 65, staffLine: "a/5", noteType: "x" },
    { id: "high", label: "High Drum", midi: 64, staffLine: "g/5" },
    { id: "low", label: "Low Drum", midi: 62, staffLine: "e/5" },
    { id: "rim", label: "Rim/Clave", midi: 61, staffLine: "c/5", noteType: "x" }
  ],
  "perc-clave": [
    { id: "stroke", label: "Clave", midi: 60, staffLine: "b/4", noteType: "x" }
  ],
  "perc-kit": [
    { id: "crash", label: "Crash", midi: 49, staffLine: "a/5", noteType: "x" },
    { id: "ride", label: "Ride", midi: 51, staffLine: "f/5", noteType: "x" },
    { id: "hh-closed", label: "HH Closed", midi: 42, staffLine: "g/5", noteType: "x" },
    { id: "hh-open", label: "HH Open", midi: 46, staffLine: "g/5", noteType: "x" },
    { id: "hi-tom", label: "Hi Tom", midi: 48, staffLine: "e/5" },
    { id: "mid-tom", label: "Mid Tom", midi: 45, staffLine: "d/5" },
    { id: "snare", label: "Snare", midi: 38, staffLine: "c/5" },
    { id: "floor-tom", label: "Floor Tom", midi: 41, staffLine: "a/4" },
    { id: "kick", label: "Kick", midi: 36, staffLine: "f/4" }
  ]
};
function isPercussion(instrument) {
  return instrument.startsWith("perc-");
}
function getPercStrokes(instrument) {
  return PERC_STROKES[instrument] ?? null;
}
function midiToPercStroke(instrument, midi) {
  const strokes = PERC_STROKES[instrument];
  if (!strokes) return void 0;
  return strokes.find((s) => s.midi === midi);
}

// ../../../../../../../Users/charlieramirez/Desktop/latinmusicmastery/lib/playsense-studio/score-to-vexflow.ts
function vexflowDurationCode(durationQN, dotted) {
  const base = dotted ? durationQN * 2 / 3 : durationQN;
  const eps = 1e-7;
  if (Math.abs(base - 4) < eps) return "w";
  if (Math.abs(base - 2) < eps) return "h";
  if (Math.abs(base - 1) < eps) return "q";
  if (Math.abs(base - 0.5) < eps) return "8";
  if (Math.abs(base - 0.25) < eps) return "16";
  if (Math.abs(base - 0.125) < eps) return "32";
  if (Math.abs(base - 0.0625) < eps) return "64";
  if (Math.abs(base - 0.03125) < eps) return "128";
  const power = Math.round(Math.log2(base));
  if (power >= 2) return "w";
  if (power === 1) return "h";
  if (power === 0) return "q";
  if (power === -1) return "8";
  if (power === -2) return "16";
  if (power === -3) return "32";
  if (power === -4) return "64";
  return "128";
}
var SHARP_NAMES = {
  0: "c",
  1: "c#",
  2: "d",
  3: "d#",
  4: "e",
  5: "f",
  6: "f#",
  7: "g",
  8: "g#",
  9: "a",
  10: "a#",
  11: "b"
};
var FLAT_NAMES = {
  0: "c",
  1: "db",
  2: "d",
  3: "eb",
  4: "e",
  5: "f",
  6: "gb",
  7: "g",
  8: "ab",
  9: "a",
  10: "bb",
  11: "b"
};
function midiToKeyString(midi, options = {}) {
  const { spellingHint, keyFifths = 0 } = options;
  if (spellingHint) {
    const match = spellingHint.match(/^([A-Ga-g])([#b])?(\d?)$/);
    if (match) {
      const letter = match[1].toLowerCase();
      const accidental = match[2] ?? "";
      const octave2 = match[3] ? Number(match[3]) : Math.floor(midi / 12) - 1;
      return `${letter}${accidental}/${octave2}`;
    }
  }
  const pitchClass = (midi % 12 + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const table = keyFifths < 0 ? FLAT_NAMES : SHARP_NAMES;
  return `${table[pitchClass]}/${octave}`;
}
function extractAccidental(keyString) {
  if (keyString.includes("#")) return "#";
  if (keyString.includes("b")) return "b";
  return null;
}
var PC_TO_LETTER_INDEX = {
  0: 0,
  // C
  1: 0,
  // C#
  2: 1,
  // D
  3: 1,
  // D#
  4: 2,
  // E
  5: 3,
  // F
  6: 3,
  // F#
  7: 4,
  // G
  8: 4,
  // G#
  9: 5,
  // A
  10: 5,
  // A#
  11: 6
  // B
};
var LETTER_INDEX_TO_PC = [0, 2, 4, 5, 7, 9, 11];
function midiToDiatonic(midi) {
  const pc = (midi % 12 + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return octave * 7 + PC_TO_LETTER_INDEX[pc];
}
function diatonicToMidi(diatonicIndex, accidental = 0, _keyFifths = 0) {
  const octave = Math.floor(diatonicIndex / 7);
  const letterIndex = (diatonicIndex % 7 + 7) % 7;
  const basePc = LETTER_INDEX_TO_PC[letterIndex];
  const midi = (octave + 1) * 12 + basePc + accidental;
  return Math.max(0, Math.min(127, midi));
}
function extractTrackEvents(track, initialTimeSignature, keyFifths = 0) {
  const result = [];
  const percussion = isPercussion(track.instrument);
  const clef = percussion ? "percussion" : "treble";
  let cumulativeQN = 0;
  let currentTimeSig = initialTimeSignature;
  for (const measure2 of track.measures) {
    if (measure2.timeSignature) currentTimeSig = measure2.timeSignature;
    const measureStartQN = cumulativeQN;
    const beatQN = beatLengthInQN(currentTimeSig);
    const voice = measure2.voices[0];
    const events = [];
    let qnInMeasure = 0;
    for (const event of voice.events) {
      const beatInMeasure = qnInMeasure / beatQN + 1;
      const dotted = event.dotted ?? false;
      const durationCode = vexflowDurationCode(event.durationQN, dotted);
      const isRest = event.kind === "rest";
      let keys;
      let accidentals;
      let midi = null;
      let noteType;
      if (event.kind === "note") {
        midi = event.midi;
        if (percussion) {
          const stroke = midiToPercStroke(track.instrument, event.midi);
          keys = [stroke?.staffLine ?? "c/5"];
          accidentals = [null];
          noteType = stroke?.noteType;
        } else {
          const k = midiToKeyString(event.midi, {
            spellingHint: event.spellingHint,
            keyFifths
          });
          keys = [k];
          accidentals = [extractAccidental(k)];
        }
      } else if (event.kind === "chord") {
        midi = event.notes[0]?.midi ?? null;
        if (percussion) {
          keys = event.notes.map(
            (n) => midiToPercStroke(track.instrument, n.midi)?.staffLine ?? "c/5"
          );
          accidentals = keys.map(() => null);
          noteType = midiToPercStroke(track.instrument, event.notes[0]?.midi ?? 0)?.noteType;
        } else {
          keys = event.notes.map(
            (n) => midiToKeyString(n.midi, { spellingHint: n.spellingHint, keyFifths })
          );
          accidentals = keys.map((k) => extractAccidental(k));
        }
      } else {
        keys = ["b/4"];
        accidentals = [null];
      }
      events.push({
        kind: event.kind,
        qnStart: measureStartQN + qnInMeasure,
        durationQN: event.durationQN,
        beatInMeasure,
        keys,
        accidentals,
        durationCode,
        isRest,
        dotted,
        midi,
        noteType,
        triplet: event.triplet ?? false,
        tieToNext: event.tieToNext ?? false,
        articulation: event.kind === "rest" ? void 0 : event.articulation
      });
      qnInMeasure += event.durationQN;
    }
    result.push({
      measure: measure2,
      events,
      cumulativeQN: measureStartQN,
      timeSignature: currentTimeSig,
      clef
    });
    cumulativeQN += measureLengthInQN(currentTimeSig);
  }
  return result;
}

// ../../../../../../../Users/charlieramirez/Desktop/latinmusicmastery/lib/play-sense/score-to-exercise.ts
var INSTRUMENT_MAP = {
  guitar: "guitar",
  bass: "bass",
  tres: "tres",
  cuatro: "cuatro",
  tiple: "guitar",
  ukulele: "guitar",
  mandolin: "guitar",
  piano: "piano",
  staff: "piano",
  "perc-conga": "conga",
  "perc-bongo": "bongo",
  "perc-timbal": "timbale",
  "perc-clave": "clave",
  "perc-kit": "conga"
  // no kit in the play-sense vocabulary; nearest fallback
};
var STROKE_INFO = {
  // conga
  "open-high": { technique: "open", surface: "quinto" },
  slap: { technique: "slap", surface: "quinto" },
  "open-low": { technique: "open", surface: "conga" },
  mute: { technique: "mute", surface: "conga" },
  bass: { technique: "bass", surface: "tumba" },
  // bongo
  "macho-open": { technique: "open", surface: "macho" },
  "macho-slap": { technique: "slap", surface: "macho" },
  "hembra-open": { technique: "open", surface: "hembra" },
  "hembra-slap": { technique: "slap", surface: "hembra" },
  // timbal
  cascara: { technique: "shell", surface: "cascara" },
  high: { technique: "open", surface: "macho" },
  low: { technique: "open", surface: "hembra" },
  rim: { technique: "rim", surface: "cencerro" },
  // clave
  stroke: { technique: "tip", surface: "clave" }
};
function mapInstrument(score) {
  return INSTRUMENT_MAP[score] ?? "conga";
}
function midiToNoteName2(midi, keyFifths) {
  const key = midiToKeyString(midi, { keyFifths });
  const [pitch, octave] = key.split("/");
  return pitch.charAt(0).toUpperCase() + pitch.slice(1) + octave;
}
function scoreToExerciseDefinition(score, options = {}) {
  const trackIndex = options.trackIndex ?? 0;
  const track = score.tracks[trackIndex] ?? score.tracks[0];
  if (!track) {
    return {
      id: options.id ?? "score-exercise",
      title: options.title ?? score.title,
      description: options.description ?? "",
      instrument: "conga",
      bpm: score.initialTempo,
      timeSignature: score.initialTimeSignature,
      swing: 0,
      difficulty: options.difficulty ?? "intermediate",
      measures: 0,
      loopCount: 1,
      events: [],
      audioUrl: options.audioUrl
    };
  }
  const instrument = mapInstrument(track.instrument);
  const perc = isPercussion(track.instrument);
  const events = [];
  let currentTimeSig = score.initialTimeSignature;
  let currentKeyFifths = score.initialKeyFifths;
  let hand = "R";
  let chordCounter = 0;
  for (const measure2 of track.measures) {
    if (measure2.timeSignature) currentTimeSig = measure2.timeSignature;
    if (measure2.keyFifths !== void 0) currentKeyFifths = measure2.keyFifths;
    const beatQN = beatLengthInQN(currentTimeSig);
    const voice = measure2.voices.find((v) => v.number === 1) ?? measure2.voices[0];
    if (!voice) continue;
    let qnIntoMeasure = 0;
    for (const ev of voice.events) {
      const durationQN = ev.durationQN;
      if (ev.kind === "rest") {
        qnIntoMeasure += durationQN;
        continue;
      }
      const beat = qnIntoMeasure / beatQN + 1;
      const durationBeats = durationQN / beatQN;
      const accent = ev.articulation === "accent";
      const midis = ev.kind === "chord" ? ev.notes.map((n) => n.midi) : [ev.midi];
      const chordId = ev.kind === "chord" && !perc && midis.length > 1 ? `c${chordCounter++}` : void 0;
      for (const midi of midis) {
        let vexKey;
        let technique = "open";
        let surface;
        let expectedPitch;
        let expectedNoteName;
        if (perc) {
          const strokeData = midiToPercStroke(track.instrument, midi);
          vexKey = strokeData?.staffLine ?? "g/5";
          const info = strokeData ? STROKE_INFO[strokeData.id] : void 0;
          technique = info?.technique ?? "open";
          surface = info?.surface;
        } else {
          vexKey = midiToKeyString(midi, { keyFifths: currentKeyFifths });
          expectedPitch = midi;
          expectedNoteName = midiToNoteName2(midi, currentKeyFifths);
        }
        events.push({
          beat,
          measure: measure2.number,
          instrument,
          technique,
          hand,
          duration: durationBeats,
          vexKey,
          accent,
          expectedPitch,
          expectedNoteName,
          surface,
          chordId
        });
      }
      hand = hand === "R" ? "L" : "R";
      qnIntoMeasure += durationQN;
    }
  }
  return {
    id: options.id ?? "score-exercise",
    title: options.title ?? score.title,
    description: options.description ?? "",
    instrument,
    bpm: score.initialTempo,
    timeSignature: score.initialTimeSignature,
    swing: 0,
    difficulty: options.difficulty ?? "intermediate",
    measures: track.measures.length,
    loopCount: 1,
    events,
    audioUrl: options.audioUrl
  };
}

// ../../../../../../../Users/charlieramirez/Desktop/latinmusicmastery/lib/play-sense/onset-config.ts
var ONSET_CONFIG = {
  /** Band-pass filter lower bound (Hz) - rejects below percussion body */
  bandPassLow: 120,
  /** Band-pass filter upper bound (Hz) - rejects metronome click at 4kHz+ */
  bandPassHigh: 2e3,
  /** Envelope follower attack time (ms) */
  envelopeAttackMs: 3,
  /** Envelope follower release time (ms) */
  envelopeReleaseMs: 50,
  /** Number of frames for adaptive threshold median */
  adaptiveMedianFrames: 15,
  /** Multiplier for adaptive threshold */
  adaptiveThresholdMultiplier: 1.8,
  /** Fixed offset added to adaptive threshold */
  adaptiveThresholdOffset: 5e-3,
  /** Refractory period in ms (prevents double-trigger) */
  refractoryPeriodMs: 60,
  /** Minimum onset energy (RMS absolute floor, ~-40 dBFS) */
  minOnsetEnergy: 0.01,
  /** FFT size for spectral flux computation */
  fftSize: 512,
  /** Analysis frame size in samples */
  frameSize: 1024,
  /** Hop size in samples */
  hopSize: 512,
  /** Whether to compute a post-onset chroma vector for chord scoring (chordal instruments only) */
  analyzeChroma: false
};
var NOISY_ROOM_CONFIG = {
  ...ONSET_CONFIG,
  bandPassLow: 200,
  adaptiveThresholdMultiplier: 2.5,
  adaptiveThresholdOffset: 0.01,
  minOnsetEnergy: 0.02
};
var INSTRUMENT_PROFILES = {
  // Percussion — defaults are already tuned for these
  conga: {},
  timbale: { bandPassLow: 200, bandPassHigh: 4e3 },
  bongo: { bandPassLow: 200 },
  clave: { bandPassLow: 800, bandPassHigh: 3e3 },
  cowbell: { bandPassLow: 400, bandPassHigh: 4e3 },
  guiro: { bandPassLow: 200, bandPassHigh: 3e3, refractoryPeriodMs: 40 },
  // Pitched instruments — wider frequency range, adjusted sensitivity
  guitar: {
    bandPassLow: 80,
    bandPassHigh: 5e3,
    envelopeAttackMs: 5,
    envelopeReleaseMs: 80,
    refractoryPeriodMs: 80,
    minOnsetEnergy: 8e-3,
    fftSize: 2048,
    frameSize: 2048,
    analyzeChroma: true
  },
  bass: {
    bandPassLow: 30,
    bandPassHigh: 2e3,
    envelopeAttackMs: 8,
    envelopeReleaseMs: 100,
    refractoryPeriodMs: 100,
    minOnsetEnergy: 8e-3,
    fftSize: 4096,
    frameSize: 4096
  },
  piano: {
    bandPassLow: 27,
    bandPassHigh: 5e3,
    envelopeAttackMs: 3,
    envelopeReleaseMs: 60,
    refractoryPeriodMs: 50,
    minOnsetEnergy: 6e-3,
    fftSize: 2048,
    frameSize: 2048,
    analyzeChroma: true
  },
  tres: {
    bandPassLow: 120,
    bandPassHigh: 5e3,
    envelopeAttackMs: 4,
    envelopeReleaseMs: 70,
    refractoryPeriodMs: 70,
    minOnsetEnergy: 8e-3,
    fftSize: 2048,
    frameSize: 2048,
    analyzeChroma: true
  },
  cuatro: {
    bandPassLow: 120,
    bandPassHigh: 5e3,
    envelopeAttackMs: 4,
    envelopeReleaseMs: 70,
    refractoryPeriodMs: 70,
    minOnsetEnergy: 8e-3,
    fftSize: 2048,
    frameSize: 2048,
    analyzeChroma: true
  },
  trumpet: {
    bandPassLow: 160,
    bandPassHigh: 6e3,
    envelopeAttackMs: 10,
    envelopeReleaseMs: 100,
    refractoryPeriodMs: 100,
    minOnsetEnergy: 5e-3,
    fftSize: 2048,
    frameSize: 2048
  },
  saxophone: {
    bandPassLow: 100,
    bandPassHigh: 5e3,
    envelopeAttackMs: 10,
    envelopeReleaseMs: 100,
    refractoryPeriodMs: 90,
    minOnsetEnergy: 5e-3,
    fftSize: 2048,
    frameSize: 2048
  },
  flute: {
    bandPassLow: 250,
    bandPassHigh: 6e3,
    envelopeAttackMs: 12,
    envelopeReleaseMs: 120,
    refractoryPeriodMs: 80,
    minOnsetEnergy: 4e-3,
    fftSize: 2048,
    frameSize: 2048
  },
  violin: {
    bandPassLow: 180,
    bandPassHigh: 6e3,
    envelopeAttackMs: 8,
    envelopeReleaseMs: 100,
    refractoryPeriodMs: 80,
    minOnsetEnergy: 5e-3,
    fftSize: 2048,
    frameSize: 2048
  }
};
var SPEAKER_SAFE_CONFIG = {
  adaptiveThresholdMultiplier: 2.2,
  minOnsetEnergy: 0.015,
  refractoryPeriodMs: 100
};
var SPEAKER_SAFE_PERCUSSION = {
  ...SPEAKER_SAFE_CONFIG,
  bandPassLow: 200,
  bandPassHigh: 1800
};
function getInstrumentConfig(instrument, noisyRoom = false, speakerSafe = false) {
  const base = noisyRoom ? NOISY_ROOM_CONFIG : ONSET_CONFIG;
  const profile = INSTRUMENT_PROFILES[instrument];
  const instrumentConfig = profile ? { ...base, ...profile } : base;
  if (!speakerSafe) return instrumentConfig;
  const category = getInstrumentCategory(instrument);
  const safeOverrides = category === "percussion" ? SPEAKER_SAFE_PERCUSSION : SPEAKER_SAFE_CONFIG;
  return { ...instrumentConfig, ...safeOverrides };
}
function instrumentNeedsPitchDetection(instrument) {
  return getInstrumentCategory(instrument) === "pitched";
}

// ../../../../../../../Users/charlieramirez/Desktop/latinmusicmastery/lib/play-sense/playsense-mappings.ts
var CONGA_MAPPING = {
  instrument: "conga",
  piezoMap: { 0: "quinto", 1: "conga", 2: "tumba" },
  useMic: true
};
var TIMBALE_MAPPING = {
  instrument: "timbale",
  piezoMap: {
    0: "macho",
    1: "hembra",
    2: "campana",
    3: "cencerro",
    4: "jamblock",
    5: "cascara"
  },
  useMic: false
};
var PLAYSENSE_MAPPINGS = {
  conga: CONGA_MAPPING,
  congas: CONGA_MAPPING,
  timbale: TIMBALE_MAPPING,
  timbales: TIMBALE_MAPPING
};
var PLAYSENSE_INSTRUMENTS = /* @__PURE__ */ new Set(["conga", "congas", "timbale", "timbales"]);
function getPlaySenseMapping(instrument) {
  return PLAYSENSE_MAPPINGS[instrument] ?? null;
}

// ../../../../../../../Users/charlieramirez/Desktop/latinmusicmastery/lib/playsense-studio/score-fixtures.ts
function note(midi, durationQN, extras = {}) {
  return { kind: "note", midi, durationQN, ...extras };
}
function rest(durationQN, extras = {}) {
  return { kind: "rest", durationQN, ...extras };
}
function chord(midis, durationQN) {
  return {
    kind: "chord",
    durationQN,
    notes: midis.map((midi) => ({ midi }))
  };
}
function measure(number, events, options = {}) {
  return {
    number,
    timeSignature: options.timeSignature,
    tempoChange: options.tempoChange,
    voices: [{ number: 1, events }]
  };
}
var GUITAR_TRACK = {
  index: 0,
  instrument: "guitar",
  displayName: "Guitar",
  tuning: ["E2", "A2", "D3", "G3", "B3", "E4"],
  stringMultiplicity: 1,
  channel: 0,
  defaultView: "staff",
  measures: [
    measure(1, [
      note(60, 1),
      // C4
      note(62, 1),
      // D4
      note(64, 1),
      // E4
      note(65, 1)
      // F4
    ]),
    measure(2, [
      note(67, 1),
      // G4
      note(69, 1),
      // A4
      note(71, 1),
      // B4
      note(72, 1)
      // C5
    ])
  ]
};
var GUITAR_LICK_FIXTURE = {
  schemaVersion: 1,
  title: "C Major Scale Ascending",
  composer: "PlaySense Studio Test Fixture",
  sourceFormat: "native",
  initialTempo: 120,
  initialTimeSignature: [4, 4],
  initialKeyFifths: 0,
  tracks: [GUITAR_TRACK]
};
var TUMBAO_BAR = [
  note(62, 0.5),
  // 1   - slap
  rest(0.5),
  // 1.5
  note(64, 0.5),
  // 2   - open high
  note(64, 0.5),
  // 2.5 - open high
  note(63, 0.5),
  // 3   - bass low
  rest(0.5),
  // 3.5
  note(64, 0.5),
  // 4   - open high
  note(64, 0.5)
  // 4.5 - open high
];
var CONGA_TRACK = {
  index: 0,
  instrument: "perc-conga",
  displayName: "Conga",
  tuning: null,
  stringMultiplicity: 1,
  channel: 9,
  // GM percussion channel
  defaultView: "rhythm-grid",
  measures: [measure(1, TUMBAO_BAR), measure(2, TUMBAO_BAR)]
};
var CONGA_TUMBAO_FIXTURE = {
  schemaVersion: 1,
  title: "Conga Tumbao 2-3",
  composer: "PlaySense Studio Test Fixture",
  sourceFormat: "native",
  initialTempo: 100,
  initialTimeSignature: [4, 4],
  initialKeyFifths: 0,
  tracks: [CONGA_TRACK]
};
var TRES_BAR_C = [chord([60, 64, 67], 1), rest(2), chord([60, 64, 67], 1)];
var TRES_BAR_F = [chord([60, 65, 69], 1), rest(2), chord([60, 65, 69], 1)];
var TRES_BAR_G = [chord([62, 67, 71], 1), rest(2), chord([62, 67, 71], 1)];
var TRES_TRACK = {
  index: 0,
  instrument: "tres",
  displayName: "Tres",
  tuning: ["G3", "C4", "E4"],
  stringMultiplicity: 2,
  channel: 0,
  defaultView: "tab",
  measures: [
    measure(1, TRES_BAR_C),
    measure(2, TRES_BAR_F),
    measure(3, TRES_BAR_G, { tempoChange: 110 }),
    measure(4, TRES_BAR_C)
  ]
};
var BASS_TRACK = {
  index: 1,
  instrument: "bass",
  displayName: "Bass",
  tuning: ["E1", "A1", "D2", "G2"],
  stringMultiplicity: 1,
  channel: 1,
  defaultView: "tab",
  measures: [
    measure(1, [note(36, 1), rest(1), note(43, 1), rest(1)]),
    // C2, G2
    measure(2, [note(41, 1), rest(1), note(48, 1), rest(1)]),
    // F2, C3
    measure(3, [note(43, 1), rest(1), note(50, 1), rest(1)], { tempoChange: 110 }),
    // G2, D3
    measure(4, [note(36, 1), rest(1), note(43, 1), rest(1)])
    // C2, G2
  ]
};
var SON_CONGA_TRACK = {
  index: 2,
  instrument: "perc-conga",
  displayName: "Conga",
  tuning: null,
  stringMultiplicity: 1,
  channel: 9,
  defaultView: "rhythm-grid",
  measures: [
    measure(1, TUMBAO_BAR),
    measure(2, TUMBAO_BAR),
    measure(3, TUMBAO_BAR, { tempoChange: 110 }),
    measure(4, TUMBAO_BAR)
  ]
};
var SON_MONTUNO_FIXTURE = {
  schemaVersion: 1,
  title: "Son Montuno (C / F / G / C)",
  composer: "PlaySense Studio Test Fixture",
  sourceFormat: "native",
  initialTempo: 96,
  initialTimeSignature: [4, 4],
  initialKeyFifths: 0,
  tracks: [TRES_TRACK, BASS_TRACK, SON_CONGA_TRACK]
};
var FIXTURES = {
  guitarLick: GUITAR_LICK_FIXTURE,
  congaTumbao: CONGA_TUMBAO_FIXTURE,
  sonMontuno: SON_MONTUNO_FIXTURE
};
export {
  CHORD_PRESENCE_RATIO,
  CHROMA_PRESENCE_THRESHOLD,
  CONGA_MAPPING,
  CONGA_TUMBAO_FIXTURE,
  FIXTURES,
  GRADE_COLORS,
  GRADE_POINTS,
  GUITAR_LICK_FIXTURE,
  NOISY_ROOM_CONFIG,
  ONSET_CONFIG,
  PITCH_OCTAVE_AGNOSTIC,
  PITCH_TOLERANCE_CENTS,
  PLAYSENSE_INSTRUMENTS,
  PLAYSENSE_MAPPINGS,
  QN_EPS,
  SON_MONTUNO_FIXTURE,
  SPEAKER_SAFE_CONFIG,
  TIMBALE_MAPPING,
  TOLERANCE_BY_DIFFICULTY,
  beatDurationToVexDuration,
  beatLengthInQN,
  beatToTimestamp,
  computeStats,
  diatonicToMidi,
  effectiveDurationQN,
  extractAccidental,
  extractTrackEvents,
  frequencyToMidi,
  generateExpectedTimestamps,
  getCountInDuration,
  getDifficultyColor,
  getExerciseDuration,
  getInstrumentCategory,
  getInstrumentConfig,
  getInstrumentLabel,
  getLetterGrade,
  getPercStrokes,
  getPlaySenseMapping,
  gradeChordOnset,
  gradeSingleOnset,
  greedyMatch,
  groupEventsByMeasure,
  instrumentNeedsPitchDetection,
  isFillerRest,
  isPercussion,
  matchOnsetToExpected,
  measureBeatToMs,
  measureBeatToQN,
  measureLengthInQN,
  midiToDiatonic,
  midiToKeyString,
  midiToNoteName,
  midiToPercStroke,
  occupiedQN,
  qnToMs,
  qnToTrackMs,
  scoreToExerciseDefinition,
  trackDurationMs,
  trackDurationQN,
  vexflowDurationCode,
  walkMeasures
};
