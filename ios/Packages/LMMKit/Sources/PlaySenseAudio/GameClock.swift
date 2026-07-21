import AVFoundation
import Foundation

// MARK: - Host timebase

/// A pure, injectable model of the Mach host timebase (`mach_timebase_info`).
///
/// The host clock counts in opaque "ticks" (`mach_absolute_time()`); converting to seconds requires
/// the platform's `numer/denom` ratio (nanoseconds = ticks × numer ÷ denom). Wrapping it in a value
/// type lets the conversion math be unit-tested with synthetic ratios instead of whatever the test
/// host happens to run on.
public struct HostTimebase: Equatable, Sendable {
    public let numer: UInt32
    public let denom: UInt32

    public init(numer: UInt32, denom: UInt32) {
        precondition(numer != 0 && denom != 0, "timebase numer/denom must be non-zero")
        self.numer = numer
        self.denom = denom
    }

    /// The real platform timebase (queried once from the kernel).
    public static let system: HostTimebase = {
        var info = mach_timebase_info()
        mach_timebase_info(&info)
        return HostTimebase(numer: info.numer, denom: info.denom)
    }()

    /// Convert an interval expressed in host ticks to seconds.
    public func seconds(fromTicks ticks: UInt64) -> Double {
        Double(ticks) * Double(numer) / Double(denom) / 1_000_000_000.0
    }

    /// Convert a (non-negative) interval in seconds to host ticks, rounded to nearest.
    public func ticks(fromSeconds seconds: Double) -> UInt64 {
        precondition(seconds >= 0, "use signed helpers for negative intervals")
        let ticks = seconds * 1_000_000_000.0 * Double(denom) / Double(numer)
        return UInt64(ticks.rounded())
    }
}

// MARK: - Anchor math

/// A single (host-time, output-sample-time) correspondence sampled from a running engine, e.g. an
/// `AVAudioNode.lastRenderTime`. It ties the two clocks together so either coordinate of any other
/// instant can be derived.
public struct RenderAnchor: Equatable, Sendable {
    public let hostTicks: UInt64
    public let sampleTime: Int64
    public let sampleRate: Double

    public init(hostTicks: UInt64, sampleTime: Int64, sampleRate: Double) {
        self.hostTicks = hostTicks
        self.sampleTime = sampleTime
        self.sampleRate = sampleRate
    }
}

/// The resolved start instant of an exercise, expressed in every coordinate a downstream stage needs.
///
/// `t0` is the exercise-start boundary: the first expected event (per `generateExpectedTimestamps`)
/// lands at `t0`, the metronome count-in occupies `[t0 − countInDuration, t0)`, and backing stems
/// start at `t0`. D21's onset timestamps and D23's grading both convert through this anchor, so it
/// must be resolvable to BOTH a host-time reference and an output sample position.
public struct T0Anchor: Equatable, Sendable {
    /// Host-clock ticks (`mach_absolute_time` domain) at the exercise-start boundary.
    public let hostTicks: UInt64
    /// The same instant in seconds (host-tick interval since kernel boot) — a monotonic reference.
    public let hostSeconds: Double
    /// The sample position at the exercise-start boundary on the MAIN-MIXER render timeline (the clock
    /// `resolveAnchor()` samples from `mainMixerNode.lastRenderTime`). Named for that timeline so a
    /// downstream stage cannot mistake it for the input-node or output-node sample domain.
    public let mixerSampleTime: Int64
    public let sampleRate: Double

    public init(hostTicks: UInt64, hostSeconds: Double, mixerSampleTime: Int64, sampleRate: Double) {
        self.hostTicks = hostTicks
        self.hostSeconds = hostSeconds
        self.mixerSampleTime = mixerSampleTime
        self.sampleRate = sampleRate
    }
}

/// Pure host-time ⇄ output-sample-time conversions. All math is expressed on primitives so it can be
/// exercised with synthetic anchors and timebases; the only stateful entry point is `now()`.
public enum GameClock {

    /// Current host-clock ticks. This is the grading clock's canonical "now".
    public static func now() -> UInt64 { mach_absolute_time() }

    /// The output sample position corresponding to `targetHostTicks`, extrapolated from `anchor`.
    ///
    /// `sampleTime = anchorSampleTime + Δseconds × sampleRate`, where `Δseconds` is the (signed)
    /// host-tick interval between the anchor and the target.
    public static func outputSampleTime(
        forHostTicks targetHostTicks: UInt64,
        anchor: RenderAnchor,
        timebase: HostTimebase = .system
    ) -> Double {
        let deltaSeconds = signedSeconds(from: anchor.hostTicks, to: targetHostTicks, timebase: timebase)
        return Double(anchor.sampleTime) + deltaSeconds * anchor.sampleRate
    }

    /// The host-tick instant corresponding to a given output `sampleTime`, the inverse of the above.
    public static func hostTicks(
        forSampleTime sampleTime: Double,
        anchor: RenderAnchor,
        timebase: HostTimebase = .system
    ) -> UInt64 {
        let deltaSeconds = (sampleTime - Double(anchor.sampleTime)) / anchor.sampleRate
        return offsetHostTicks(anchor.hostTicks, bySeconds: deltaSeconds, timebase: timebase)
    }

    /// Signed seconds from `startTicks` to `endTicks` (negative if the target precedes the anchor).
    /// UInt64 subtraction never underflows because the larger operand is always the minuend.
    public static func signedSeconds(
        from startTicks: UInt64,
        to endTicks: UInt64,
        timebase: HostTimebase = .system
    ) -> Double {
        if endTicks >= startTicks {
            return timebase.seconds(fromTicks: endTicks - startTicks)
        } else {
            return -timebase.seconds(fromTicks: startTicks - endTicks)
        }
    }

    /// Add a signed second interval to a host-tick instant.
    public static func offsetHostTicks(
        _ base: UInt64,
        bySeconds seconds: Double,
        timebase: HostTimebase = .system
    ) -> UInt64 {
        if seconds >= 0 {
            return base &+ timebase.ticks(fromSeconds: seconds)
        } else {
            return base &- timebase.ticks(fromSeconds: -seconds)
        }
    }

    /// Resolve a `T0Anchor` from a target host-tick instant plus a render anchor.
    public static func resolveT0(
        atHostTicks targetHostTicks: UInt64,
        anchor: RenderAnchor,
        timebase: HostTimebase = .system
    ) -> T0Anchor {
        let sample = outputSampleTime(forHostTicks: targetHostTicks, anchor: anchor, timebase: timebase)
        return T0Anchor(
            hostTicks: targetHostTicks,
            hostSeconds: timebase.seconds(fromTicks: targetHostTicks),
            mixerSampleTime: Int64(sample.rounded()),
            sampleRate: anchor.sampleRate
        )
    }

    /// Absolute host-clock seconds for a host-tick reading — the same monotonic domain as
    /// `T0Anchor.hostSeconds`. D21's mic tap converts each input buffer's `AVAudioTime.hostTime`
    /// through this so onset timestamps line up with `t0` (and therefore with D23 grading) without
    /// ever touching a raw sample-time integer.
    public static func hostSeconds(fromTicks ticks: UInt64, timebase: HostTimebase = .system) -> Double {
        timebase.seconds(fromTicks: ticks)
    }
}

// MARK: - AVAudioTime bridging

extension AVAudioTime {
    /// A render anchor captured from this `AVAudioTime` (must carry both a valid host time and a
    /// valid sample time — as a node's `lastRenderTime` does once the engine is rendering).
    var renderAnchor: RenderAnchor? {
        guard isHostTimeValid, isSampleTimeValid else { return nil }
        return RenderAnchor(hostTicks: hostTime, sampleTime: sampleTime, sampleRate: sampleRate)
    }

    /// Produce a new `AVAudioTime` offset from this one by `seconds`, preserving whichever domain is
    /// valid. Host-time is preferred (well-defined across nodes on a live engine); sample-time is used
    /// for offline manual rendering where the host clock does not advance.
    func offset(bySeconds seconds: Double, timebase: HostTimebase = .system) -> AVAudioTime {
        if isHostTimeValid {
            let ticks = GameClock.offsetHostTicks(hostTime, bySeconds: seconds, timebase: timebase)
            return AVAudioTime(hostTime: ticks)
        }
        let rate = sampleRate > 0 ? sampleRate : 48_000
        let frames = Int64((seconds * rate).rounded())
        return AVAudioTime(sampleTime: sampleTime + frames, atRate: rate)
    }
}
