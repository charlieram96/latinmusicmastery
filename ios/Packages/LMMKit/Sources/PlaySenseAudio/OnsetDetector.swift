import Accelerate
import Foundation
import PlaySenseCore

// This is a dense 1:1 DSP port of the reference worklet: it uses the conventional short mathematical
// identifiers (i, k, b0, wR, re, …) and is necessarily long. Relax the naming/size rules file-wide
// (same approach ScoreTime.swift takes for its math) rather than distort the parity mapping.
// swiftlint:disable identifier_name type_body_length file_length

/// One message emitted by ``OnsetDetector`` — the Swift shape of the worklet's `port.postMessage`
/// payloads (`onset`, `chord`, `level`).
public enum OnsetDetectorMessage: Equatable, Sendable {
    /// A detected hit. `timestamp` is in the SAME clock the caller passed as each block's `blockTime`
    /// (host-clock seconds in production, so it aligns with `T0Anchor.hostSeconds`).
    case onset(timestamp: Double, energy: Double, fluxConfirmed: Bool, frequency: Double?)
    /// A deferred chord chroma, keyed by the onset it belongs to (fires ~80 ms after the onset).
    case chord(onsetTimestamp: Double, chroma: [Double])
    /// The unfiltered input RMS for the UI level meter (emitted once per render block).
    case level(Double)
}

/// A 1:1 Swift/Accelerate port of `public/audio-worklets/onset-detector-processor.js` — energy-envelope
/// onset detection with adaptive median thresholding + refractory gating, half-wave-rectified spectral
/// flux confidence, autocorrelation (NAC) pitch detection at onset, and deferred chord chroma.
///
/// ## Realtime discipline
/// Every buffer is allocated in ``configure(config:sampleRate:)``. ``process(_:blockTime:emit:)`` is
/// allocation-free on the per-frame hot path: the band-pass, RMS, FFT, median and NAC all run over
/// preallocated scratch. The only heap touch is the 12-element chroma array built when a (rare) deferred
/// chord message fires — off the hot path, at most once per onset.
///
/// ## Divergences from the worklet (all parity-driven, see the D21 goldens)
/// - Band-pass biquad and the analysis RMS run in `Double` scalar loops (not vDSP `Float`) so the IIR
///   feedback and the sensitive adaptive-threshold/refractory interplay match the worklet's double math
///   bit-closely. The filtered sample is stored as `Float`, exactly like the worklet's `Float32Array`.
/// - The radix-2 FFT (flux + chroma) is a direct port of the worklet's FFT (`Float` storage, `Double`
///   twiddles) rather than vDSP, to reproduce its per-stage `Float32` quantization for bitwise flux and
///   chroma parity.
/// - vDSP IS used where it both pays and preserves parity: the NAC pitch loop (the ~1 ms hot path) uses
///   `vDSP_dotprD` + precomputed prefix-sums-of-squares in `Double`, and the level meter uses
///   `vDSP_rmsqv`.
public final class OnsetDetector {

    // MARK: Config / rate
    public private(set) var config: OnsetConfig = onsetConfigDefault
    private var sampleRate: Double = 48_000

    /// Post-onset window (seconds) before computing chord chroma — the worklet's `chordWindowSec`.
    private let chordWindowSec = 0.08

    // MARK: Precomputed band-pass coefficients (normalized, a0 == 1)
    private var b0n = 0.0, b2n = 0.0, a1n = 0.0, a2n = 0.0
    // Band-pass state (kept in Double — the worklet keeps full-precision y in its state).
    private var bpX1 = 0.0, bpX2 = 0.0, bpY1 = 0.0, bpY2 = 0.0

    // MARK: Frame accumulation (filtered, Float — mirrors the worklet's Float32Array inputBuffer)
    private var inputBuffer: [Float] = []
    private var bufferIndex = 0

    // MARK: Raw pitch circular buffer + snapshot scratch
    private let pitchBufferSize = 4096
    private var pitchBuffer: [Float] = []
    private var pitchWritePos = 0
    private var pitchSnapshot: [Float] = []      // contiguous snapshot (Float, like the worklet)
    private var pitchSnapshotD: [Double] = []    // Double copy for the NAC / chroma math
    private let pitchDetector = PitchDetector()  // standalone NAC pitch (shared reference algorithm)

    // MARK: Envelope + adaptive history
    private var envelope = 0.0
    private var energyHistory: [Double] = []     // FIFO ring, up to adaptiveMedianFrames
    private var energyCount = 0
    private var energyHead = 0
    private var fluxHistory: [Double] = []
    private var fluxCount = 0
    private var fluxHead = 0
    private var medianScratch: [Double] = []

    private var attackCoeff = 0.0
    private var releaseCoeff = 0.0

    // MARK: FFT scratch (sized to the larger of fftSize and the 4096 chroma FFT)
    private var fftReal: [Float] = []
    private var fftImag: [Float] = []
    private var magnitudes: [Float] = []
    private var prevMagnitudes: [Float] = []
    private var hasPrevMagnitudes = false
    private var hann: [Double] = []              // precomputed 4096 Hann window

    // MARK: Onset / refractory
    private var lastOnsetTime = -Double.infinity

    // MARK: Pending chroma (fixed-capacity, allocation-free)
    private struct PendingChroma { var onsetTimestamp: Double; var fireAt: Double }
    private var pendingChromas: [PendingChroma] = []

    public init() {}

    // MARK: - Configure (full reset; mirrors a fresh processor + a `config` message)

    public func configure(config: OnsetConfig, sampleRate: Double) {
        self.config = config
        self.sampleRate = sampleRate

        // Band-pass coefficients (RBJ band-pass, constant per config — computed once here rather than
        // per-sample as the worklet does; identical values, cheaper).
        let f0 = (config.bandPassLow * config.bandPassHigh).squareRoot()
        let bw = config.bandPassHigh - config.bandPassLow
        let omega = 2 * Double.pi * f0 / sampleRate
        let sinW = sin(omega)
        let cosW = cos(omega)
        let alpha = sinW * sinh((0.6931471805599453 / 2) * (bw / f0) * (omega / sinW))
        let b0 = alpha, b2 = -alpha
        let a0 = 1 + alpha, a1 = -2 * cosW, a2 = 1 - alpha
        b0n = b0 / a0; b2n = b2 / a0; a1n = a1 / a0; a2n = a2 / a0
        bpX1 = 0; bpX2 = 0; bpY1 = 0; bpY2 = 0

        let frameSize = config.frameSize
        inputBuffer = [Float](repeating: 0, count: frameSize)
        bufferIndex = 0

        pitchBuffer = [Float](repeating: 0, count: pitchBufferSize)
        pitchWritePos = 0
        pitchSnapshot = [Float](repeating: 0, count: pitchBufferSize)
        pitchSnapshotD = [Double](repeating: 0, count: pitchBufferSize)
        pitchDetector.configure(sampleRate: sampleRate)

        envelope = 0
        energyHistory = [Double](repeating: 0, count: config.adaptiveMedianFrames)
        energyCount = 0; energyHead = 0
        fluxHistory = [Double](repeating: 0, count: config.adaptiveMedianFrames)
        fluxCount = 0; fluxHead = 0
        medianScratch = [Double](repeating: 0, count: config.adaptiveMedianFrames)

        attackCoeff = 1 - exp(-Double(frameSize) / ((config.envelopeAttackMs / 1000) * sampleRate))
        releaseCoeff = 1 - exp(-Double(frameSize) / ((config.envelopeReleaseMs / 1000) * sampleRate))

        let fftMax = max(config.fftSize, 4096)
        fftReal = [Float](repeating: 0, count: fftMax)
        fftImag = [Float](repeating: 0, count: fftMax)
        magnitudes = [Float](repeating: 0, count: config.fftSize / 2)
        prevMagnitudes = [Float](repeating: 0, count: config.fftSize / 2)
        hasPrevMagnitudes = false
        hann = (0..<4096).map { 0.5 - 0.5 * cos(2 * Double.pi * Double($0) / 4095.0) }

        lastOnsetTime = -.infinity
        pendingChromas.removeAll(keepingCapacity: true)
        pendingChromas.reserveCapacity(64)
    }

    // MARK: - Process one render block

    /// Feed one render block. `blockTime` is the clock reading at the START of this block (the worklet's
    /// `currentTime`); onset timestamps and chroma scheduling are quantized to it, exactly as in the
    /// worklet's 128-sample render quantum.
    public func process(_ block: UnsafeBufferPointer<Float>, blockTime: Double, emit: (OnsetDetectorMessage) -> Void) {
        let n = block.count

        // 1. Accumulate raw samples into the pitch circular buffer.
        pitchBuffer.withUnsafeMutableBufferPointer { pit in
            var wp = pitchWritePos
            for i in 0..<n {
                pit[wp] = block[i]
                wp += 1
                if wp == pitchBufferSize { wp = 0 }
            }
            pitchWritePos = wp
        }

        // 2. Fire any due chord-chroma analyses.
        if !pendingChromas.isEmpty {
            var i = 0
            while i < pendingChromas.count {
                if blockTime >= pendingChromas[i].fireAt {
                    let onsetTs = pendingChromas[i].onsetTimestamp
                    let chroma = computeChroma()
                    emit(.chord(onsetTimestamp: onsetTs, chroma: chroma))
                    pendingChromas.remove(at: i)
                } else {
                    i += 1
                }
            }
        }

        // 3. Band-pass into the frame buffer; analyze on each full frame.
        let frameSize = config.frameSize
        let hopSize = config.hopSize
        inputBuffer.withUnsafeMutableBufferPointer { buf in
            var idx = bufferIndex
            for i in 0..<n {
                let x = Double(block[i])
                let y = b0n * x - a1n * bpY1 - a2n * bpY2 + b2n * bpX2 // b1n == 0
                bpX2 = bpX1; bpX1 = x
                bpY2 = bpY1; bpY1 = y
                buf[idx] = Float(y)
                idx += 1
                if idx >= frameSize {
                    analyzeFrame(buf, now: blockTime, emit: emit)
                    // Hop: shift buffer left by hopSize.
                    let remaining = frameSize - hopSize
                    if remaining > 0 {
                        for k in 0..<remaining { buf[k] = buf[k + hopSize] }
                    }
                    idx = remaining
                }
            }
            bufferIndex = idx
        }

        // 4. Input level meter (unfiltered RMS) — vDSP.
        var level: Float = 0
        vDSP_rmsqv(block.baseAddress!, 1, &level, vDSP_Length(n))
        emit(.level(Double(level)))
    }

    /// Convenience for `[Float]` blocks (tests / non-pointer callers).
    public func process(_ block: [Float], blockTime: Double, emit: (OnsetDetectorMessage) -> Void) {
        block.withUnsafeBufferPointer { process($0, blockTime: blockTime, emit: emit) }
    }

    // MARK: - Frame analysis

    private func analyzeFrame(_ frame: UnsafeMutableBufferPointer<Float>, now: Double,
                              emit: (OnsetDetectorMessage) -> Void) {
        let frameSize = config.frameSize

        // RMS (Double, in-order — matches the worklet).
        var sumSq = 0.0
        for i in 0..<frameSize { let v = Double(frame[i]); sumSq += v * v }
        let rms = (sumSq / Double(frameSize)).squareRoot()

        // Envelope follower.
        if rms > envelope {
            envelope += attackCoeff * (rms - envelope)
        } else {
            envelope += releaseCoeff * (rms - envelope)
        }

        // Energy history + adaptive threshold.
        pushEnergy(envelope)
        let energyThreshold = adaptiveThreshold()
        let energyExceeds = envelope > energyThreshold && envelope > config.minOnsetEnergy

        // Spectral flux (confidence only).
        let flux = computeSpectralFlux(frame)
        pushFlux(flux)
        let fluxThreshold = adaptiveFluxThreshold()
        let fluxExceeds = flux > fluxThreshold

        guard energyExceeds else { return }
        let refractorySec = config.refractoryPeriodMs / 1000
        guard now - lastOnsetTime > refractorySec else { return }
        lastOnsetTime = now

        snapshotPitchBuffer()
        let freq = pitchSnapshotD.withUnsafeBufferPointer { pitchDetector.detect($0) }
        emit(.onset(timestamp: now, energy: envelope, fluxConfirmed: fluxExceeds, frequency: freq))

        if config.analyzeChroma {
            pendingChromas.append(PendingChroma(onsetTimestamp: now, fireAt: now + chordWindowSec))
        }
    }

    // MARK: - Adaptive thresholds

    private func pushEnergy(_ v: Double) {
        let cap = config.adaptiveMedianFrames
        if energyCount < cap {
            energyHistory[(energyHead + energyCount) % cap] = v
            energyCount += 1
        } else {
            energyHistory[energyHead] = v
            energyHead = (energyHead + 1) % cap
        }
    }

    private func adaptiveThreshold() -> Double {
        if energyCount == 0 { return config.minOnsetEnergy }
        for i in 0..<energyCount { medianScratch[i] = energyHistory[(energyHead + i) % config.adaptiveMedianFrames] }
        insertionSort(&medianScratch, count: energyCount)
        let mid = energyCount / 2
        let median = energyCount % 2 == 0
            ? (medianScratch[mid - 1] + medianScratch[mid]) / 2
            : medianScratch[mid]
        return median * config.adaptiveThresholdMultiplier + config.adaptiveThresholdOffset
    }

    private func pushFlux(_ v: Double) {
        let cap = config.adaptiveMedianFrames
        if fluxCount < cap {
            fluxHistory[(fluxHead + fluxCount) % cap] = v
            fluxCount += 1
        } else {
            fluxHistory[fluxHead] = v
            fluxHead = (fluxHead + 1) % cap
        }
    }

    private func adaptiveFluxThreshold() -> Double {
        if fluxCount == 0 { return .infinity }
        var sum = 0.0
        for i in 0..<fluxCount { sum += fluxHistory[(fluxHead + i) % config.adaptiveMedianFrames] }
        return (sum / Double(fluxCount)) * 2.0 + 0.1
    }

    private func insertionSort(_ a: inout [Double], count: Int) {
        var i = 1
        while i < count {
            let key = a[i]
            var j = i - 1
            while j >= 0 && a[j] > key { a[j + 1] = a[j]; j -= 1 }
            a[j + 1] = key
            i += 1
        }
    }

    // MARK: - Spectral flux

    private func computeSpectralFlux(_ frame: UnsafeMutableBufferPointer<Float>) -> Double {
        let fftN = config.fftSize
        for i in 0..<fftN { fftReal[i] = 0; fftImag[i] = 0 }
        let copyLen = min(config.frameSize, fftN)
        for i in 0..<copyLen { fftReal[i] = frame[i] }

        fftRadix2(count: fftN)

        let half = fftN / 2
        for k in 0..<half {
            let re = Double(fftReal[k]); let im = Double(fftImag[k])
            magnitudes[k] = Float((re * re + im * im).squareRoot())
        }

        if !hasPrevMagnitudes {
            for k in 0..<half { prevMagnitudes[k] = magnitudes[k] }
            hasPrevMagnitudes = true
            return 0
        }

        var flux = 0.0
        for k in 0..<half {
            let diff = Double(magnitudes[k]) - Double(prevMagnitudes[k])
            if diff > 0 { flux += diff }
        }
        for k in 0..<half { prevMagnitudes[k] = magnitudes[k] }
        return flux
    }

    // MARK: - Chroma

    private func computeChroma() -> [Double] {
        // Snapshot the raw circular buffer into a contiguous Float array (and a Double copy).
        snapshotPitchBuffer()
        let fftN = 4096
        for i in 0..<fftN { fftReal[i] = 0; fftImag[i] = 0 }
        for i in 0..<fftN { fftReal[i] = Float(pitchSnapshotD[i] * hann[i]) }

        fftRadix2(count: fftN)

        var chroma = [Float](repeating: 0, count: 12)
        let sr = sampleRate
        let minBin = max(1, Int((70 * Double(fftN) / sr).rounded(.down)))
        let maxBin = min(fftN / 2 - 1, Int((2000 * Double(fftN) / sr).rounded(.up)))
        var k = minBin
        while k <= maxBin {
            let re = Double(fftReal[k]); let im = Double(fftImag[k])
            let mag = (re * re + im * im).squareRoot()
            if mag > 0 {
                let freq = Double(k) * sr / Double(fftN)
                let raw = jsRound(12 * log2(freq / 440) + 69)
                let pc = ((raw % 12) + 12) % 12
                chroma[pc] = Float(Double(chroma[pc]) + mag)
            }
            k += 1
        }

        var maxVal: Float = 0
        for i in 0..<12 where chroma[i] > maxVal { maxVal = chroma[i] }
        var out = [Double](repeating: 0, count: 12)
        for i in 0..<12 { out[i] = maxVal > 0 ? Double(chroma[i]) / Double(maxVal) : 0 }
        return out
    }

    // MARK: - Pitch (NAC)

    private func snapshotPitchBuffer() {
        let wp = pitchWritePos
        let size = pitchBufferSize
        pitchSnapshot.withUnsafeMutableBufferPointer { snap in
            pitchBuffer.withUnsafeBufferPointer { pit in
                for i in 0..<(size - wp) { snap[i] = pit[wp + i] }
                for i in 0..<wp { snap[size - wp + i] = pit[i] }
            }
        }
        for i in 0..<size { pitchSnapshotD[i] = Double(pitchSnapshot[i]) }
    }

    // MARK: - Radix-2 FFT (direct port of the worklet's `fft`, Float storage / Double twiddles)

    private func fftRadix2(count n: Int) {
        fftReal.withUnsafeMutableBufferPointer { real in
            fftImag.withUnsafeMutableBufferPointer { imag in
                // Bit-reversal permutation.
                var j = 0
                for i in 1..<n {
                    var bit = n >> 1
                    while j & bit != 0 { j ^= bit; bit >>= 1 }
                    j ^= bit
                    if i < j {
                        real.swapAt(i, j)
                        imag.swapAt(i, j)
                    }
                }
                // Cooley-Tukey.
                var len = 2
                while len <= n {
                    let halfLen = len >> 1
                    let angle = -2 * Double.pi / Double(len)
                    let wR = cos(angle)
                    let wI = sin(angle)
                    var i = 0
                    while i < n {
                        var curR = 1.0
                        var curI = 0.0
                        for k in 0..<halfLen {
                            let uR = Double(real[i + k])
                            let uI = Double(imag[i + k])
                            let tR = Double(real[i + k + halfLen])
                            let tI = Double(imag[i + k + halfLen])
                            let vR = tR * curR - tI * curI
                            let vI = tR * curI + tI * curR
                            real[i + k] = Float(uR + vR)
                            imag[i + k] = Float(uI + vI)
                            real[i + k + halfLen] = Float(uR - vR)
                            imag[i + k + halfLen] = Float(uI - vI)
                            let newCurR = curR * wR - curI * wI
                            curI = curR * wI + curI * wR
                            curR = newCurR
                        }
                        i += len
                    }
                    len <<= 1
                }
            }
        }
    }
}

/// `Math.round` — round half toward +∞ (JS semantics), returned as `Int`.
private func jsRound(_ x: Double) -> Int {
    Int((x + 0.5).rounded(.down))
}

// swiftlint:enable identifier_name type_body_length file_length
