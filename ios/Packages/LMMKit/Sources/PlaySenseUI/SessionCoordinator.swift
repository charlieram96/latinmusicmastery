import Foundation
import Observation
import PlaySenseAudio
import PlaySenseBLE
import PlaySenseCore
import QuartzCore

// The one cohesive orchestration unit (a faithful port of the 837-line `use-exercise-session.ts` lifecycle);
// its methods share private engine/scorer/machine state, so splitting across files would force that state
// internal. Kept in one file with a documented length exception instead. D25's BLE mode-select/status
// handling (`beginBLEModeSelect`/`handleBLEStatusChange`/`handleBLEDevicesChange`/`installBLEOnsetSource`)
// touches the same private `machine`/`bleManager`/`onsetSource` state for the same reason, pushing the
// primary class body over `type_body_length`'s default too — same call, same rationale. `file_length`
// stays disabled for the whole file (inherent — there's no "this declaration" to scope it to);
// `type_body_length` is disabled/re-enabled around just the primary class body below (closing brace),
// rather than left as an indefinite blanket disable.
// swiftlint:disable file_length
// swiftlint:disable type_body_length

/// The playable core of PlaySense: orchestrates ``GameAudioEngine`` + ``AudioSessionController`` +
/// ``MicOnsetEventSource`` + ``LiveScorer`` into a graded exercise session, driving the pure
/// ``SessionPhaseMachine`` from real audio/clock events. Port of `hooks/use-exercise-session.ts`'s
/// lifecycle (`startExercise`/`updatePlayhead`/`finishExercise`) minus attempt persistence (D26). D24 added
/// the highway bridge (unwired here — `HighwayBridge` sits outside, feeding from `SessionCoordinator`'s
/// published state); D25 added the PlaySense BLE mode. One `CADisplayLink` drives the count-in beat,
/// playhead, tentative-miss loop, and the ~10 Hz HUD throttle — the analogue of the hook's
/// `requestAnimationFrame(updatePlayhead)`.
@MainActor
@Observable
public final class SessionCoordinator {

    // MARK: - Published state

    public private(set) var phase: SessionPhase = .idle
    public private(set) var audioMode: SessionAudioMode = .headphones
    public private(set) var exercise: ExerciseDefinition?

    /// 0…1 playhead progress through the exercise (post count-in).
    public private(set) var playheadProgress: Double = 0
    /// 1-indexed count-in beat, or 0 before the first click.
    public private(set) var countdownBeat = 0

    // Throttled HUD readouts (updated ≤ ~10 Hz while playing).
    public private(set) var hudScore: Double = 0
    public private(set) var hudCombo = 0
    public private(set) var hudAccuracy: Double = 0
    public private(set) var hudLastGrade: String?
    public private(set) var inputLevel: Double = 0

    public private(set) var errorMessage: String?

    /// `true` when the current/last take runs unranked (Bluetooth practice-mode escape).
    public var isPracticeMode: Bool { machine.isPracticeMode }

    /// The final results once a take reaches `.results`.
    public private(set) var finalResults: [EventResult] = []
    public private(set) var attemptStats: AttemptStats?

    /// D26: injected persistence sink (LMMFeatures wires this to an `OfflineAttemptQueue` backed by
    /// an `AttemptRepository`). `nil` in every DEBUG harness/preview that doesn't care about
    /// persistence (`StagePlayerView`'s default init parameter) — a finished take then simply
    /// stays `.idle`.
    public var attemptSink: PlaySenseAttemptSink?
    /// The results panel's persistence affordance — `StageResultsView` shows a spinner while
    /// `.saving` and a subtle "will sync" note when `.queued`; `.saved`/`.idle` show nothing extra.
    public private(set) var attemptPersistState: AttemptPersistState = .idle

    /// The full expected-event timeline for the current take (for the debug stage's upcoming-events list).
    public private(set) var expectedEvents: [ExpectedEvent] = []
    /// Live graded results, refreshed on the ~10 Hz HUD tick — the timeline of what has been graded so far.
    public private(set) var hudResults: [EventResult] = []

    #if DEBUG
    /// Simulator seam: when set before `startSession()`, synthetic onsets are injected for each expected
    /// event as its time passes, so a full session grades deterministically with no mic (Simulator has none).
    public var debugAutoPlayOffsetMs: Double?
    /// D25 simulator seam: set together with `selectMode(.playsense)` to bypass real CoreBluetooth
    /// (inert on the Simulator — see `PlaySenseDeviceManager`'s module doc) and drive a full graded BLE
    /// session via synthetic readings injected through the REAL `BLEOnsetSource` mapping pipeline. See
    /// `beginBLEModeSelect()` and `injectDueSyntheticBLEReadings(elapsed:)`.
    public var debugSyntheticBLESession = false
    /// Fix round 1 test seam: when set (before `selectMode(.playsense)`), `makeBLEManager()` constructs the
    /// manager with THIS central instead of a real `CBCentralManager` — generalizes
    /// `debugSyntheticBLESession`'s fixed `NoOpBLECentralManager` swap to any `PlaySenseBLECentralManaging`
    /// fake, so `SessionCoordinatorBLERetryTests` can observe the scan/connect calls a retry's reconnect
    /// flow issues with zero real CoreBluetooth involved. Ignored whenever `debugSyntheticBLESession` is
    /// set (that seam already picks its own `NoOpBLECentralManager`).
    public var debugBLECentral: (any PlaySenseBLECentralManaging)?
    /// Fix round 1 test seam: when set, `makeBLEManager()` constructs the manager with THIS scheduler
    /// instead of a real `RealDeferredScheduler`, so a test can deterministically advance the manager's
    /// scan-timeout (`PlaySenseDeviceManager.startScanning()`) via a `ManualDeferredScheduler` instead of
    /// waiting on a real ~15s timer.
    public var debugBLEScheduler: DeferredScheduler?
    /// Fix round 1 test seam: when set, `makeBLEManager()` constructs the manager with THIS `UserDefaults`
    /// instead of `.standard`, so `SessionCoordinatorBLERetryTests` never reads/writes the REAL
    /// `UserDefaults.standard`'s persisted-peripheral-identifier key — the same isolation
    /// `PlaySenseDeviceManagerTests` gets via its own scoped `UserDefaults(suiteName:)`.
    public var debugBLEDefaults: UserDefaults?
    #endif

    /// The live BLE connection status, for a `.playsense`-mode UI to render (connect progress / errors).
    /// `.disconnected` before any BLE mode selection has happened.
    public var bleConnectionStatus: BLEConnectionStatus { bleManager?.connectionStatus ?? .disconnected }
    /// Devices found by the current scan — `DevicePickerSheet` renders this when more than one match is
    /// found (a single match auto-connects, see `handleBLEDevicesChange`).
    public var bleDiscoveredDevices: [PlaySenseDeviceManager.DiscoveredDevice] { bleManager?.discoveredDevices ?? [] }

    // MARK: - Collaborators

    private let sessionController: AudioSessionController
    private var engine: GameAudioEngine?
    private var onsetSource: OnsetEventSource?
    /// Narrow-typed alias to the SAME instance as `onsetSource` while a BLE take is running — only needed
    /// so the DEBUG synthetic-BLE injector can reach `debugInject(reading:)`, which isn't part of the
    /// shared `OnsetEventSource` protocol.
    private var bleOnsetSource: BLEOnsetSource?
    /// `internal` (not `private`) specifically so `@testable`-imported coordinator tests
    /// (`SessionCoordinatorBLERetryTests`) can drive its `handle*` chain directly (the same fakes-only
    /// technique `PlaySenseDeviceManagerTests` uses) to reach `.connected`/`.error` without any real
    /// CoreBluetooth — same rationale as that type's own `handle*` methods being `internal`.
    var bleManager: PlaySenseDeviceManager?
    private var scorer: LiveScorer?
    private var scheduler: RealDeferredScheduler?
    private var frameDriver: DisplayLinkDriver?

    /// `internal` (not `private`) for the same testability reason as `bleManager` above: coordinator tests
    /// drive phase transitions directly through the pure, audio-free `SessionPhaseMachine` API (e.g. forcing
    /// `.playing → .interrupted(.bleDisconnected)`) instead of spinning up a real `GameAudioEngine`/
    /// `AVAudioSession` take, which `SessionEndToEndSmokeTests` shows is unavoidably environment-sensitive.
    var machine = SessionPhaseMachine() {
        didSet { phase = machine.phase }
    }

    private var t0Seconds: Double = 0
    private var exerciseDurationSeconds: Double = 0
    private var lastHudUpdate: CFTimeInterval = 0
    private var expectedForSimulation: [ExpectedEvent] = []
    private var injectedSimulationIndices = Set<Int>()
    /// D26: guarantees `persistAttemptIfNeeded` hands a take to `attemptSink` AT MOST ONCE, however
    /// it ends up getting called (`stopSession()` is already documented idempotent via the phase
    /// machine, but this is the belt-and-suspenders guard the offline-queue design leans on to rule
    /// out double-fire — see `OfflineAttemptQueue`'s doc comment). Reset per take in
    /// `resetTakeState()`.
    private var hasPersistedCurrentAttempt = false

    private static let hudInterval: CFTimeInterval = 0.1 // ~10 Hz

    public init(sessionController: AudioSessionController? = nil) {
        // `AudioSessionController()` is a MainActor-isolated init; construct it in-body (see
        // `CalibrationWizardModel` for the default-parameter caveat).
        self.sessionController = sessionController ?? AudioSessionController()
        self.sessionController.onEvent = { [weak self] event in self?.handleSessionEvent(event) }
    }

    // MARK: - Flow entry

    /// Load an exercise and enter the mode picker.
    public func present(exercise: ExerciseDefinition) {
        self.exercise = exercise
        machine = SessionPhaseMachine()
        machine.beginModeSelect()
    }

    /// Choose the audio mode. Mic modes evaluate the calibration gate immediately; `.playsense` instead
    /// kicks off the BLE connect flow (`beginBLEModeSelect()`), which reaches the calibration gate only
    /// once a device is connected. Clears any stale `errorMessage` from a previous failed attempt (fix
    /// round 1 for D25's review — `modeSelectOverlay` now renders this, so a fresh mode choice must not
    /// still be showing the LAST attempt's error).
    public func selectMode(_ mode: SessionAudioMode) {
        audioMode = mode
        errorMessage = nil
        if mode == .playsense {
            beginBLEModeSelect()
        } else {
            machine.selectMode(hasCalibrationRecord: hasCalibrationRecord(for: mode))
        }
    }

    /// Calibration satisfied (record already existed, or wizard finished/skipped) → armed and ready.
    public func calibrationResolved() {
        machine.calibrationResolved()
    }

    /// Whether a stored calibration exists for `mode` on the current route (so the UI can auto-advance).
    public func hasCalibrationRecord(for mode: SessionAudioMode) -> Bool {
        let sourceType: CalibrationSourceType = mode == .playsense ? .ble : .mic
        let key = CalibrationStore.routeKey(for: sessionController.currentRouteInfo)
        return CalibrationStore.load(sourceType: sourceType, routeKey: key) != nil
    }

    // MARK: - PlaySense BLE connect flow (D25)

    /// Enter `.connectingDevice` and start (or fast-path resume) the BLE scan/connect flow. No wizard is
    /// wired into the live session for ANY source type yet (mic modes bypass `calibrationCheck` the same
    /// way today — see `StagePlayerView.setUpIfNeeded()`), so once connected this resolves calibration the
    /// same way the mic path currently does: immediately, matching existing precedent rather than adding
    /// asymmetric BLE-only wizard wiring.
    private func beginBLEModeSelect() {
        machine.beginDeviceConnect()

        #if DEBUG
        // A REAL `CBCentralManager` reports its state asynchronously as soon as it's constructed —
        // regardless of whether scanning ever starts — and the Simulator's real (typically unusable)
        // state would race with and override this forced synthetic state a beat later (see
        // `NoOpBLECentralManager`'s doc comment). Route through the no-op central instead of the real one.
        if debugSyntheticBLESession {
            let manager = bleManager ?? makeBLEManager(central: NoOpBLECentralManager())
            bleManager = manager
            manager.wantsConnection = true
            machine.deviceConnected(hasCalibrationRecord: hasCalibrationRecord(for: .playsense))
            machine.calibrationResolved()
            return
        }
        #endif

        reconnectBLE()
    }

    /// Kick off (or resume) the BLE connect flow — shared by `beginBLEModeSelect()` (the FIRST connect,
    /// already in `.connectingDevice` by the time this runs) and `retry()`/`startSession()`'s
    /// `needsBLEReconnectBeforeProceeding` branch (fix round 1: a LATER reconnect, also already in
    /// `.connectingDevice` via `SessionPhaseMachine.beginDeviceReconnect()` by the time this runs). Once
    /// `PlaySenseDeviceManager` reports `.connected` again, `handleBLEStatusChange`'s existing `.connected`
    /// case advances the rest of the way on its own (it only checks `machine.phase == .connectingDevice`,
    /// never how the phase got there) — no separate "reconnected" transition needed here.
    private func reconnectBLE() {
        let manager = bleManager ?? makeBLEManager()
        bleManager = manager
        manager.wantsConnection = true
        manager.connectUsingPersistedIdentifierOrScan()
    }

    /// Whether `retry()`/`startSession()` must detour through `.connectingDevice` before proceeding: only
    /// in `.playsense` mode, and only when the connection genuinely isn't `.connected` (an exhausted
    /// mid-take reconnect, or a drop that happened while just sitting at `.ready`/`.results`/`.interrupted`
    /// with no active take to abort). Web parity: `use-playsense-onsets.ts`'s `startListening()` performs
    /// this exact "reconnect if not connected" check at the top of EVERY `startExercise()` call, retries
    /// included.
    ///
    /// Always `false` under `debugSyntheticBLESession`: that seam's `NoOpBLECentralManager`-backed manager
    /// never reports `.connected` at all (synthetic readings are injected directly into `BLEOnsetSource`,
    /// bypassing the manager's notify path entirely — see `injectDueSyntheticBLEReadings`), so without this
    /// exclusion every synthetic-session retry would misfire into a reconnect it doesn't need.
    private var needsBLEReconnectBeforeProceeding: Bool {
        guard audioMode == .playsense else { return false }
        #if DEBUG
        if debugSyntheticBLESession { return false }
        #endif
        return bleConnectionStatus != .connected
    }

    private func makeBLEManager(central: (any PlaySenseBLECentralManaging)? = nil) -> PlaySenseDeviceManager {
        #if DEBUG
        let resolvedCentral = central ?? debugBLECentral
        let manager = PlaySenseDeviceManager(
            central: resolvedCentral,
            defaults: debugBLEDefaults ?? .standard,
            scheduler: debugBLEScheduler ?? RealDeferredScheduler()
        )
        #else
        let manager = PlaySenseDeviceManager(central: central)
        #endif
        manager.onConnectionStatusChange = { [weak self] status in self?.handleBLEStatusChange(status) }
        manager.onDiscoveredDevicesChange = { [weak self] devices in self?.handleBLEDevicesChange(devices) }
        return manager
    }

    /// Cancel button on `connectingDeviceOverlay` (fix round 1: the flow previously had no escape from an
    /// in-flight scan/connect). Tears down the attempt the same way `exitSession()` tears down BLE when
    /// leaving the flow entirely, and returns to `.modeSelect` — a deliberate cancel, not a reported
    /// failure, so `errorMessage` is cleared rather than set.
    public func cancelBLEConnect() {
        guard case .connectingDevice = machine.phase else { return }
        bleManager?.disconnect()
        errorMessage = nil
        machine.deviceConnectFailed()
    }

    /// Reacts to `PlaySenseDeviceManager.connectionStatus` changes pushed via its `onConnectionStatusChange`
    /// callback. Guarded to `.playsense` mode so a stale callback from a manager retained across a mode
    /// switch (there isn't one today, but the guard is cheap insurance) never touches the wrong flow.
    private func handleBLEStatusChange(_ status: BLEConnectionStatus) {
        guard audioMode == .playsense else { return }
        switch status {
        case .connected:
            if case .connectingDevice = machine.phase {
                machine.deviceConnected(hasCalibrationRecord: hasCalibrationRecord(for: .playsense))
                machine.calibrationResolved()
            }
            // else: reconnected mid-take (or between takes) — nothing further to do, grading just
            // resumes as new BLE readings arrive again.
        case .error:
            if machine.isActive {
                // The one auto-reconnect attempt (mirroring `playsense-context.tsx`'s `onDisconnected`)
                // was exhausted — web parity: pause (no further grading input arrives during the gap
                // above) then interrupt, offering `retry()` like any other disruption.
                abortTake(.bleDisconnected)
            } else if case .connectingDevice = machine.phase {
                errorMessage = bleManager?.errorMessage
                machine.deviceConnectFailed()
            }
        case .disconnected, .scanning, .connecting, .reconnecting:
            break
        }
    }

    /// Reacts to `PlaySenseDeviceManager.discoveredDevices` changes: a single match auto-connects (no
    /// picker); more than one leaves it for `DevicePickerSheet` (bound to `bleDiscoveredDevices`) via
    /// `selectBLEDevice(_:)`.
    private func handleBLEDevicesChange(_ devices: [PlaySenseDeviceManager.DiscoveredDevice]) {
        guard audioMode == .playsense, case .connectingDevice = machine.phase else { return }
        if let single = PlaySenseDeviceManager.autoSelectableDevice(among: devices) {
            bleManager?.connect(to: single)
        }
    }

    /// The user's choice from `DevicePickerSheet` (shown when more than one PlaySense device is found).
    public func selectBLEDevice(_ device: PlaySenseDeviceManager.DiscoveredDevice) {
        bleManager?.connect(to: device)
    }

    #if DEBUG
    /// Screenshot/testing seam: drives straight to `.connectingDevice` with two synthetic devices already
    /// "discovered" — self-contained, independent of `beginBLEModeSelect()`'s real scan. Uses
    /// `NoOpBLECentralManager` (not a real `CBCentralManager`) for the same reason `debugSyntheticBLESession`
    /// does — see its doc comment. Deterministically exercises/screenshots `DevicePickerSheet`'s
    /// multi-device path.
    public func debugShowPlaysenseDevicePicker() {
        audioMode = .playsense
        errorMessage = nil
        guard case .modeSelect = machine.phase else { return }
        machine.beginDeviceConnect()
        let manager = bleManager ?? makeBLEManager(central: NoOpBLECentralManager())
        bleManager = manager
        manager.wantsConnection = true
        manager.debugInjectDiscoveredDevices([
            PlaySenseDeviceManager.DiscoveredDevice(id: UUID(), name: "PlaySense"),
            PlaySenseDeviceManager.DiscoveredDevice(id: UUID(), name: "PlaySense")
        ])
    }

    /// Screenshot/testing seam for fix round 1 (D25's review, finding 2): forces `errorMessage` while
    /// sitting at `.modeSelect` — a deterministic stand-in for a real BLE connect failure bouncing back
    /// from `.connectingDevice` (`handleBLEStatusChange`'s `.error` branch), without needing a real or
    /// `NoOpBLECentralManager`-backed central to actually fail. Exercises/screenshots `modeSelectOverlay`'s
    /// newly-added error rendering.
    public func debugForceModeSelectError(_ message: String) {
        guard case .modeSelect = machine.phase else { return }
        errorMessage = message
    }
    #endif

    // MARK: - Start / stop

    /// Request mic permission (BEFORE configuring the session — D20 carry-forward), configure audio, and —
    /// unless a Bluetooth output route diverts to the blocking sheet — schedule the count-in + clicks,
    /// resolve `t0`, spin up the ``LiveScorer``, and begin the frame loop.
    ///
    /// Fix round 1 (D25's review, finding 1): in `.playsense` mode, first verifies the BLE connection is
    /// still `.connected` — a drop can happen silently while just sitting at the ready screen (no active
    /// take to abort into `.interrupted(.bleDisconnected)`). If it isn't, detours through `.connectingDevice`
    /// and re-kicks the connect flow instead of arming a take with `installBLEOnsetSource()` reading from a
    /// dead connection.
    public func startSession() async {
        guard case .ready = machine.phase, let exercise else { return }
        errorMessage = nil

        if needsBLEReconnectBeforeProceeding {
            machine.beginDeviceReconnect()
            guard case .connectingDevice = machine.phase else { return }
            reconnectBLE()
            return
        }

        // PlaySense mode never taps the mic (input comes over BLE) — matches the web's `startCalibrationFlow`/
        // `startExercise`, which only ever request mic listening for the two mic `AudioMode`s.
        if audioMode != .playsense {
            let granted = await sessionController.requestMicrophonePermission()
            guard granted else {
                errorMessage = "Microphone access is required to play."
                return
            }
        }

        let actual: AudioSessionController.ActualConfig
        do {
            actual = try sessionController.configure()
        } catch {
            errorMessage = "Couldn't start audio: \(error.localizedDescription)"
            return
        }

        // Bluetooth output can't be trusted for a graded take — divert to the blocking sheet (unless the
        // player already accepted practice mode).
        let route = sessionController.currentRouteInfo
        machine.requestStart(isBluetoothOutput: route.isBluetoothOutput)
        guard case .countdown = machine.phase else { return } // .bluetoothBlocked — wait for the sheet

        beginTake(exercise: exercise, actual: actual, route: route)
    }

    /// Accept the practice-mode escape from the Bluetooth-blocked sheet and start an unranked take.
    public func acceptPracticeMode() async {
        guard case .bluetoothBlocked = machine.phase, let exercise else { return }
        machine.acceptPracticeMode()
        let actual = sessionController.currentActualConfig()
        beginTake(exercise: exercise, actual: actual, route: sessionController.currentRouteInfo)
    }

    /// Dismiss the Bluetooth-blocked sheet without practicing.
    public func dismissBluetoothBlock() {
        machine.dismissBluetoothBlock()
    }

    private func beginTake(
        exercise: ExerciseDefinition,
        actual: AudioSessionController.ActualConfig,
        route: RouteInfo
    ) {
        resetTakeState()

        let calibration = CalibrationStore.effectiveCalibration(
            sourceType: audioMode == .playsense ? .ble : .mic,
            route: route,
            inputLatency: actual.inputLatency,
            outputLatency: actual.outputLatency,
            ioBufferDuration: actual.ioBufferDuration
        )

        let expected = generateExpectedTimestamps(exercise)
        expectedForSimulation = expected
        expectedEvents = expected
        exerciseDurationSeconds = getExerciseDuration(exercise)

        let beatsPerMeasure = exercise.timeSignature.numerator
        let countInBeats = beatsPerMeasure
        let totalBeats = exercise.measures * beatsPerMeasure * exercise.loopCount
        let clicks = MetronomeSchedule.clicks(
            bpm: exercise.bpm,
            beatsPerMeasure: beatsPerMeasure,
            countInBeats: countInBeats,
            exerciseBeats: totalBeats
        )

        let newEngine = GameAudioEngine(sampleRate: actual.sampleRate)
        newEngine.setBackingMode(audioMode.isSpeakerSafe ? .speakerSafe : .headphones)
        newEngine.prepare()

        let anchor: T0Anchor
        do {
            let countInDuration = MetronomeSchedule.countInDuration(bpm: exercise.bpm, countInBeats: countInBeats)
            anchor = try newEngine.start(t0Delay: countInDuration + 0.15, clicks: clicks)
        } catch {
            errorMessage = "Audio engine failed: \(error.localizedDescription)"
            newEngine.teardown()
            machine.reset()
            return
        }

        t0Seconds = anchor.hostSeconds
        engine = newEngine
        installScorerAndOnsetSource(exercise: exercise, calibration: calibration, expected: expected, engine: newEngine)
        startFrameLoop()
    }

    /// Build the ``LiveScorer`` for the resolved `t0`, then wire in whichever onset source this take's
    /// `audioMode` calls for — the mic tap (D21/D23) or, D25, the PlaySense BLE device. Count-in taps
    /// (before t0) are dropped by the scorer either way.
    private func installScorerAndOnsetSource(
        exercise: ExerciseDefinition,
        calibration: CalibrationRecord,
        expected: [ExpectedEvent],
        engine: GameAudioEngine
    ) {
        let realScheduler = RealDeferredScheduler(callbackQueue: .main)
        scheduler = realScheduler
        let liveScorer = LiveScorer(
            expectedEvents: expected,
            difficulty: exercise.difficulty,
            instrumentCategory: getInstrumentCategory(exercise.instrument),
            calibrationOffsetSec: calibration.offsetMs / 1000,
            widenMs: calibration.widenMs,
            t0Seconds: t0Seconds,
            scheduler: realScheduler
        )
        scorer = liveScorer

        if audioMode == .playsense {
            installBLEOnsetSource(instrument: exercise.instrument)
        } else {
            installMicOnsetSource(exercise: exercise, engine: engine, liveScorer: liveScorer)
        }
    }

    private func installMicOnsetSource(exercise: ExerciseDefinition, engine: GameAudioEngine, liveScorer: LiveScorer) {
        let config = getInstrumentConfig(exercise.instrument, noisyRoom: false, speakerSafe: audioMode.isSpeakerSafe)
        let source = MicOnsetEventSource(engine: engine, config: config)
        source.onOnset = { [weak self] event in self?.ingestOnset(event) }

        // Wire the live pitch/chroma path end-to-end (D23 fix round 1). Without this, on a real mic every
        // pitched note whose onset carried no detected frequency would hard-miss, and every chord would
        // grade with `nil` chroma. `pitchFrequencyProvider` is the +100 ms deferred re-read (the web's
        // `getFrequency()` at grade time); `chromaProvider` is the deferred post-strum chroma keyed by
        // `round(onsetTimestamp * 1000)` (the web's `chromaByOnsetRef`). Percussion never invokes these.
        liveScorer.pitchFrequencyProvider = { [weak source] in source?.currentPitch() }
        liveScorer.chromaProvider = { [weak source] key in source?.chroma(forOnsetKey: key) }

        source.start()
        onsetSource = source
        bleOnsetSource = nil
    }

    /// D25: PlaySense BLE input path. `bleManager` is reused from `beginBLEModeSelect()` (already
    /// connected by the time a take starts — this method never itself scans/connects); the mic tap is
    /// never installed in this mode, matching `use-exercise-session.ts`'s `activeOnsets = isPlaysenseMode
    /// ? bleOnsets : micOnsets` split (mutually exclusive, never both).
    ///
    /// Fix round 1: "already connected" is now an enforced invariant, not an assumption — `startSession()`'s
    /// `needsBLEReconnectBeforeProceeding` check runs before `machine.requestStart(...)` even attempts
    /// `.countdown`, so this method only ever runs once `bleConnectionStatus == .connected` (or the DEBUG
    /// synthetic-session bypass, which never touches this path's manager at all).
    private func installBLEOnsetSource(instrument: Instrument) {
        let manager = bleManager ?? makeBLEManager()
        bleManager = manager
        manager.wantsConnection = true

        let source = BLEOnsetSource(deviceManager: manager, instrument: instrument)
        source.onOnset = { [weak self] event in self?.ingestOnset(event) }
        source.onInputLevel = { [weak self] level in self?.inputLevel = level }
        source.start()
        onsetSource = source
        bleOnsetSource = source
    }

    private func ingestOnset(_ event: OnsetEvent) {
        guard machine.isActive else { return }
        // Track the last confidently-detected note (hook's `lastDetectedMidiRef`) as the last-resort
        // wrong-note catch when a later onset carries neither a frequency nor a live pitch reading.
        //
        // FIDELITY GAP vs. web: this only updates on an onset that itself carried a frequency, so between
        // onsets `lastDetectedMidiNote` can go stale. The web hook refreshes `lastDetectedMidiRef` at
        // ~60 Hz from the live pitch stream inside its rAF loop (`updatePlayhead`,
        // hooks/use-exercise-session.ts ~line 496: `pitchDetectionRef.current.getFrequency()` on every
        // frame while `instrumentCategory === 'pitched'`), so its fallback value at grade time
        // (~line 362) is generally fresher than what onset-only updates give us here. In practice this
        // rarely matters: `LiveScorer`'s `pitchFrequencyProvider` (this source's `currentPitch()`) already
        // covers the same +100 ms deferred re-read the web does first, so `lastDetectedMidiNote` is only
        // the LAST-resort fallback when that re-read also comes back nil. If pitched-exercise QA on
        // device shows stale fallback values causing wrong-note misgrades, the fix is to feed
        // `lastDetectedMidiNote` from a periodic `onsetSource?.currentPitch()` read on the
        // `CADisplayLink` tick (`onFrame()`, mirroring the web's rAF cadence) in addition to this
        // onset-driven update — not implemented here; this comment is a marker for that follow-up.
        // (Percussion, including every PlaySense BLE exercise, never sets `frequency`, so this is a
        // mic/pitched-instrument-only concern.)
        if let frequency = event.frequency {
            scorer?.lastDetectedMidiNote = frequencyToMidi(frequency)
        }
        scorer?.ingest(event)
        // BLE's `energy` is a raw piezo ADC value (0-4095), not the mic path's already-normalized
        // envelope — `min(1, event.energy)` would read ~1.0 for nearly every real hit. `inputLevel` for
        // PlaySense mode is instead driven by `BLEOnsetSource.onInputLevel`'s throttled `maxPiezo / 4095`
        // meter (wired in `installBLEOnsetSource`), computed on EVERY reading, not just onsets.
        if audioMode != .playsense {
            inputLevel = min(1, event.energy)
        }
    }

    /// Stop the current take and compute results (manual stop, or progress ≥ 1). Idempotent.
    public func stopSession() {
        guard case .playing = machine.phase else {
            // A stop requested during count-in just tears down without a results screen.
            if case .countdown = machine.phase { teardownAudio(); machine.reset() }
            return
        }
        finishTake()
    }

    private func finishTake() {
        guard let scorer else { return }
        let elapsed = GameClock.hostSeconds(fromTicks: GameClock.now()) - t0Seconds
        let duration = elapsed > 0 ? min(elapsed, exerciseDurationSeconds) : exerciseDurationSeconds
        let stats = scorer.finish(actualDurationSeconds: duration)
        finalResults = scorer.finalResults
        attemptStats = stats
        machine.finish(stats: stats)
        teardownAudio()
        if let exercise {
            persistAttemptIfNeeded(exerciseId: exercise.id, stats: stats, events: finalResults)
        }
    }

    /// D26: hand the just-finished take to the injected ``PlaySenseAttemptSink`` — unless this take
    /// ran in practice mode (the Bluetooth-blocked escape hatch), which the web has no equivalent of
    /// and is therefore never persisted (parity-safe: not writing beats writing an attempt shape the
    /// web could never have produced). `internal` (not `private`) for the same testability reason as
    /// `machine`/`bleManager`: `AttemptPersistenceTests` drives this directly instead of a real take
    /// (mic permission + a real `GameAudioEngine` make that environment-sensitive — see
    /// `SessionEndToEndSmokeTests`'s module doc).
    func persistAttemptIfNeeded(exerciseId: String, stats: AttemptStats, events: [EventResult]) {
        guard !machine.isPracticeMode else { return } // attemptPersistState stays .idle
        guard let attemptSink else { return } // no sink injected (DEBUG harnesses/previews) → .idle
        guard !hasPersistedCurrentAttempt else { return } // one persist call per take, no matter what
        hasPersistedCurrentAttempt = true
        attemptPersistState = .saving
        Task { @MainActor [weak self] in
            let outcome = await attemptSink.record(exerciseId: exerciseId, stats: stats, events: events)
            self?.attemptPersistState = outcome == .saved ? .saved : .queued
        }
    }

    /// Retry after results/interruption — re-arm to `ready`.
    ///
    /// Fix round 1 (D25's review, finding 1): in `.playsense` mode, first verifies the BLE connection is
    /// still `.connected` — most commonly reached via an exhausted-reconnect `.interrupted(.bleDisconnected)`,
    /// but any disruption could coincide with a drop. If it isn't, detours through `.connectingDevice` and
    /// re-kicks the connect flow instead of landing on `.ready` with no live input source at all (the bug:
    /// "Retry runs a take that silently grades nothing"). Web parity: `use-playsense-onsets.ts`'s
    /// `startListening()` performs this exact check at the top of EVERY `startExercise()` call, retries
    /// included. Clears any stale `errorMessage` either way (mirrors `startSession()`'s same clear).
    public func retry() {
        errorMessage = nil
        guard needsBLEReconnectBeforeProceeding else {
            machine.retry()
            return
        }
        machine.beginDeviceReconnect()
        guard case .connectingDevice = machine.phase else { return }
        reconnectBLE()
    }

    /// Leave the flow entirely.
    public func exitSession() {
        teardownAudio()
        if audioMode == .playsense {
            // Port of the web's `disconnect()` — leaving the flow entirely (not just finishing/retrying a
            // take) is the one point BLE actually disconnects; `teardownAudio()` between takes only
            // unsubscribes `BLEOnsetSource` from readings; see its doc comment.
            bleManager?.disconnect()
        }
        machine.reset()
        exercise = nil
    }
}
// swiftlint:enable type_body_length

// MARK: - Frame loop (CADisplayLink), session events, teardown

extension SessionCoordinator {
    private func startFrameLoop() {
        stopFrameLoop()
        let driver = DisplayLinkDriver { [weak self] in self?.onFrame() }
        driver.start()
        frameDriver = driver
    }

    private func stopFrameLoop() {
        frameDriver?.stop()
        frameDriver = nil
    }

    private func onFrame() {
        let now = GameClock.hostSeconds(fromTicks: GameClock.now())
        let elapsed = now - t0Seconds

        switch machine.phase {
        case .countdown:
            // Count-in beat readout, derived purely from elapsed time (never the scheduler).
            let beatsPerMeasure = exercise?.timeSignature.numerator ?? 4
            let bpm = exercise?.bpm ?? 100
            let countInBeats = beatsPerMeasure
            let countInDuration = MetronomeSchedule.countInDuration(bpm: bpm, countInBeats: countInBeats)
            if elapsed >= 0 {
                machine.beginPlaying()
                countdownBeat = 0
            } else {
                let sinceCountInStart = elapsed + countInDuration
                let readout = MetronomeSchedule.beatReadout(
                    elapsedSeconds: max(0, sinceCountInStart),
                    bpm: bpm,
                    beatsPerMeasure: beatsPerMeasure
                )
                countdownBeat = readout.beatInMeasure
            }
        case .playing:
            let progress = exerciseDurationSeconds > 0 ? min(elapsed / exerciseDurationSeconds, 1) : 1
            playheadProgress = progress

            #if DEBUG
            injectDueSyntheticOnsets(elapsed: elapsed)
            injectDueSyntheticBLEReadings(elapsed: elapsed)
            #endif

            scorer?.checkTentativeMisses(elapsedSeconds: elapsed)
            throttledHUD()

            if progress >= 1 {
                finishTake()
            }
        default:
            break
        }
    }

    private func throttledHUD() {
        let now = CACurrentMediaTime()
        guard now - lastHudUpdate >= Self.hudInterval else { return }
        lastHudUpdate = now
        guard let scorer else { return }
        hudScore = scorer.currentScore
        hudCombo = scorer.currentCombo
        hudAccuracy = scorer.currentAccuracy
        hudLastGrade = scorer.lastHitGrade
        hudResults = scorer.snapshot.results
    }

    #if DEBUG
    private func injectDueSyntheticOnsets(elapsed: Double) {
        guard let offsetMs = debugAutoPlayOffsetMs else { return }
        for event in expectedForSimulation where !injectedSimulationIndices.contains(event.eventIndex) {
            guard elapsed >= event.timestamp else { continue }
            injectedSimulationIndices.insert(event.eventIndex)
            let onsetTimestamp = t0Seconds + event.timestamp + offsetMs / 1000
            scorer?.ingest(OnsetEvent(
                timestamp: onsetTimestamp,
                energy: 1,
                frequency: event.expectedPitch.map { 440 * pow(2, (Double($0) - 69) / 12) },
                surface: event.expectedSurface
            ))
        }
    }

    /// D25 simulator seam: the BLE analogue of `injectDueSyntheticOnsets` above, but — unlike that
    /// method, which hand-builds an `OnsetEvent` directly (bypassing any onset source) — this drives the
    /// REAL `BLEOnsetSource.debugInject(reading:)` path, so the surface-mapping code that would run for a
    /// live hardware hit actually runs here too. Only fires perfect-timed hits (no offset parameter, unlike
    /// the mic seam's `debugAutoPlayOffsetMs`): the injection happens the instant `elapsed` crosses the
    /// expected timestamp, and `BLEOnsetSource` stamps the resulting `OnsetEvent` with `GameClock.now()` at
    /// that exact moment — i.e. the real "notification arrival time" stamping path, not a hand-computed
    /// offset.
    private func injectDueSyntheticBLEReadings(elapsed: Double) {
        guard debugSyntheticBLESession, let bleOnsetSource, let instrument = exercise?.instrument else { return }
        for event in expectedForSimulation where !injectedSimulationIndices.contains(event.eventIndex) {
            guard elapsed >= event.timestamp else { continue }
            injectedSimulationIndices.insert(event.eventIndex)
            guard
                let surface = event.expectedSurface,
                let index = Self.piezoIndex(forSurface: surface, instrument: instrument)
            else { continue }
            var piezos = [Double](repeating: 0, count: index + 1)
            piezos[index] = 2000 // representative mid-scale ADC hit value
            bleOnsetSource.debugInject(reading: PlaySenseBLEReading(piezos: piezos))
        }
    }

    /// Reverse lookup into `PlaySenseMapping.piezoMap` (surface name → piezo channel index) — the debug
    /// injector needs to go the OPPOSITE direction from `BLEOnsetSource`'s real forward mapping, since it's
    /// synthesizing the RAW reading a real hit on that surface would have produced.
    private static func piezoIndex(forSurface surface: String, instrument: Instrument) -> Int? {
        getPlaySenseMapping(instrument.rawValue)?.piezoMap.first(where: { $0.value == surface })?.key
    }
    #endif

    // MARK: - Session events (interruption / route)

    private func handleSessionEvent(_ event: AudioSessionEvent) {
        switch event {
        case .interruption(.began):
            abortTake(.audioInterruption)
        case .routeChanged:
            abortTake(.routeChanged)
        case .interruption(.ended), .mediaServicesReset:
            break
        }
    }

    /// SwiftUI `scenePhase` → `.background` bridge (see `CalibrationWizardModel.handleBackgrounding`).
    public func handleBackgrounding() {
        abortTake(.backgrounded)
    }

    /// SwiftUI `scenePhase` → `.active` bridge (D26): opportunistically flushes any attempts still
    /// stuck in the offline queue from a previous failed save. Fire-and-forget; never blocks the UI,
    /// and a no-op whenever no sink is injected.
    public func handleForegrounding() {
        guard let attemptSink else { return }
        Task { @MainActor in await attemptSink.drainPending() }
    }

    private func abortTake(_ reason: SessionInterruption) {
        guard machine.isActive else { return }
        machine.interrupt(reason)
        teardownAudio()
    }

    // MARK: - Teardown

    private func resetTakeState() {
        playheadProgress = 0
        countdownBeat = 0
        hudScore = 0
        hudCombo = 0
        hudAccuracy = 0
        hudLastGrade = nil
        inputLevel = 0
        lastHudUpdate = 0
        finalResults = []
        attemptStats = nil
        hudResults = []
        injectedSimulationIndices.removeAll()
        hasPersistedCurrentAttempt = false
        attemptPersistState = .idle
    }

    #if DEBUG
    /// Inject one synthetic onset `offsetMs` from now — a manual "tap" for the debug stage (no Simulator
    /// mic). Routes through the same `LiveScorer.ingest` path a real onset would.
    public func debugTap(offsetMs: Double = 0) {
        guard machine.isActive else { return }
        let now = GameClock.hostSeconds(fromTicks: GameClock.now())
        scorer?.ingest(OnsetEvent(timestamp: now + offsetMs / 1000, energy: 1))
    }
    #endif

    /// Ends the CURRENT TAKE's engine/scorer/onset-source lifecycle. For BLE, `onsetSource?.stop()` only
    /// unsubscribes `BLEOnsetSource` from `bleManager`'s readings — it does NOT disconnect the underlying
    /// CoreBluetooth connection, which persists across retries (matching the mic path not re-requesting
    /// permission every take). The BLE connection itself is only torn down by `exitSession()`.
    private func teardownAudio() {
        stopFrameLoop()
        scheduler?.cancelAll()
        onsetSource?.stop()
        onsetSource = nil
        bleOnsetSource = nil
        engine?.teardown()
        engine = nil
        scheduler = nil
        scorer = nil
        sessionController.deactivate()
    }
}
