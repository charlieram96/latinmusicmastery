# Golden-fixture generators (dev tooling — not built by SwiftPM)

These Node scripts produce the golden JSON fixtures that the Swift parity suites assert against.
They exist so the fixtures are provably the output of the **real production web TypeScript / the real
production audio worklet**, executed offline — not a hand-transcription that could silently drift from
the web.

They are **developer tooling, not app code**. This `generators/` directory is not a declared SwiftPM
target, so `swift build` / `xcodebuild` never compile or bundle it (no `Package.swift` change, no
`exclude:` needed — SwiftPM only scans directories named by a target). Do not add it to a target.

Both generators require the web repo's `node_modules` (esbuild for D19; nothing beyond Node's `vm`
for D21). Run them from the repo root with a recent Node (18+).

---

## `d19-scoring/` — PlaySense scoring / exercise logic (Stage D19)

Executes the real `lib/play-sense/*` and `lib/playsense-studio/*` modules (re-exported verbatim by
`entry.ts`, bundled by esbuild in `build.mjs` — no logic edits) and emits inputs+outputs as JSON.

- **Seed:** `190719` (mulberry32, defined in `prng.mjs` as `SEED`, and re-embedded as `"seed"` in
  every generated fixture). A full regen with the same seed is byte-identical.
- **Output:** `ios/Packages/LMMKit/Tests/PlaySenseCoreTests/Fixtures/*.json`
- **Regenerate:**
  ```sh
  cd ios/Packages/LMMKit/Tests/generators/d19-scoring
  node build.mjs   # esbuild-bundles entry.ts -> bundle.mjs
  node gen.mjs      # runs the bundled REAL TS, writes the Fixtures/*.json
  ```
  `bundle.mjs` is a committed build artifact (the esbuild output) so `gen.mjs` runs even without a
  rebuild; re-run `build.mjs` after any change to the web `lib/play-sense` sources. `test-alias.mjs`
  is a tiny esbuild-alias sanity check used while wiring the bundler.
- **Absolute paths:** `build.mjs`/`gen.mjs` hardcode this checkout's repo root
  (`/Users/charlieramirez/Desktop/latinmusicmastery`). Update those constants if the repo lives
  elsewhere.

## `d21-dsp/` — onset/pitch/chroma DSP worklet (Stage D21)

Runs the real production worklet `public/audio-worklets/onset-detector-processor.js` offline in a
Node `vm` sandbox (stubbing the `AudioWorkletProcessor` base + `sampleRate`/`currentTime` globals),
feeding it deterministic 128-sample blocks and recording the emitted port messages.

- **Determinism:** the input signals are fully deterministic. Where noise is used it comes from a
  seeded mulberry32 (`signal.mjs`); the per-fixture noise seeds live in `configs.mjs`
  (e.g. `424242`, `99`). `configs.mjs` also carries the resolved `OnsetConfig`s copied verbatim from
  `lib/play-sense/onset-config.ts` (themselves golden-tested in D19; the Swift test re-derives them via
  `getInstrumentConfig` and asserts equality, so any drift is caught).
- **Output:** `ios/Packages/LMMKit/Tests/PlaySenseAudioTests/Fixtures/onset_dsp.json`
- **Regenerate:**
  ```sh
  cd ios/Packages/LMMKit/Tests/generators/d21-dsp
  node run.mjs
  ```
- **Absolute paths:** `run.mjs` hardcodes this checkout's worklet path and output path
  (`/Users/charlieramirez/Desktop/latinmusicmastery/...`). Update those constants if the repo lives
  elsewhere.
