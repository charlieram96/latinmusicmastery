import Accelerate
import XCTest

@testable import PlaySenseAudio

/// Verifies the ported click envelope + tone against `use-metronome.ts`.
final class ClickSynthesisTests: XCTestCase {

    private let sampleRate = 48_000.0

    func testDownbeatPeakFrequencyIsAround4400Hz() {
        assertPeakFrequency(of: .downbeat, expected: 4400, tolerance: 60)
    }

    func testBeatPeakFrequencyIsAround3300Hz() {
        assertPeakFrequency(of: .beat, expected: 3300, tolerance: 60)
    }

    func testEnvelopeShapeFirstSampleZeroLastSampleNearZero() {
        for spec in [ClickSpec.downbeat, .beat] {
            let samples = renderClickSamples(spec, sampleRate: sampleRate)
            XCTAssertFalse(samples.isEmpty)
            // sin(0) == 0 → the very first sample is exactly zero (instantaneous attack on a sine).
            XCTAssertEqual(samples.first!, 0, accuracy: 1e-6, "first sample of \(spec)")
            // The envelope decays to the 0.001 floor, so the tail is bounded well below the peak.
            XCTAssertLessThan(abs(samples.last!), Float(spec.peakGain) * 0.05, "last sample of \(spec)")
            // Peak magnitude never exceeds peakGain.
            let peak = samples.map(abs).max()!
            XCTAssertLessThanOrEqual(peak, Float(spec.peakGain) + 1e-4)
            XCTAssertGreaterThan(peak, Float(spec.peakGain) * 0.5, "click should actually reach near peak")
        }
    }

    func testBufferLengthMatchesDuration() {
        let downbeat = renderClickSamples(.downbeat, sampleRate: sampleRate)
        XCTAssertEqual(downbeat.count, Int((0.03 * sampleRate).rounded())) // 1440
        let beat = renderClickSamples(.beat, sampleRate: sampleRate)
        XCTAssertEqual(beat.count, Int((0.02 * sampleRate).rounded())) // 960
    }

    func testEnvelopeHoldsThenDecays() {
        // Sample the envelope by looking at the analytic gain at points before/after the hold boundary.
        let spec = ClickSpec.downbeat
        let samples = renderClickSamples(spec, sampleRate: sampleRate)
        let hold = spec.duration * 0.7
        // Amplitude envelope proxy: the local max magnitude in a short window around a time.
        func localPeak(around seconds: Double) -> Float {
            let center = Int(seconds * sampleRate)
            let lower = max(0, center - 12)
            let upper = min(samples.count, center + 12)
            return samples[lower..<upper].map(abs).max() ?? 0
        }
        let duringHold = localPeak(around: hold * 0.5)
        let afterHold = localPeak(around: hold + spec.duration * 0.3 * 0.9)
        XCTAssertGreaterThan(duringHold, afterHold, "envelope should decay after the hold segment")
    }

    // MARK: - FFT peak detection (Accelerate)

    private func assertPeakFrequency(of spec: ClickSpec, expected: Double, tolerance: Double) {
        let samples = renderClickSamples(spec, sampleRate: sampleRate)
        let freq = dominantFrequency(samples, sampleRate: sampleRate)
        XCTAssertEqual(freq, expected, accuracy: tolerance, "dominant frequency of \(spec)")
    }

    /// Zero-pad to a power of two, real FFT, return the bin frequency with the largest magnitude.
    private func dominantFrequency(_ input: [Float], sampleRate: Double) -> Double {
        let log2n = vDSP_Length(ceil(log2(Double(input.count))))
        let size = 1 << log2n
        let half = size / 2
        guard let setup = vDSP_create_fftsetup(log2n, FFTRadix(kFFTRadix2)) else { return 0 }
        defer { vDSP_destroy_fftsetup(setup) }

        var padded = input
        padded.append(contentsOf: [Float](repeating: 0, count: Int(size) - input.count))

        var real = [Float](repeating: 0, count: Int(half))
        var imag = [Float](repeating: 0, count: Int(half))
        var magnitudes = [Float](repeating: 0, count: Int(half))

        real.withUnsafeMutableBufferPointer { realPtr in
            imag.withUnsafeMutableBufferPointer { imagPtr in
                var split = DSPSplitComplex(realp: realPtr.baseAddress!, imagp: imagPtr.baseAddress!)
                padded.withUnsafeBufferPointer { inPtr in
                    inPtr.baseAddress!.withMemoryRebound(to: DSPComplex.self, capacity: Int(half)) { typed in
                        vDSP_ctoz(typed, 2, &split, 1, vDSP_Length(half))
                    }
                }
                vDSP_fft_zrip(setup, &split, 1, log2n, FFTDirection(FFT_FORWARD))
                vDSP_zvmags(&split, 1, &magnitudes, 1, vDSP_Length(half))
            }
        }

        var maxIndex: vDSP_Length = 0
        var maxValue: Float = 0
        vDSP_maxvi(magnitudes, 1, &maxValue, &maxIndex, vDSP_Length(magnitudes.count))
        return Double(maxIndex) * sampleRate / Double(size)
    }
}
