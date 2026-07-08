import Foundation

/// Parameters for one synthesized metronome click. Ported 1:1 from the web `useMetronome`
/// (`hooks/use-metronome.ts`): a high-frequency sine (spectrally clear of the 120–2000 Hz percussion
/// band-pass so it never masquerades as a played onset), with the downbeat pitched higher and louder.
public struct ClickSpec: Equatable, Sendable {
    /// Sine frequency in Hz.
    public let frequency: Double
    /// Envelope peak linear gain.
    public let peakGain: Double
    /// Total click duration in seconds.
    public let duration: Double

    public init(frequency: Double, peakGain: Double, duration: Double) {
        self.frequency = frequency
        self.peakGain = peakGain
        self.duration = duration
    }

    /// Downbeat click: 4400 Hz, gain 0.6, 30 ms — matches `isDownbeat ? 4400 : 3300` etc.
    public static let downbeat = ClickSpec(frequency: 4400, peakGain: 0.6, duration: 0.03)
    /// Off-beat click: 3300 Hz, gain 0.4, 20 ms.
    public static let beat = ClickSpec(frequency: 3300, peakGain: 0.4, duration: 0.02)
}

/// The web envelope floor that `exponentialRampToValueAtTime` decays to (it cannot reach exactly 0).
private let clickEnvelopeFloor = 0.001

/// Render one click into mono float PCM samples.
///
/// Envelope parity with `use-metronome.ts::scheduleClick`:
/// - `holdTime = duration × 0.7`, `rampTime = duration × 0.3`.
/// - gain is set to `peakGain` at the onset and held flat through `holdTime` (the web does
///   `setValueAtTime(0, t−0.001)` then `setValueAtTime(peak, t)` — an instantaneous attack).
/// - it then `exponentialRampToValueAtTime(0.001, holdTime + rampTime)` — a geometric decay.
/// The audible signal is `envelope(t) × sin(2π·f·t)`, so the first sample is 0 (sin 0) and the last is
/// near zero (envelope at the floor), matching the required envelope shape.
public func renderClickSamples(_ spec: ClickSpec, sampleRate: Double) -> [Float] {
    precondition(sampleRate > 0, "sampleRate must be positive")
    let hold = spec.duration * 0.7
    let ramp = spec.duration * 0.3
    let frameCount = Int((spec.duration * sampleRate).rounded())
    guard frameCount > 0 else { return [] }

    var samples = [Float](repeating: 0, count: frameCount)
    let ratio = clickEnvelopeFloor / spec.peakGain
    for frame in 0..<frameCount {
        let time = Double(frame) / sampleRate
        let envelope: Double
        if time <= hold {
            envelope = spec.peakGain
        } else {
            // Geometric decay from peakGain at `hold` to the floor at `hold + ramp`.
            let progress = min(1.0, (time - hold) / ramp)
            envelope = spec.peakGain * pow(ratio, progress)
        }
        samples[frame] = Float(envelope * sin(2.0 * Double.pi * spec.frequency * time))
    }
    return samples
}
