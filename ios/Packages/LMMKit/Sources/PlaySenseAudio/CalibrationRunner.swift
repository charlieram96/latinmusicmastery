import Foundation
import PlaySenseCore

/// Engine glue: ties `GameAudioEngine` (D20) + `MetronomeSchedule`'s click track + a `CalibrationSession`
/// (pure) + an `OnsetEventSource` together into "run one calibration take end-to-end." Owns a 25 ms
/// polling timer (matching the web's look-ahead interval) that advances the session's phase from
/// `GameClock` — the ONLY per-tick real-clock read in the whole D22 stack; everything downstream of it
/// (`CalibrationSession.tick`) is pure and already covered by its own deterministic tests.
@MainActor
public final class CalibrationRunner {
    /// The active session, once `start()` has resolved `t0`. `nil` before the first `start()` call.
    public private(set) var session: CalibrationSession?
    /// Invoked (main actor) every poll tick with the session's current phase.
    public var onPhaseChange: ((CalibrationPhase) -> Void)?

    private let engine: GameAudioEngine
    private let onsetSource: OnsetEventSource
    private let routeKey: String
    private let sourceType: CalibrationSourceType
    private var pollTimer: Timer?

    /// Matches the web's `setInterval(..., 25)` look-ahead cadence.
    private static let pollInterval: TimeInterval = 0.025

    public init(
        engine: GameAudioEngine,
        onsetSource: OnsetEventSource,
        routeKey: String,
        sourceType: CalibrationSourceType
    ) {
        self.engine = engine
        self.onsetSource = onsetSource
        self.routeKey = routeKey
        self.sourceType = sourceType
    }

    /// Schedule the count-in + 16 measured clicks, resolve `t0`, start the onset source, and begin
    /// polling. Throws if the engine fails to start (propagated from `GameAudioEngine.start`).
    public func start() throws {
        stop() // guard against a double-start leaking a prior session/timer

        let clicks = MetronomeSchedule.clicks(
            bpm: LatencyCalibrator.bpm,
            beatsPerMeasure: 4,
            countInBeats: LatencyCalibrator.countInBeats,
            exerciseBeats: LatencyCalibrator.measuredBeats
        )
        let anchor = try engine.start(t0Delay: 0.05, clicks: clicks)
        let newSession = CalibrationSession(t0: anchor.hostSeconds, routeKey: routeKey, sourceType: sourceType)
        session = newSession

        onsetSource.onOnset = { [weak newSession] event in newSession?.recordOnset(event) }
        onsetSource.start()

        // `Timer`'s callback closure type is not itself MainActor-isolated (even though it always fires
        // on the main run loop here, via `RunLoop.main.add`), so hop explicitly rather than call the
        // isolated `pollTick()` directly from it.
        let timer = Timer(timeInterval: Self.pollInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.pollTick() }
        }
        RunLoop.main.add(timer, forMode: .common)
        pollTimer = timer
    }

    /// Stop the poll timer and the onset source. Idempotent. Does NOT tear down the `GameAudioEngine`
    /// itself — the caller owns its lifecycle (a calibration take shares the engine with the rest of a
    /// PlaySense session in later tasks).
    public func stop() {
        pollTimer?.invalidate()
        pollTimer = nil
        onsetSource.stop()
    }

    /// DEBUG/simulator hook: injects a synthetic onset `offsetMs` after the CURRENTLY nearest expected
    /// click, bypassing the mic entirely. Exercises the exact same `CalibrationSession.recordOnset` path
    /// a real tap would — used both by the debug screen (so the wizard is exercisable/screenshottable on
    /// the Simulator, which has no usable mic input) and as this feature's automated-test seam (the
    /// underlying `CalibrationSession`/`LatencyCalibrator` calls this drives are covered directly by
    /// `CalibrationSessionTests`).
    public func simulateTap(offsetMs: Double) {
        guard let session else { return }
        let now = GameClock.hostSeconds(fromTicks: GameClock.now())
        guard let nearest = session.expectedTimes.min(by: { abs($0 - now) < abs($1 - now) }) else { return }
        let timestamp = nearest + offsetMs / 1000
        session.recordOnset(OnsetEvent(timestamp: timestamp, energy: 1))
    }

    private func pollTick() {
        guard let session else { return }
        session.tick(now: GameClock.hostSeconds(fromTicks: GameClock.now()))
        onPhaseChange?(session.phase)
        if case .result = session.phase {
            stop()
        }
    }
}
