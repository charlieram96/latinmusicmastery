import Foundation

// Mirrors the JS signal generator's short identifiers and grain-parameter signature.
// swiftlint:disable identifier_name function_parameter_count

/// Exact line-by-line mirror of `scratchpad/d21-gen/signal.mjs`. Regenerates the deterministic
/// fixture inputs the worklet golden was produced from, so the parity test feeds the Swift
/// `OnsetDetector` bit-identical `Float32` samples (verified by the committed `inputChecksum`).
enum OnsetDetectorSignal {

    /// `mulberry32` — 32-bit PRNG matching the JS reference (UInt32 wrapping arithmetic mirrors JS's
    /// `Math.imul` / `>>>` / `|0` semantics).
    struct Mulberry32 {
        private var a: UInt32
        init(seed: UInt32) { a = seed }
        mutating func next() -> Double {
            a = a &+ 0x6d2b_79f5
            var t = (a ^ (a >> 15)) &* (a | 1)
            t = (t &+ ((t ^ (t >> 7)) &* (t | 61))) ^ t
            return Double((t ^ (t >> 14))) / 4_294_967_296.0
        }
    }

    /// `Math.round` (round half toward +∞).
    static func jsRound(_ x: Double) -> Int { Int((x + 0.5).rounded(.down)) }

    struct NoiseSpec: Decodable { let seed: UInt32; let amp: Double }
    struct GrainSpec: Decodable {
        let atSec: Double
        let freq: Double?
        let freqs: [Double]?
        let amp: Double
        let durSec: Double
        let decaySec: Double?
    }
    struct SignalSpec: Decodable {
        let durationSec: Double
        let noise: NoiseSpec?
        let grains: [GrainSpec]?
    }

    private static func addGrain(_ buf: inout [Float], sr: Double, startSample: Int,
                                 freq: Double, amp: Double, durSec: Double, decaySec: Double) {
        let dur = jsRound(durSec * sr)
        for i in 0..<dur {
            let idx = startSample + i
            if idx < 0 || idx >= buf.count { continue }
            let env = decaySec > 0 ? exp(-Double(i) / (decaySec * sr)) : 1
            let v = amp * env * sin(2 * Double.pi * freq * Double(i) / sr)
            buf[idx] = Float(Double(buf[idx]) + v)
        }
    }

    private static func addNoise(_ buf: inout [Float], seed: UInt32, amp: Double) {
        var rng = Mulberry32(seed: seed)
        for i in 0..<buf.count {
            let v = (rng.next() * 2 - 1) * amp
            buf[i] = Float(Double(buf[i]) + v)
        }
    }

    /// Build the raw signal (unpadded), matching `buildSignal`.
    static func build(sr: Double, spec: SignalSpec) -> [Float] {
        let n = jsRound(spec.durationSec * sr)
        var buf = [Float](repeating: 0, count: n)
        if let noise = spec.noise { addNoise(&buf, seed: noise.seed, amp: noise.amp) }
        for g in spec.grains ?? [] {
            let start = jsRound(g.atSec * sr)
            let freqs = g.freqs ?? [g.freq!]
            for f in freqs {
                addGrain(&buf, sr: sr, startSample: start, freq: f, amp: g.amp,
                         durSec: g.durSec, decaySec: g.decaySec ?? 0)
            }
        }
        return buf
    }

    /// Build + zero-pad to a whole number of `block`-sample render quanta.
    static func buildPadded(sr: Double, spec: SignalSpec, block: Int) -> [Float] {
        let raw = build(sr: sr, spec: spec)
        let nBlocks = (raw.count + block - 1) / block
        var padded = [Float](repeating: 0, count: nBlocks * block)
        for i in 0..<raw.count { padded[i] = raw[i] }
        return padded
    }

    static func checksum(_ buf: [Float]) -> (sum: Double, absSum: Double) {
        var s = 0.0
        var a = 0.0
        for v in buf { s += Double(v); a += abs(Double(v)) }
        return (s, a)
    }
}

// swiftlint:enable identifier_name function_parameter_count
