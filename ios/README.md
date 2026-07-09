# Latin Music Mastery — iOS

Native SwiftUI student app (iPhone + iPad, iOS 17+).

- Prereqs: Xcode 17+ (26 recommended), `brew install xcodegen swiftlint`
- `cd ios && xcodegen generate`
- `open LatinMusicMastery.xcodeproj`
- Select `LatinMusicMastery` scheme, run on a simulator or device
- See [`DEVICE_TESTING.md`](DEVICE_TESTING.md) for the physical-device checklist (mic/BLE hardware,
  GPU frame pacing, TestFlight signing) — none of it runs in the Simulator.

## Tests

From `ios/Packages/LMMKit`:

```
xcodebuild test -scheme LMMKit-Package \
  -destination 'platform=iOS Simulator,name=iPhone 16,OS=18.3.1' \
  -skipPackagePluginValidation
```

### Opt-in gated tests (`RUN_*=1`)

A handful of tests are opt-in, off by default, and skip with a visible message otherwise:
`RUN_AUDIO_SMOKE` (3 live-`AVAudioEngine` smoke tests in `PlaySenseAudioTests`), `RUN_NOTATION_GOLDENS`
(`CorpusGoldenSnapshotTests`, below), `RUN_STAGE_SHOTS` (`StageScreenshotTests`, also reads
`STAGE_SHOT_DIR`), and `RUN_SESSION_SMOKE` (`SessionEndToEndSmokeTests`). All four go through one
shared helper, `TestGates.isEnabled(_:)` (`Sources/LMMTestSupport/TestGates.swift`).

**D27 finding, verified on this repo's Xcode 26.6 toolchain: `xcodebuild test` does not forward ANY
host env var into the simulator's `xctest` process for this package's headless test targets** — not
the bare name, not a `SIMCTL_CHILD_`-prefixed name, not a `TEST_RUNNER_*` build-setting override, and
not even a hand-edited `.xctestrun`'s `EnvironmentVariables`/`CommandLineArguments`. So the
straightforward `RUN_X=1 xcodebuild test …` invocation below never actually opens the gate through
`xcodebuild` alone, on this toolchain, regardless of spelling — confirmed with a throwaway env-dumping
test case (transcript in the D27 report). `TestGates` still checks both the bare name and the
`SIMCTL_CHILD_`-prefixed one (forward-looking: some other Xcode/CoreSimulator version or CI runner may
forward it, and checking both is free), and CI never sets either spelling, so none of this changes CI
behavior — every gate still skips there, with the same visible message.

What DOES work, verified: `xcrun simctl spawn <udid> …` (i.e. driving the already-built `.xctest`
bundle directly, bypassing `xcodebuild test`'s own launch path) honors `SIMCTL_CHILD_`-prefixed vars on
the invoking shell — `simctl` strips the prefix before the spawned process sees it, so the process
itself only ever observes the bare name (which `TestGates` — and the tests' original code — already
checked). Build once, then spawn per gated run:

```
# 1. Build the test bundle (once; -only-testing keeps it to one target if you like).
xcodebuild build-for-testing -scheme LMMKit-Package \
  -destination 'platform=iOS Simulator,id=<UDID>' -skipPackagePluginValidation

# 2. Locate the built bundle + the xctest agent + the frameworks it needs on its DYLD path
#    (swap <DerivedData…> for the path xcodebuild printed, and <UDID> for your simulator's).
BUNDLE=<DerivedData…>/Build/Products/Debug-iphonesimulator/NotationEngravingTests.xctest
XCTEST=/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneSimulator.platform/Developer/Library/Xcode/Agents/xctest
FWPATH=<DerivedData…>/Build/Products/Debug-iphonesimulator

# 3. Spawn it with the gate open (SIMCTL_CHILD_ prefix — this is the spelling that actually reaches
#    the process; the DYLD_* vars also need the same prefix or Swift's runtime won't load).
SIMCTL_CHILD_RUN_NOTATION_GOLDENS=1 \
SIMCTL_CHILD_DYLD_FRAMEWORK_PATH="$FWPATH" SIMCTL_CHILD_DYLD_LIBRARY_PATH="$FWPATH" \
xcrun simctl spawn <UDID> "$XCTEST" -XCTest NotationEngravingTests.CorpusGoldenSnapshotTests "$BUNDLE"
```

Swap the target/class after `-XCTest` and the gate name for the other three suites. If a future Xcode
release (or a CI runner) turns out to forward `SIMCTL_CHILD_RUN_X=1` through `xcodebuild test` directly
after all, the same env var — set on the `xcodebuild test` invocation instead — will work with no code
change, since `TestGates` already checks for it.

### Notation golden snapshots (`CorpusGoldenSnapshotTests`)

These byte/perceptual-compare rendered notation against committed reference PNGs. CoreText
rasterization drifts between simulator OS versions, so the references only match on the OS they
were recorded on (**iOS 18.1**). Because this repo's CI history rejected pinning runners to a fixed
simulator OS, the suite **skips itself by default** (with a visible skip message) and CI stays
green — UNLESS the live OS happens to match the recorded one (18.1), in which case it always runs
with no flag needed. To force it on a non-matching OS (or to re-record), use the `simctl spawn`
recipe above with `SIMCTL_CHILD_RUN_NOTATION_GOLDENS=1` on an **iOS 18.1** simulator; the equivalent
plain `xcodebuild test` form is:

```
SIMCTL_CHILD_RUN_NOTATION_GOLDENS=1 xcodebuild test -scheme LMMKit-Package \
  -only-testing:NotationEngravingTests/CorpusGoldenSnapshotTests \
  -destination 'platform=iOS Simulator,name=iPhone 16,OS=18.1' \
  -skipPackagePluginValidation
```

(documented per the historical convention and kept in case some environment forwards it — see the
gated-tests section above for why this specific form is confirmed NOT to open the gate on this repo's
current toolchain, and the `simctl spawn` recipe that does).

Re-record by deleting the affected PNGs under
`Tests/NotationEngravingTests/__Snapshots__/CorpusGoldenSnapshotTests/` (SnapshotTesting rewrites
any missing reference on the next run) or by flipping `isRecording` in SnapshotTesting.
