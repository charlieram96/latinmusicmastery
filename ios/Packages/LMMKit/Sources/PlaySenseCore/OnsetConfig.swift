import Foundation

// Port of `lib/play-sense/onset-config.ts` — per-instrument DSP profiles for the onset
// detector (consumed by PlaySenseAudio in D21; ported here as data with the core).

/// Port of the `OnsetConfig` type.
public struct OnsetConfig: Codable, Equatable, Sendable {
    /// Band-pass filter lower bound (Hz) — rejects below percussion body.
    public var bandPassLow: Double
    /// Band-pass filter upper bound (Hz) — rejects metronome click at 4kHz+.
    public var bandPassHigh: Double
    /// Envelope follower attack time (ms).
    public var envelopeAttackMs: Double
    /// Envelope follower release time (ms).
    public var envelopeReleaseMs: Double
    /// Number of frames for adaptive threshold median.
    public var adaptiveMedianFrames: Int
    /// Multiplier for adaptive threshold.
    public var adaptiveThresholdMultiplier: Double
    /// Fixed offset added to adaptive threshold.
    public var adaptiveThresholdOffset: Double
    /// Refractory period in ms (prevents double-trigger).
    public var refractoryPeriodMs: Double
    /// Minimum onset energy (RMS absolute floor, ~-40 dBFS).
    public var minOnsetEnergy: Double
    /// FFT size for spectral flux computation.
    public var fftSize: Int
    /// Analysis frame size in samples.
    public var frameSize: Int
    /// Hop size in samples.
    public var hopSize: Int
    /// Whether to compute a post-onset chroma vector for chord scoring (chordal
    /// instruments only).
    public var analyzeChroma: Bool

    public init(
        bandPassLow: Double,
        bandPassHigh: Double,
        envelopeAttackMs: Double,
        envelopeReleaseMs: Double,
        adaptiveMedianFrames: Int,
        adaptiveThresholdMultiplier: Double,
        adaptiveThresholdOffset: Double,
        refractoryPeriodMs: Double,
        minOnsetEnergy: Double,
        fftSize: Int,
        frameSize: Int,
        hopSize: Int,
        analyzeChroma: Bool
    ) {
        self.bandPassLow = bandPassLow
        self.bandPassHigh = bandPassHigh
        self.envelopeAttackMs = envelopeAttackMs
        self.envelopeReleaseMs = envelopeReleaseMs
        self.adaptiveMedianFrames = adaptiveMedianFrames
        self.adaptiveThresholdMultiplier = adaptiveThresholdMultiplier
        self.adaptiveThresholdOffset = adaptiveThresholdOffset
        self.refractoryPeriodMs = refractoryPeriodMs
        self.minOnsetEnergy = minOnsetEnergy
        self.fftSize = fftSize
        self.frameSize = frameSize
        self.hopSize = hopSize
        self.analyzeChroma = analyzeChroma
    }
}

/// A `Partial<OnsetConfig>` — the TS spread-merge (`{...base, ...patch}`) modeled as an
/// all-optional overlay applied on top of a full config.
public struct OnsetConfigPatch: Equatable, Sendable {
    public var bandPassLow: Double?
    public var bandPassHigh: Double?
    public var envelopeAttackMs: Double?
    public var envelopeReleaseMs: Double?
    public var adaptiveMedianFrames: Int?
    public var adaptiveThresholdMultiplier: Double?
    public var adaptiveThresholdOffset: Double?
    public var refractoryPeriodMs: Double?
    public var minOnsetEnergy: Double?
    public var fftSize: Int?
    public var frameSize: Int?
    public var hopSize: Int?
    public var analyzeChroma: Bool?

    public init(
        bandPassLow: Double? = nil,
        bandPassHigh: Double? = nil,
        envelopeAttackMs: Double? = nil,
        envelopeReleaseMs: Double? = nil,
        adaptiveMedianFrames: Int? = nil,
        adaptiveThresholdMultiplier: Double? = nil,
        adaptiveThresholdOffset: Double? = nil,
        refractoryPeriodMs: Double? = nil,
        minOnsetEnergy: Double? = nil,
        fftSize: Int? = nil,
        frameSize: Int? = nil,
        hopSize: Int? = nil,
        analyzeChroma: Bool? = nil
    ) {
        self.bandPassLow = bandPassLow
        self.bandPassHigh = bandPassHigh
        self.envelopeAttackMs = envelopeAttackMs
        self.envelopeReleaseMs = envelopeReleaseMs
        self.adaptiveMedianFrames = adaptiveMedianFrames
        self.adaptiveThresholdMultiplier = adaptiveThresholdMultiplier
        self.adaptiveThresholdOffset = adaptiveThresholdOffset
        self.refractoryPeriodMs = refractoryPeriodMs
        self.minOnsetEnergy = minOnsetEnergy
        self.fftSize = fftSize
        self.frameSize = frameSize
        self.hopSize = hopSize
        self.analyzeChroma = analyzeChroma
    }

    /// `{...base, ...self}`.
    public func applied(to base: OnsetConfig) -> OnsetConfig {
        OnsetConfig(
            bandPassLow: bandPassLow ?? base.bandPassLow,
            bandPassHigh: bandPassHigh ?? base.bandPassHigh,
            envelopeAttackMs: envelopeAttackMs ?? base.envelopeAttackMs,
            envelopeReleaseMs: envelopeReleaseMs ?? base.envelopeReleaseMs,
            adaptiveMedianFrames: adaptiveMedianFrames ?? base.adaptiveMedianFrames,
            adaptiveThresholdMultiplier: adaptiveThresholdMultiplier ?? base.adaptiveThresholdMultiplier,
            adaptiveThresholdOffset: adaptiveThresholdOffset ?? base.adaptiveThresholdOffset,
            refractoryPeriodMs: refractoryPeriodMs ?? base.refractoryPeriodMs,
            minOnsetEnergy: minOnsetEnergy ?? base.minOnsetEnergy,
            fftSize: fftSize ?? base.fftSize,
            frameSize: frameSize ?? base.frameSize,
            hopSize: hopSize ?? base.hopSize,
            analyzeChroma: analyzeChroma ?? base.analyzeChroma
        )
    }
}

/// Port of `ONSET_CONFIG` — onset detection parameters for the audio processor.
public let onsetConfigDefault = OnsetConfig(
    bandPassLow: 120,
    bandPassHigh: 2000,
    envelopeAttackMs: 3,
    envelopeReleaseMs: 50,
    adaptiveMedianFrames: 15,
    adaptiveThresholdMultiplier: 1.8,
    adaptiveThresholdOffset: 0.005,
    refractoryPeriodMs: 60,
    minOnsetEnergy: 0.01,
    fftSize: 512,
    frameSize: 1024,
    hopSize: 512,
    analyzeChroma: false
)

/// Port of `NOISY_ROOM_CONFIG` — higher thresholds, narrower band.
public let noisyRoomConfig = OnsetConfigPatch(
    bandPassLow: 200,
    adaptiveThresholdMultiplier: 2.5,
    adaptiveThresholdOffset: 0.01,
    minOnsetEnergy: 0.02
).applied(to: onsetConfigDefault)

/// Port of `INSTRUMENT_PROFILES` — per-instrument onset detection profiles.
private let instrumentProfiles: [Instrument: OnsetConfigPatch] = [
    // Percussion — defaults are already tuned for these
    .conga: OnsetConfigPatch(),
    .timbale: OnsetConfigPatch(bandPassLow: 200, bandPassHigh: 4000),
    .bongo: OnsetConfigPatch(bandPassLow: 200),
    .clave: OnsetConfigPatch(bandPassLow: 800, bandPassHigh: 3000),
    .cowbell: OnsetConfigPatch(bandPassLow: 400, bandPassHigh: 4000),
    .guiro: OnsetConfigPatch(bandPassLow: 200, bandPassHigh: 3000, refractoryPeriodMs: 40),

    // Pitched instruments — wider frequency range, adjusted sensitivity
    .guitar: OnsetConfigPatch(
        bandPassLow: 80,
        bandPassHigh: 5000,
        envelopeAttackMs: 5,
        envelopeReleaseMs: 80,
        refractoryPeriodMs: 80,
        minOnsetEnergy: 0.008,
        fftSize: 2048,
        frameSize: 2048,
        analyzeChroma: true
    ),
    .bass: OnsetConfigPatch(
        bandPassLow: 30,
        bandPassHigh: 2000,
        envelopeAttackMs: 8,
        envelopeReleaseMs: 100,
        refractoryPeriodMs: 100,
        minOnsetEnergy: 0.008,
        fftSize: 4096,
        frameSize: 4096
    ),
    .piano: OnsetConfigPatch(
        bandPassLow: 27,
        bandPassHigh: 5000,
        envelopeAttackMs: 3,
        envelopeReleaseMs: 60,
        refractoryPeriodMs: 50,
        minOnsetEnergy: 0.006,
        fftSize: 2048,
        frameSize: 2048,
        analyzeChroma: true
    ),
    .tres: OnsetConfigPatch(
        bandPassLow: 120,
        bandPassHigh: 5000,
        envelopeAttackMs: 4,
        envelopeReleaseMs: 70,
        refractoryPeriodMs: 70,
        minOnsetEnergy: 0.008,
        fftSize: 2048,
        frameSize: 2048,
        analyzeChroma: true
    ),
    .cuatro: OnsetConfigPatch(
        bandPassLow: 120,
        bandPassHigh: 5000,
        envelopeAttackMs: 4,
        envelopeReleaseMs: 70,
        refractoryPeriodMs: 70,
        minOnsetEnergy: 0.008,
        fftSize: 2048,
        frameSize: 2048,
        analyzeChroma: true
    ),
    .trumpet: OnsetConfigPatch(
        bandPassLow: 160,
        bandPassHigh: 6000,
        envelopeAttackMs: 10,
        envelopeReleaseMs: 100,
        refractoryPeriodMs: 100,
        minOnsetEnergy: 0.005,
        fftSize: 2048,
        frameSize: 2048
    ),
    .saxophone: OnsetConfigPatch(
        bandPassLow: 100,
        bandPassHigh: 5000,
        envelopeAttackMs: 10,
        envelopeReleaseMs: 100,
        refractoryPeriodMs: 90,
        minOnsetEnergy: 0.005,
        fftSize: 2048,
        frameSize: 2048
    ),
    .flute: OnsetConfigPatch(
        bandPassLow: 250,
        bandPassHigh: 6000,
        envelopeAttackMs: 12,
        envelopeReleaseMs: 120,
        refractoryPeriodMs: 80,
        minOnsetEnergy: 0.004,
        fftSize: 2048,
        frameSize: 2048
    ),
    .violin: OnsetConfigPatch(
        bandPassLow: 180,
        bandPassHigh: 6000,
        envelopeAttackMs: 8,
        envelopeReleaseMs: 100,
        refractoryPeriodMs: 80,
        minOnsetEnergy: 0.005,
        fftSize: 2048,
        frameSize: 2048
    )
]

/// Port of `SPEAKER_SAFE_CONFIG` — higher thresholds to reject backing-track bleed.
public let speakerSafeConfig = OnsetConfigPatch(
    adaptiveThresholdMultiplier: 2.2,
    refractoryPeriodMs: 100,
    minOnsetEnergy: 0.015
)

/// Port of `SPEAKER_SAFE_PERCUSSION` — speaker-safe overrides for percussion (narrower
/// band to reject bleed).
private let speakerSafePercussion: OnsetConfigPatch = {
    var patch = speakerSafeConfig
    patch.bandPassLow = 200
    patch.bandPassHigh = 1800
    return patch
}()

/// Port of `getInstrumentConfig` — the onset detection config for a specific instrument.
public func getInstrumentConfig(
    _ instrument: Instrument,
    noisyRoom: Bool = false,
    speakerSafe: Bool = false
) -> OnsetConfig {
    let base = noisyRoom ? noisyRoomConfig : onsetConfigDefault
    let profile = instrumentProfiles[instrument]
    let instrumentConfig = profile.map { $0.applied(to: base) } ?? base

    if !speakerSafe { return instrumentConfig }

    // Apply speaker-safe overrides — percussion gets the narrower band variant.
    let category = getInstrumentCategory(instrument)
    let safeOverrides = category == .percussion ? speakerSafePercussion : speakerSafeConfig
    return safeOverrides.applied(to: instrumentConfig)
}

/// Port of `instrumentNeedsPitchDetection` — whether an instrument needs pitch detection
/// in addition to onset detection.
public func instrumentNeedsPitchDetection(_ instrument: Instrument) -> Bool {
    getInstrumentCategory(instrument) == .pitched
}
