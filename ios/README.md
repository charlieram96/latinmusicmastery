# Latin Music Mastery — iOS

Native SwiftUI student app (iPhone + iPad, iOS 17+).

- Prereqs: Xcode 17+ (26 recommended), `brew install xcodegen swiftlint`
- `cd ios && xcodegen generate`
- `open LatinMusicMastery.xcodeproj`
- Select `LatinMusicMastery` scheme, run on a simulator or device

## Tests

From `ios/Packages/LMMKit`:

```
xcodebuild test -scheme LMMKit-Package \
  -destination 'platform=iOS Simulator,name=iPhone 16,OS=18.3.1' \
  -skipPackagePluginValidation
```

### Notation golden snapshots (`CorpusGoldenSnapshotTests`)

These byte/perceptual-compare rendered notation against committed reference PNGs. CoreText
rasterization drifts between simulator OS versions, so the references only match on the OS they
were recorded on (**iOS 18.1**). Because this repo's CI history rejected pinning runners to a fixed
simulator OS, the suite **skips itself by default** (with a visible skip message) and CI stays
green. To actually run (or re-record) them, use an **iOS 18.1** simulator and set the opt-in flag:

```
RUN_NOTATION_GOLDENS=1 xcodebuild test -scheme LMMKit-Package \
  -only-testing:NotationEngravingTests/CorpusGoldenSnapshotTests \
  -destination 'platform=iOS Simulator,name=iPhone 16,OS=18.1' \
  -skipPackagePluginValidation
```

Re-record by deleting the affected PNGs under
`Tests/NotationEngravingTests/__Snapshots__/CorpusGoldenSnapshotTests/` (SnapshotTesting rewrites
any missing reference on the next run) or by flipping `isRecording` in SnapshotTesting.
