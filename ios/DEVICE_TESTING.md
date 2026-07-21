# Device Testing Checklist (D27)

Everything in this checklist requires **physical hardware** (a real mic, real Bluetooth radio, a
real GPU/display, a real Apple signing team) and could not be run in the Simulator during D27's
consolidation pass — the Simulator-side regression pass is covered in the D27 report instead.
Each item below states how to run it, what a good result looks like, and which code constant or
ledger note to revisit if it doesn't check out.

Prereqs for the whole session: an iPhone with a physical **A15** (the documented performance
floor) or newer, a Lightning/USB‑C cable, a real PlaySense hardware unit (piezo-sensored
conga/timbale surfaces) for the BLE items, a wired headset AND a USB‑C (or Lightning-to-3.5mm)
adapter, and a Bluetooth audio device (headphones/speaker) for the blocked-route check.

## 1. Mic acoustic loop (real conga/clap grading)

**How to run:** Build to device (Debug), sign in, open a PlaySense EXERCISE class item (e.g.
"Exercise - Rhythm - Cáscara" in Son Cubano Timbal), choose **Headphones** or **Speaker-safe**
mode (real mic path — the `Start` button, not the DEBUG `Loose`/`Miss run` buttons, which only
exist because the Simulator has no mic at all), and play the real instrument (clap or tap a
conga/table) in time with the falling notes for a full take.

**What good looks like:** Hits register as PERFECT/GOOD/OK grades in the HUD roughly in sync with
your taps (no multi-second lag), a clap doesn't double-trigger as two onsets, and the results
screen's per-event grade matches your felt performance. Compare against the calibrated offset for
your route (see §2) — a well-calibrated take should feel "on time," not early or late.

**Which constant to tune if it fails:** `PlaySenseCore/Tolerances.swift`'s timing windows
(`perfect`/`good`/`ok` ms bands) if grading feels systematically too strict/lenient once latency
is ruled out; `PlaySenseAudio/OnsetConfig.swift`'s per-instrument onset-detection thresholds
(`getInstrumentConfig(_:noisyRoom:speakerSafe:)`) if hits are missed or double-fire on the real
instrument's actual acoustic signature (the Simulator obviously never exercised this).

### Per-route calibration, including wired and USB‑C

**How to run:** Trigger the calibration wizard (`CalibrationWizardView`, reachable from the
mode-select flow) once per route: built-in mic/speaker, wired headphones (3.5mm via adapter),
and USB‑C headset/interface if you have one. Tap along the 16-beat, 100 BPM click for each route.

**What good looks like:** Each route gets its own stored `CalibrationRecord` — verify by checking
`UserDefaults` isn't reusing one route's offset for another (unplug/replug between routes and
confirm the wizard doesn't silently skip). `RouteClassification.swift`'s `AudioOutputCategory`
distinguishes `.wiredHeadphones` from `.usb` from `.builtInSpeaker` explicitly, so this is a real
code path, not a hypothetical — verify a USB‑C interface actually classifies as `.usb` and not
`.other` (an unrecognized `AVAudioSession.Port` raw value would fall through to `.other` and get
lumped in with routes calibration never distinguished).

**Which constant/key to tune if it fails:** `CalibrationStore.storageKey(sourceType:routeKey:)` —
format is `"com.lmm.playsense.calibration.<sourceType>.<routeKey>"` where `routeKey` is built by
`CalibrationStore.routeKey(for:)` = `"in[<portType>:<portName>|…]_out[<portType>:<portName>|…]"`
(`CalibrationStore.swift`). If two routes are wrongly sharing a calibration, inspect the actual
`RouteInfo` for each (port type/name) — the key is the ENTIRE route folded together, so a route
that reports the same port type/name as another (e.g. two different USB interfaces both reporting
generic `usbAudio`) will collide. If a real device's port type doesn't map to a rich
`AudioOutputCategory`, add a case in `RouteClassifier.category(forPortType:)`
(`RouteClassification.swift`).

### Loopback latency self-check (the idea from the plan, not yet built)

**How to run (manual, no code today):** With wired headphones or a physical loopback cable
(speaker output → mic input), play the calibration click through the OUTPUT side while recording
the SAME signal on the INPUT side — i.e., let the click get picked up by the mic directly,
instead of a human tapping along. This isolates the device's own hardware I/O latency (DAC → ADC
round-trip) from human reaction-time variance, which the tap-along wizard
(`LatencyCalibrator.swift`) can't separate out on its own.

**What good looks like:** The self-check's measured offset should be well BELOW the human-tapped
`CalibrationRecord.offsetMs` for the same route — human reaction time alone is commonly
20–60 ms, so if the tap-along offset is only a few ms above the loopback self-check's floor, the
human number is plausible; if the tap-along number is wildly larger (e.g. 150+ ms above the
floor) or NEGATIVE relative to it, suspect a real timing bug rather than human variance.

**Which constant to tune if it fails:** There's no dedicated loopback-mode code yet — this is a
manual sanity check using the existing wizard, comparing its output across two capture methods.
If this device pass finds it valuable, `LatencyCalibrator.swift`'s `expectedTimes(t0:)` +
`computeCalibration` are the pure functions to build an automated loopback variant on top of
(same math, different `onsetTimestamps` source).

## 2. BLE hardware (real PlaySense firmware)

CoreBluetooth has no radio on the Simulator — `PlaySenseDeviceManager`'s module doc notes
`CBCentralManager`'s state "never leaves `.unknown`/`.unsupported`" there, so this ENTIRE section
is unverifiable without hardware, and the D25 report's fake-based unit tests are the practical
floor until this pass runs.

**How to run:** Power on a real PlaySense device, open the app, select **PlaySense (BLE)** mode
from mode-select (not the DEBUG synthetic-BLE demo row in Profile — that seam bypasses
CoreBluetooth entirely). Let it scan, connect, subscribe, and play a take with real piezo hits.

**What good looks like / what to verify specifically:**
- **Service-UUID advertising vs. name-only.** `PlaySenseBLEProtocol.matches(name:advertisementData:)`
  (`PlaySenseBLEReading.swift`) accepts a match on EITHER the exact device name `"PlaySense"`
  (`peripheral.name` or the advertised local name) OR the advertised service UUID
  `12345678-1234-1234-1234-123456789abc` — "the firmware may not advertise the service" per the
  original plan, so both signals exist. Confirm which one your real firmware actually advertises
  (log/inspect `advertisementData` during a scan) and that the OTHER signal isn't silently masking
  a firmware regression (e.g. if firmware stops advertising the service UUID, does the name match
  alone still connect you reliably?).
- **Notification cadence/jitter vs. the 15 s scan timeout.** `PlaySenseDeviceManager
  .scanTimeoutMilliseconds = 15_000` (`PlaySenseDeviceManager.swift`) is a guessed value ("no
  product spec pins an exact value... 15s is long enough for a real scan/advertise cycle to
  complete"). Confirm on real hardware that the firmware's advertising interval reliably gets
  discovered well inside 15 s (if advertising is slow/intermittent, real users would see spurious
  "no device found" errors the Simulator/fakes could never surface). Separately, measure real
  notification arrival jitter (time between piezo-hit and BLE notification delivery) — this
  matters for grading accuracy exactly like mic-onset latency does, but has no calibration wizard
  step of its own yet (BLE-source `CalibrationRecord`s exist, keyed `.ble`, but nothing in this
  repo actively re-measures notification jitter over a session).
- **Reconnect / pull-the-battery test.** `PlaySenseDeviceManager.beginReconnectAttemptOrGiveUp`
  allows exactly ONE reconnect attempt (`reconnectAttempts < 1`) before surfacing
  `PlaySenseBLEErrorMessage.reconnectFailed`. Mid-take, power off (or walk the device out of
  range) the real PlaySense hardware: confirm the app attempts exactly one reconnect, and on
  failure lands in `.interrupted(.bleDisconnected)` with a working **Retry** (which re-detours
  through `.connectingDevice`, per `SessionCoordinator.retry()`'s fix-round-1 BLE-reconnect
  check). Power the device back on during the retry and confirm it actually reconnects and
  resumes grading — this exact path has no live-hardware coverage today.

**Which constant to tune if it fails:** `PlaySenseDeviceManager.scanTimeoutMilliseconds` (15 000)
if real advertising is slower than assumed; `PlaySenseBLEProtocol.serviceUUID` /
`characteristicUUID` / `deviceName` (`PlaySenseBLEReading.swift`) if firmware's actual GATT
identifiers ever change; the single-reconnect-attempt cap in `beginReconnectAttemptOrGiveUp` if
real-world drops (e.g. brief walk-out-of-range) warrant more than one retry.

## 3. GPU frame pacing

**Ledger context:** D24's own performance claim is explicitly scoped as simulator-host CPU-only —
its fix-round-1 correction states verbatim: *"D24's 'well within frame budget' claim =
simulator-host CPU-only; on-device validation is a D27 exit criterion."* The measured number
(`HighwayPerformanceTests`, run on the CI/dev Mac, not a phone) was **avg 0.039 ms/frame, max
4.9 ms (one-time texture-bake outlier), 362 nodes**, comfortably under an 8.3 ms (120 fps) budget
— but that's `HighwayScene.update(_:)` CPU cost alone; GPU cost, SpriteKit's own render overhead,
and real display-link pacing were never measured on a GPU until now.

**How to run:** On a real device (A15 floor + a ProMotion device if available), open a PlaySense
stage session and profile it with Xcode's **Instruments** — the **Metal System Trace** template
(GPU utilization, frame time, dropped frames) and/or the **Core Animation** template (FPS,
render-thread time). Separately, `StagePlayerView(showsDebugOverlay: true)` turns on
`SKView.debugOptions = [.showsFPS, .showsNodeCount, .showsDrawCount]` — no build in the app
wires this to `true` today, so temporarily flip it on the Profile tab's DEBUG "PlaySense Stage"
row (`ProfileView.swift`) for an in-app HUD instead of/alongside Instruments.

**What good looks like:** Sustained 120 fps on a ProMotion device (60 fps on the A15 floor,
non-ProMotion) through a full dense take (the busiest exercise you have), no visible stutter
during hit/miss effect bursts (the texture-bake-on-first-hit outlier noted above should be a
one-time ~5 ms blip, not a recurring one), and Instruments showing no GPU-bound frames (the CPU
cost is already known to be trivial — if frames are dropped, it's on the GPU/render side, which
this device pass is specifically here to catch for the first time).

**Which constant to tune if it fails:** `PlaySenseHighway/TextureBank.swift`'s cached-sprite
count/atlas size if GPU fill rate is the bottleneck; `StagePlayerView`'s
`SpriteView(preferredFramesPerSecond: 120)` (drop to 60 as a fallback) if ProMotion pacing can't
be sustained on the A15 floor; `Effects.swift`'s particle-pool size if hit/miss effect bursts spike
frame time.

## 4. Chroma grading margin: +80 ms compute window vs. the +95 ms grade delay

**Ledger context:** two distinct constants, in two different layers, that only work together if
device timing holds up:
- `OnsetDetector.chordWindowSec = 0.08` (**80 ms** — `PlaySenseAudio/OnsetDetector.swift`, doc
  comment: "Post-onset window (seconds) before computing chord chroma — the worklet's
  `chordWindowSec`") is when the detector itself actually COMPUTES and emits the `.chord` message
  (`pendingChromas.append(PendingChroma(onsetTimestamp: now, fireAt: now + chordWindowSec))`),
  relative to the onset.
- `LiveScorer.chordGradeDelayMs = 95` (**95 ms** — `PlaySenseCore/LiveScorer.swift`, a port of the
  web's `CHORD_GRADE_DELAY_MS`) is when the GRADING layer reads that chroma back
  (`MicOnsetEventSource.chroma(forOnsetKey:)`) to grade the chord.

The 15 ms gap between them is the entire safety margin: it assumes the 80 ms chroma computation
has already landed in `MicOnsetEventSource`'s store by the time the 95 ms grade timer fires. Both
values are ports of the web's Web Audio/worklet timing, never verified against `AVAudioEngine`'s
real on-device tap-to-chroma latency (which touches real hardware I/O buffers the Simulator
doesn't emulate faithfully).

**How to run:** Play a chord-graded exercise (an instrument with `chordId`-tagged expected events —
guitar/piano chord voicings) on a real device and log the actual gap between an onset firing and
its chroma becoming available (`MicOnsetEventSource.chroma(forOnsetKey:)`'s lookup succeeding vs.
missing). `NSLog`/breakpoint around `LiveScorer.gradeChordDeferred` and
`MicOnsetEventSource.recordChroma` to capture real timestamps.

**What good looks like:** The real chroma-ready latency stays comfortably under 95 ms on device
(headphones AND speaker-safe routes — speaker-safe's extra audio processing could plausibly add
latency). If it's consistently, say, 85–90 ms, the 15 ms margin is real but thin; if it ever
exceeds 95 ms, `gradeChordDeferred` fires against missing/stale chroma and chord grades would
silently degrade to whatever "no chroma yet" fallback exists.

**Which constant to tune if it fails:** `LiveScorer.chordGradeDelayMs` (currently 95) — raise it
if real chroma latency runs closer to or over 95 ms; note this delays every chord grade's HUD
feedback by the same amount, so don't over-correct without device evidence.

## 5. Audio-route matrix

**How to run:** Repeat a short graded take across: (a) built-in speaker (speaker-safe mode), (b)
wired headphones (headphones mode), (c) a Bluetooth headset/speaker connected — confirm the
**blocked-route prompt** fires instead of a silent/broken session.

**What good looks like:** For (c), `SessionCoordinator` should route to `.bluetoothBlocked`
showing *"Bluetooth audio adds unpredictable latency and can't be scored accurately."* with
**"Practice anyway (no score)"** (→ `acceptPracticeMode()`, ungraded) and **"Back"** (→
`dismissBluetoothBlock()`) — never a graded take over Bluetooth. For (a)/(b), confirm each
produces a usable calibration (§1) and a normally-graded take with no spurious interruption.

**Which constant to tune if it fails:** `RouteClassifier.category(forPortType:)`
(`RouteClassification.swift`) if a real Bluetooth accessory's port type isn't recognized as
`.bluetooth` (falls through to `.other` and the block never fires); `SessionCoordinator`'s
`isBluetoothOutput` check site if the block fires at the wrong point in the session lifecycle.

## 6. `.mediaServicesReset` behavior

**Current behavior (verify this is actually acceptable on device):**
`AudioSessionController` observes `AVAudioSession.mediaServicesWereResetNotification` and forwards
it as `.mediaServicesReset` (`RouteClassification.swift`'s `AudioSessionEvent` enum), but BOTH
consumers currently treat it as a **no-op**:
```swift
case .interruption(.ended), .mediaServicesReset:
    break
```
in both `SessionCoordinator.handleSessionEvent` (`SessionCoordinator.swift`) and
`CalibrationWizardModel`'s equivalent handler (`CalibrationWizardModel.swift`). The latter's doc
comment is explicit that this is a deliberate, known gap, not an oversight: *"`.mediaServicesReset`
(the whole audio server restarting) is a far more severe, whole-engine-invalidating event that
would need a full `GameAudioEngine` rebuild to recover from; that's beyond this fix's scope (not
reported), so it's intentionally left unhandled here rather than papered over."* A real
media-services reset means the ENTIRE `AVAudioSession`/audio server process restarted — the
existing `AVAudioEngine` instance is now talking to a dead server. This event is rare (audio
daemon crash, not a normal interruption) and cannot be triggered from the Simulator or any unit
test, hence its device-only status.

**How to run:** Best-effort trigger: play a take, then force a low-memory/audio-daemon crash if
you have a way to (Apple doesn't expose a supported way to trigger this on demand outside of
waiting for an organic occurrence — if you can't force one, this item may have to stay "verify
the no-op is at least non-crashing" rather than "verify recovery," and gets carried forward).

**What good looks like:** At minimum, the app doesn't crash and doesn't hang in a state that
looks alive but produces no onsets/audio. Ideally, a media-services reset should behave like
`.audioInterruption` (`abortTake` + return to `.interrupted`, letting `retry()` rebuild the audio
graph from scratch) rather than silently doing nothing — if this device pass instead observes a
silently-dead session (looks fine, grades nothing, no error), that IS a real defect worth a
follow-up task, since `break` is very likely the wrong behavior — it currently relies on nothing
downstream noticing the audio graph is gone.

**Which code to change if it fails:** `SessionCoordinator.handleSessionEvent`'s
`.mediaServicesReset` case (`SessionCoordinator.swift`, currently grouped with
`.interruption(.ended)` as a no-op) — likely needs its own `abortTake(...)` path plus an audio
session/engine re-teardown-and-rebuild, since unlike an interruption ending, the underlying
`AVAudioEngine` itself is invalid after this notification, not just paused.

## 7. TestFlight prerequisites

**How to run:** Confirm these BEFORE attempting a TestFlight/App Store Connect upload:
- **Signing team.** `project.yml` sets no `DEVELOPMENT_TEAM` — Xcode's automatic signing needs a
  REAL (paid or free) Apple Developer team selected locally to build an installable/archivable
  binary; a personal-team-only build has historically blocked device installs specifically
  BECAUSE of the entitlement below (see A3's own carry-forward note: *"with no signing team
  configured, the entitlement may block device installs but simulator builds still work"*).
  Select a real team in Xcode's Signing & Capabilities tab (or set `DEVELOPMENT_TEAM` in
  `project.yml`/an xcconfig) before archiving.
- **Bundle id.** `com.latinmusicmastery.app` (`project.yml`'s `PRODUCT_BUNDLE_IDENTIFIER`) must
  be registered to that team in the Apple Developer portal, with an App Store Connect record
  created for it, before an upload will succeed.
- **Sign in with Apple entitlement.** `App/LatinMusicMastery.entitlements` declares
  `com.apple.developer.applesignin: [Default]`. This REQUIRES the selected team to have the Sign
  in with Apple capability enabled for this bundle id (Apple Developer portal, under Certificates,
  Identifiers & Profiles → the app id → capability toggle) — without it, codesigning/provisioning
  for a real device or archive will fail even though Simulator builds don't care (Simulator
  doesn't enforce entitlement-to-provisioning-profile matching).
- **Microphone / Bluetooth usage strings.** Already present (`NSMicrophoneUsageDescription`,
  `NSBluetoothAlwaysUsageDescription` in `project.yml`) — confirm they still read naturally on a
  real permission prompt (first mic-mode session, first BLE mode-select) since that's the actual
  user-facing moment, not just a plist string in the abstract.

**What good looks like:** `xcodebuild archive` succeeds with a real team selected, the resulting
`.ipa` installs on a registered test device via Xcode or TestFlight, and both the mic and
Bluetooth permission prompts appear with the expected copy on first use.

**Which config to change if it fails:** `project.yml`'s `LatinMusicMastery` target `settings.base`
(add `DEVELOPMENT_TEAM: <team id>` if automatic signing in Xcode's UI isn't sticking through
`xcodegen generate` regenerations); `App/LatinMusicMastery.entitlements` if the Sign in with Apple
capability needs to be dropped entirely for a first TestFlight build (email/password sign-in
works standalone per `ios/README.md`'s own note that it's "the one path that works end-to-end
today").
