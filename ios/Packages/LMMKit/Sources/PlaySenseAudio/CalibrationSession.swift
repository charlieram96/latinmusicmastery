import Foundation
import PlaySenseCore

/// The calibration wizard's UI-facing phase — `intro` (before the take has been scheduled) →
/// `countingIn` (the 4-beat lead-in) → `tapping` (the 16 measured beats) → `result` (computed, terminal).
public enum CalibrationPhase: Equatable, Sendable {
    case intro
    /// `beat` is `0` before the first count-in click has sounded, else `1...countInBeats`.
    case countingIn(beat: Int)
    /// `beat` is `1...measuredBeats` — the most recent measured click that has sounded.
    case tapping(beat: Int)
    case result(CalibrationOutcome)
}

/// Pure state machine driving one calibration take: given a resolved `t0` (host-seconds, from
/// `GameAudioEngine.start`), it derives the wizard's `CalibrationPhase` from an injected "now" reading
/// (`tick(now:)`) and collects onset timestamps (`recordOnset(_:)`) throughout the count-in AND the
/// tapping window — mirroring the web's onset listener, which is wired up for the WHOLE calibration
/// take, not just the "tapping" UI state (`LatencyCalibrator.compute`'s nearest-expected-click match +
/// 0.2s gate is what actually discards early/stray taps, exactly as on the web).
///
/// No wall-clock/timer reads happen inside this type — every transition is driven by the `now` the
/// caller passes in, so wizard transitions are fully deterministic in tests. `CalibrationRunner` is the
/// engine-glue layer that supplies real `GameClock` readings and forwards onsets from an
/// `OnsetEventSource`.
public final class CalibrationSession {
    public private(set) var phase: CalibrationPhase = .intro

    /// Host-seconds instant of the first measured (recording) click — this session's `t0`.
    public let recordStart: Double
    /// Host-seconds instant of the first count-in click.
    public let countInStart: Double
    /// The 16 expected (host-seconds) measured-beat click times.
    public let expectedTimes: [Double]
    public let routeKey: String
    public let sourceType: CalibrationSourceType

    private var onsetTimestamps: [Double] = []
    private let beatDuration = LatencyCalibrator.beatDuration
    /// Port of the web's completion condition's trailing grace: `now > recordStart + 16*beatDuration + 0.5`.
    private static let completionGraceSeconds = 0.5

    public init(t0 t0Seconds: Double, routeKey: String, sourceType: CalibrationSourceType) {
        self.recordStart = t0Seconds
        self.countInStart = t0Seconds - Double(LatencyCalibrator.countInBeats) * LatencyCalibrator.beatDuration
        self.expectedTimes = LatencyCalibrator.expectedTimes(t0: t0Seconds)
        self.routeKey = routeKey
        self.sourceType = sourceType
    }

    /// Record an onset timestamp (host-seconds). Taps are collected throughout the count-in and tapping
    /// phases (matching the web's listener lifetime); once `phase` is `.intro` (not yet started) or
    /// `.result` (finished), taps are ignored.
    public func recordOnset(_ event: OnsetEvent) {
        switch phase {
        case .intro, .result:
            return
        case .countingIn, .tapping:
            onsetTimestamps.append(event.timestamp)
        }
    }

    /// Advance the state machine to reflect the current host-seconds clock reading. Idempotent once
    /// `.result` is reached (a `CalibrationSession` computes its outcome exactly once).
    public func tick(now: Double) {
        if case .result = phase { return }

        guard now >= countInStart else {
            phase = .intro
            return
        }

        guard now >= recordStart else {
            let elapsed = now - countInStart
            let beatIndex = Self.beatIndex(elapsed: elapsed, beatDuration: beatDuration)
            phase = .countingIn(beat: min(LatencyCalibrator.countInBeats, beatIndex + 1))
            return
        }

        let elapsed = now - recordStart
        let measuredBeat = Self.beatIndex(elapsed: elapsed, beatDuration: beatDuration) + 1
        guard measuredBeat > LatencyCalibrator.measuredBeats else {
            phase = .tapping(beat: measuredBeat)
            return
        }

        let recordingDuration = Double(LatencyCalibrator.measuredBeats) * beatDuration
        guard now > recordStart + recordingDuration + Self.completionGraceSeconds else {
            phase = .tapping(beat: LatencyCalibrator.measuredBeats)
            return
        }

        let outcome = LatencyCalibrator.compute(
            expectedTimes: expectedTimes,
            onsetTimestamps: onsetTimestamps,
            routeKey: routeKey,
            sourceType: sourceType
        )
        phase = .result(outcome)
    }

    /// `Int((elapsed / beatDuration).rounded(.down))`, but nudged by a microsecond-scale epsilon first.
    /// Host-seconds "now" readings are often large-magnitude doubles (seconds since boot, easily in the
    /// tens of thousands on a real device), so subtracting two close-in-magnitude large doubles to get
    /// `elapsed` can round DOWN by a fraction of a ULP even when the true elapsed time is exactly on a
    /// beat boundary — which would floor to one beat EARLY. The epsilon (1 µs — far below any timing
    /// granularity that matters for a UI beat counter, far above the ~1e-11s rounding noise at even
    /// million-second magnitudes) makes the floor robust to that without affecting real inputs.
    private static func beatIndex(elapsed: Double, beatDuration: Double) -> Int {
        Int(((elapsed + 1e-6) / beatDuration).rounded(.down))
    }
}
