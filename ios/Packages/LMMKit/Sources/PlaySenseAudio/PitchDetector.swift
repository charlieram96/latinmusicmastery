import Accelerate
import Foundation

// NAC math uses the reference algorithm's short identifiers (i, n, lo, hi, c, …); relax naming/size
// rules file-wide to keep the port faithful.
// swiftlint:disable identifier_name function_body_length cyclomatic_complexity

/// Autocorrelation (NAC) pitch detector — a standalone port of `autoCorrelate()` in
/// `hooks/use-pitch-detection.ts` (which the worklet's `detectPitch` mirrors verbatim). Only the
/// on-onset / single-shot path is ported; the web hook's continuous `AnalyserNode` polling has no iOS
/// analogue (D21 runs this once per detected onset).
///
/// All scratch is preallocated in ``configure(sampleRate:)``; ``detect(_:)`` is allocation-free and
/// uses `vDSP_dotprD` for the correlation hot loop with precomputed prefix-sums-of-squares (Double
/// throughout, matching the reference's double-precision accumulation).
///
/// ### Divergence from the reference
/// The reference recomputes `sumSq1`/`sumSq2` inside the per-lag loop; here they come from a single
/// prefix-sum pass (O(N) once, then O(1) per lag) — the same values, far cheaper. The residual FP
/// difference is ~1e-12 and never flips the peak/octave decision for a real note (verified by the D21
/// onset goldens, which include an octave-down latch to 110 Hz).
public final class PitchDetector {

    private let maxBufferSize: Int
    private var sampleRate: Double
    private var prefixSq: [Double]
    /// Divergence (D22 carry-forward, documented not matched): the reference stores its normalized
    /// correlation curve in a `Float32Array` (`autoCorrelate`'s `correlations`), so every lag's value is
    /// quantized to `Float` precision before the peak search, octave check, and parabolic interpolation
    /// read it back. This port keeps `correlations` in full `Double` precision throughout. The residual
    /// (~1e-7 relative, i.e. `Float` ULP) is far below the confidence threshold's and octave ratio's
    /// granularity and never flipped the peak/octave decision across the D21 goldens (which include an
    /// octave-down latch case), so matching the `Float32` truncation was judged not worth the extra
    /// quantize/dequantize step on this hot loop — see the D22 report for the parity discussion.
    private var correlations: [Double]
    private var floatToDoubleScratch: [Double]

    public init(maxBufferSize: Int = 4096, sampleRate: Double = 48_000) {
        self.maxBufferSize = maxBufferSize
        self.sampleRate = sampleRate
        self.prefixSq = [Double](repeating: 0, count: maxBufferSize + 1)
        self.floatToDoubleScratch = [Double](repeating: 0, count: maxBufferSize)
        let maxLag = Int((sampleRate / 27).rounded(.down))
        self.correlations = [Double](repeating: 0, count: maxLag + 1)
    }

    public func configure(sampleRate: Double) {
        self.sampleRate = sampleRate
        let maxLag = Int((sampleRate / 27).rounded(.down))
        if correlations.count < maxLag + 1 {
            correlations = [Double](repeating: 0, count: maxLag + 1)
        }
    }

    /// Detect the fundamental (Hz) in a Double buffer of raw samples, or `nil` if no confident pitch
    /// (RMS-silence gate or clarity below 0.8).
    public func detect(_ buffer: UnsafeBufferPointer<Double>) -> Double? {
        let n = buffer.count
        precondition(n <= maxBufferSize, "buffer exceeds configured maxBufferSize")

        var sumSq = 0.0
        for i in 0..<n { let v = buffer[i]; sumSq += v * v }
        let rms = (sumSq / Double(n)).squareRoot()
        if rms < 0.01 { return nil }

        prefixSq[0] = 0
        for i in 0..<n { prefixSq[i + 1] = prefixSq[i] + buffer[i] * buffer[i] }

        let minLag = Int((sampleRate / 1500).rounded(.down))
        let maxLag = Int((sampleRate / 27).rounded(.down))
        let base = buffer.baseAddress!

        var lag = minLag
        while lag <= maxLag {
            let count = n - lag
            var dot = 0.0
            vDSP_dotprD(base, 1, base + lag, 1, &dot, vDSP_Length(count))
            let sumSq1 = prefixSq[count]
            let sumSq2 = prefixSq[n] - prefixSq[lag]
            let denom = (sumSq1 * sumSq2).squareRoot()
            correlations[lag] = denom > 0 ? dot / denom : 0
            lag += 1
        }

        let confidenceThreshold = 0.8
        var bestLag = -1
        var bestCorr = confidenceThreshold
        lag = minLag
        while lag <= maxLag {
            let c = correlations[lag]
            if c > bestCorr {
                let isPeak = (lag == minLag || c > correlations[lag - 1])
                    && (lag == maxLag || c >= correlations[lag + 1])
                if isPeak { bestCorr = c; bestLag = lag }
            }
            lag += 1
        }
        if bestLag == -1 { return nil }

        let octaveRatio = 0.85
        let octaveLag = bestLag * 2
        if octaveLag <= maxLag {
            var subLag = -1
            var subCorr = 0.0
            let lo = max(minLag, octaveLag - 2)
            let hi = min(maxLag, octaveLag + 2)
            var l = lo
            while l <= hi {
                if correlations[l] > subCorr { subCorr = correlations[l]; subLag = l }
                l += 1
            }
            if subLag != -1 && subCorr >= bestCorr * octaveRatio { bestLag = subLag }
        }

        let prev = bestLag > 0 ? correlations[bestLag - 1] : correlations[bestLag]
        let curr = correlations[bestLag]
        let next = bestLag < maxLag ? correlations[bestLag + 1] : correlations[bestLag]
        let shift = (prev - next) / (2 * (prev - 2 * curr + next))
        let truePeak = Double(bestLag) + (shift.isFinite ? shift : 0)
        return sampleRate / truePeak
    }

    /// Convenience for `Float` callers (e.g. a standalone tuner): converts into internal Double scratch.
    public func detect(_ samples: [Float]) -> Double? {
        let n = min(samples.count, maxBufferSize)
        for i in 0..<n { floatToDoubleScratch[i] = Double(samples[i]) }
        return floatToDoubleScratch.withUnsafeBufferPointer { detect(UnsafeBufferPointer(rebasing: $0[0..<n])) }
    }
}

// swiftlint:enable identifier_name function_body_length cyclomatic_complexity
