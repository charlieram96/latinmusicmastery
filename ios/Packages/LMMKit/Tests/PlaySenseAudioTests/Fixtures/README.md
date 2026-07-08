# PlaySenseAudio DSP goldens

Cross-platform parity contract for the Swift `OnsetDetector` port. `onset_dsp.json` was produced by
**executing the real production audio worklet** — `public/audio-worklets/onset-detector-processor.js`,
untouched — offline in Node, never by hand-transcribing expected values.

## How it was generated

The worklet is a plain `AudioWorkletProcessor` subclass whose only environment dependencies are two
browser globals (`sampleRate`, `currentTime`) and `this.port`. The generator runs it in a `vm` context
with a stubbed `AudioWorkletProcessor` base + `registerProcessor`, feeds it deterministic 128-sample
render quanta (advancing `currentTime` by 128/sr per block), and records every `onset` / `chord` /
`level` message. No `OfflineAudioContext` needed — the worklet's logic is self-contained.

Inputs are generated **deterministically from compact params** (documented per fixture in the JSON) by
`signal.mjs`; the Swift test regenerates bit-identical `Float32` inputs via `OnsetDetectorSignal.swift`
(an exact mirror) and asserts the committed `inputChecksum` before running the detector.

## Fixtures (7) across 5 configs

`clicks_default`, `double_hit_refractory`, `sine_pitch_default` (default) · `guitar_chord` (guitar,
chroma) · `noise_floor_noisyRoom` (noisyRoom) · `speakerSafe_hits` (speakerSafe) · `conga_default`
(conga). They exercise click onsets, the envelope-release double-onset, refractory suppression,
autocorrelation pitch (incl. the octave-down latch to 110 Hz), chord chroma, noise-floor threshold
adaptation, and per-instrument config paths.

## Tolerances (asserted by `OnsetDetectorGoldenTests`)

Onset time ±1 hop · energy 1e-4 relative · flux-confirmed exact · pitch ±0.5 Hz · chroma 1e-4 · level
count exact + max/last 1e-3 relative.

## Regeneration

Generator lives in the task scratchpad (deliberately NOT in the app): `scratchpad/d21-gen/`
(`signal.mjs`, `configs.mjs`, `run.mjs`). To regenerate:

```sh
node scratchpad/d21-gen/run.mjs   # rewrites this directory's onset_dsp.json
```

Noise fixtures use `mulberry32` (seeds recorded in each fixture's `signal.noise.seed`).
