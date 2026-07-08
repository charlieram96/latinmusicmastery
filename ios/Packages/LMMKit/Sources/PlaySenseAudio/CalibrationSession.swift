import Foundation
import PlaySenseCore

/// The calibration wizard's UI-facing phase — `intro` (before the take has been scheduled) →
/// `countingIn` (the 4-beat lead-in) → `tapping` (the 16 measured beats) → `result` (computed, terminal)
/// — with `interrupted` reachable from `intro`/`countingIn`/`tapping` (via `interrupt(reason:)`) as a
/// SEPARATE terminal outcome: an audio-session disruption mid-take, not a computed result.
public enum CalibrationPhase: Equatable, Sendable {
    case intro
    /// `beat` is `0` before the first count-in click has sounded, else `1...countInBeats`.
    case countingIn(beat: Int)
    /// `beat` is `1...measuredBeats` — the most recent measured click that has sounded.
    case tapping(beat: Int)
    case result(CalibrationOutcome)
    /// The take was aborted by an audio-session disruption before a result could be computed — see
    /// `interrupt(reason:)`. Terminal, like `.result`, but deliberately distinct from it: no
    /// `CalibrationOutcome` (successful or otherwise) exists for an interrupted take, so there is
    /// nothing a wizard could offer to persist.
    case interrupted(CalibrationInterruptionReason)
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
    /// phases (matching the web's listener lifetime); once `phase` is `.intro` (not yet started),
    /// `.result` (finished), or `.interrupted` (aborted), taps are ignored.
    public func recordOnset(_ event: OnsetEvent) {
        switch phase {
        case .intro, .result, .interrupted:
            return
        case .countingIn, .tapping:
            onsetTimestamps.append(event.timestamp)
        }
    }

    /// Abort the take because of an audio-session disruption (a phone-call-style interruption
    /// beginning, a route change, or the app backgrounding — see `CalibrationInterruptionReason`),
    /// moving to the terminal `.interrupted` phase instead of letting `tick`/`recordOnset` keep running
    /// against audio that may no longer be playing. A no-op once `.result` has already been reached: a
    /// completed outcome — and anything the wizard has since persisted from it — is NEVER retroactively
    /// discarded by an interruption arriving after the fact.
    public func interrupt(reason: CalibrationInterruptionReason) {
        guard case .result = phase else {
            phase = .interrupted(reason)
            return
        }
    }

    /// Advance the state machine to reflect the current host-seconds clock reading. Idempotent once
    /// `.result` or `.interrupted` is reached (both are terminal).
    public func tick(now: Double) {
        switch phase {
        case .result, .interrupted:
            return
        default:
            break
        }

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
    ///
    /// ## Why this exists — a genuine algorithmic divergence from the web, not just a "large `t0`" quirk
    /// The web's beat counter (`hooks/use-calibration.ts`'s `setInterval` callback) is an INCREMENTAL
    /// ACCUMULATOR: `nextBeatTimeRef` starts at `recordStart` and each tick only compares `now` against
    /// that single running target, advancing it by exactly one `beatDuration` (`nextBeatTimeRef.current
    /// += beatDuration`) when crossed. It never recomputes a beat INDEX from scratch, so it structurally
    /// cannot floor to the wrong beat — each step is a fresh `>=` comparison against a value built by
    /// repeated addition, not a division.
    ///
    /// This port is STATELESS by design instead (`tick(now:)` derives the beat fresh from `now` every
    /// call, with no per-beat mutable target to drift) — which is what makes `CalibrationSession`
    /// idempotent/backwards-tick-safe (see `testResultIsTerminalAndIdempotent`) but ALSO means it must
    /// floor a division (`elapsed / beatDuration`) instead of accumulate. `elapsed = now - countInStart`
    /// (or `- recordStart`) is a subtraction of two close-in-magnitude doubles; when `beatDuration`
    /// (0.6s here) isn't exactly representable in binary floating point, that division can land a
    /// fraction of a ULP under an exact beat boundary and floor one beat EARLY. This is NOT specific to
    /// large `t0` magnitudes (it can happen at `t0 == 0` too) — it is an inherent property of
    /// "stateless recompute via floor-division" versus "stateful accumulate via repeated addition"; large
    /// `t0` (seconds-since-boot on a real device) just makes the affected ULP fraction larger and thus
    /// more likely to matter, which is how `testCountingInAdvancesPerBeatAcrossFourBeats`'s `t0 = 100.0`
    /// fixture happened to surface it during TDD.
    ///
    /// The epsilon (1 µs — far below any timing granularity that matters for a UI beat counter, far
    /// above the floating-point noise this is guarding against even at large magnitudes) makes the floor
    /// robust to that without affecting real inputs. It does NOT change which architecture this is: still
    /// a stateless recompute, just one nudged to tolerate its own rounding noise. Switching to the web's
    /// accumulator style would sidestep the class of bug entirely, but was judged not worth the added
    /// mutable state here given this only drives a UI beat counter (never `LatencyCalibrator.compute`'s
    /// grading math, which does no floor/rounding on timestamps at all).
    private static func beatIndex(elapsed: Double, beatDuration: Double) -> Int {
        Int(((elapsed + 1e-6) / beatDuration).rounded(.down))
    }
}
