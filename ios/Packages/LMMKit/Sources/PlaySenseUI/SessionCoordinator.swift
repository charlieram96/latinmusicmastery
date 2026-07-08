import Foundation
import Observation
import PlaySenseAudio
import PlaySenseCore
import QuartzCore

// The one cohesive orchestration unit (a faithful port of the 837-line `use-exercise-session.ts` lifecycle);
// its methods share private engine/scorer/machine state, so splitting across files would force that state
// internal. Kept in one file with a documented length exception instead.
// swiftlint:disable file_length

/// The playable core of PlaySense: orchestrates ``GameAudioEngine`` + ``AudioSessionController`` +
/// ``MicOnsetEventSource`` + ``LiveScorer`` into a graded exercise session, driving the pure
/// ``SessionPhaseMachine`` from real audio/clock events. Port of `hooks/use-exercise-session.ts`'s
/// lifecycle (`startExercise`/`updatePlayhead`/`finishExercise`) minus the highway (D24), BLE (D25), and
/// attempt persistence (D26). One `CADisplayLink` drives the count-in beat, playhead, tentative-miss loop,
/// and the ~10 Hz HUD throttle — the analogue of the hook's `requestAnimationFrame(updatePlayhead)`.
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

    /// The final results once a take reaches `.results` (in-memory only — persistence is D26).
    public private(set) var finalResults: [EventResult] = []
    public private(set) var attemptStats: AttemptStats?

    /// The full expected-event timeline for the current take (for the debug stage's upcoming-events list).
    public private(set) var expectedEvents: [ExpectedEvent] = []
    /// Live graded results, refreshed on the ~10 Hz HUD tick — the timeline of what has been graded so far.
    public private(set) var hudResults: [EventResult] = []

    #if DEBUG
    /// Simulator seam: when set before `startSession()`, synthetic onsets are injected for each expected
    /// event as its time passes, so a full session grades deterministically with no mic (Simulator has none).
    public var debugAutoPlayOffsetMs: Double?
    #endif

    // MARK: - Collaborators

    private let sessionController: AudioSessionController
    private var engine: GameAudioEngine?
    private var onsetSource: MicOnsetEventSource?
    private var scorer: LiveScorer?
    private var scheduler: RealDeferredScheduler?
    private var frameDriver: DisplayLinkDriver?

    private var machine = SessionPhaseMachine() {
        didSet { phase = machine.phase }
    }

    private var t0Seconds: Double = 0
    private var exerciseDurationSeconds: Double = 0
    private var lastHudUpdate: CFTimeInterval = 0
    private var expectedForSimulation: [ExpectedEvent] = []
    private var injectedSimulationIndices = Set<Int>()

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

    /// Choose the audio mode and evaluate the calibration gate for the current route.
    public func selectMode(_ mode: SessionAudioMode) {
        audioMode = mode
        machine.selectMode(hasCalibrationRecord: hasCalibrationRecord(for: mode))
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

    // MARK: - Start / stop

    /// Request mic permission (BEFORE configuring the session — D20 carry-forward), configure audio, and —
    /// unless a Bluetooth output route diverts to the blocking sheet — schedule the count-in + clicks,
    /// resolve `t0`, spin up the ``LiveScorer``, and begin the frame loop.
    public func startSession() async {
        guard case .ready = machine.phase, let exercise else { return }
        errorMessage = nil

        let granted = await sessionController.requestMicrophonePermission()
        guard granted else {
            errorMessage = "Microphone access is required to play."
            return
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
        installScorerAndMic(exercise: exercise, calibration: calibration, expected: expected, engine: newEngine)
        startFrameLoop()
    }

    /// Build the ``LiveScorer`` for the resolved `t0` and wire the mic tap → onset source into it. Count-in
    /// taps (before t0) are dropped by the scorer; a live pitch/chroma stream is D24+'s concern.
    private func installScorerAndMic(
        exercise: ExerciseDefinition,
        calibration: CalibrationRecord,
        expected: [ExpectedEvent],
        engine: GameAudioEngine
    ) {
        let realScheduler = RealDeferredScheduler(callbackQueue: .main)
        scheduler = realScheduler
        scorer = LiveScorer(
            expectedEvents: expected,
            difficulty: exercise.difficulty,
            instrumentCategory: getInstrumentCategory(exercise.instrument),
            calibrationOffsetSec: calibration.offsetMs / 1000,
            widenMs: calibration.widenMs,
            t0Seconds: t0Seconds,
            scheduler: realScheduler
        )
        let config = getInstrumentConfig(exercise.instrument, noisyRoom: false, speakerSafe: audioMode.isSpeakerSafe)
        let source = MicOnsetEventSource(engine: engine, config: config)
        source.onOnset = { [weak self] event in self?.ingestOnset(event) }
        source.start()
        onsetSource = source
    }

    private func ingestOnset(_ event: OnsetEvent) {
        guard machine.isActive else { return }
        scorer?.ingest(event)
        inputLevel = min(1, event.energy)
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
    }

    /// Retry after results/interruption — re-arm to `ready`.
    public func retry() {
        machine.retry()
    }

    /// Leave the flow entirely.
    public func exitSession() {
        teardownAudio()
        machine.reset()
        exercise = nil
    }
}

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

    private func teardownAudio() {
        stopFrameLoop()
        scheduler?.cancelAll()
        onsetSource?.stop()
        onsetSource = nil
        engine?.teardown()
        engine = nil
        scheduler = nil
        scorer = nil
        sessionController.deactivate()
    }
}
