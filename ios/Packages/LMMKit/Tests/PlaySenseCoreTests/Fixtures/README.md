# PlaySenseCore golden fixtures

Cross-platform parity contract for the Swift port of `lib/play-sense`. Every case in
these files was produced by **executing the real TypeScript** — the production
`lib/play-sense/*.ts` + `lib/playsense-studio/{time-mapping,perc-strokes,score-to-vexflow}.ts`
modules, bundled verbatim with esbuild (no logic edits) and run under Node — never by
hand-transcribing expected values. The Swift implementation must match exactly: all
arithmetic paths use the same IEEE-754 double operations in the same order, so equality
is bitwise (the only transcendental inputs, `pow`/`log2` in the pitch-cents path, are
compared after their integer rounding).

## Files

| File | Function(s) under test |
| --- | --- |
| `grade_single_onset.json` | `gradeSingleOnset` (7 vitest cases + 500 seeded property cases) |
| `grade_chord_onset.json` | `gradeChordOnset` (7 vitest + 500 property) |
| `greedy_match.json` | `greedyMatch` (500 property, incl. its verbatim-quirk break condition) |
| `match_onset_to_expected.json` | `matchOnsetToExpected` (2 vitest + 250 property) |
| `compute_stats.json` | `computeStats` (7 named edges + 500 property, incl. the pitchCorrect tri-state) |
| `exercise_utils.json` | `beatToTimestamp`, `generateExpectedTimestamps`, `getExerciseDuration`, `getCountInDuration`, `getLetterGrade`, `beatDurationToVexDuration`, `frequencyToMidi`, `midiToNoteName`, plus a JS `Math.round` sweep (`jsRound`) |
| `score_to_exercise.json` | `scoreToExerciseDefinition` over the 3 handwritten score fixtures + option variants + **every track of all 14 production corpus docs** (scores embedded) |
| `onset_config.json` | `getInstrumentConfig` (15 instruments x noisyRoom x speakerSafe), `instrumentNeedsPitchDetection`, `getInstrumentCategory`, `getInstrumentLabel`, `getPlaySenseMapping` |

Total: 3,546 cases.

## Encoding conventions

- TS `undefined` → key absent; TS `null` → JSON `null`. This distinction is load-bearing
  for `EventResult.pitchCorrect` (the tri-state: absent = not a pitched slot, null =
  pitched but unknown) — the Swift `PitchJudgment` decode relies on it.
- Doubles are emitted by `JSON.stringify` (shortest round-trip form) and decode to the
  identical IEEE-754 value in Swift.

## Regeneration

The generator lives in the task scratchpad (deliberately NOT in the web app):
`scratchpad/d19-gen/{entry.ts,build.mjs,prng.mjs,gen.mjs}` (see the D19 task report for
the full listing). PRNG: mulberry32, **seed 190719** (also recorded in each file's `seed`
field). To regenerate:

```sh
node build.mjs   # esbuild-bundles lib/play-sense via the repo's node_modules
node gen.mjs     # rewrites ios/Packages/LMMKit/Tests/PlaySenseCoreTests/Fixtures/*.json
```

`score_to_exercise.json` additionally embeds the corpus docs read from
`Tests/ScoreModelTests/Fixtures/score_documents_corpus.json` at generation time.
