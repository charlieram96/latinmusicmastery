// Resolved OnsetConfig objects (post getInstrumentConfig merge) — copied verbatim
// from lib/play-sense/onset-config.ts, which is itself golden-tested in D19. The Swift
// parity test re-derives these via getInstrumentConfig(...) and asserts equality with
// the golden's embedded config, so any drift here is caught.

export const CONFIGS = {
  default: {
    bandPassLow: 120, bandPassHigh: 2000, envelopeAttackMs: 3, envelopeReleaseMs: 50,
    adaptiveMedianFrames: 15, adaptiveThresholdMultiplier: 1.8, adaptiveThresholdOffset: 0.005,
    refractoryPeriodMs: 60, minOnsetEnergy: 0.01, fftSize: 512, frameSize: 1024, hopSize: 512,
    analyzeChroma: false,
  },
  // conga == default (empty instrument patch)
  conga: {
    bandPassLow: 120, bandPassHigh: 2000, envelopeAttackMs: 3, envelopeReleaseMs: 50,
    adaptiveMedianFrames: 15, adaptiveThresholdMultiplier: 1.8, adaptiveThresholdOffset: 0.005,
    refractoryPeriodMs: 60, minOnsetEnergy: 0.01, fftSize: 512, frameSize: 1024, hopSize: 512,
    analyzeChroma: false,
  },
  guitar: {
    bandPassLow: 80, bandPassHigh: 5000, envelopeAttackMs: 5, envelopeReleaseMs: 80,
    adaptiveMedianFrames: 15, adaptiveThresholdMultiplier: 1.8, adaptiveThresholdOffset: 0.005,
    refractoryPeriodMs: 80, minOnsetEnergy: 0.008, fftSize: 2048, frameSize: 2048, hopSize: 512,
    analyzeChroma: true,
  },
  // getInstrumentConfig(conga, noisyRoom:true) => noisyRoomConfig
  noisyRoom: {
    bandPassLow: 200, bandPassHigh: 2000, envelopeAttackMs: 3, envelopeReleaseMs: 50,
    adaptiveMedianFrames: 15, adaptiveThresholdMultiplier: 2.5, adaptiveThresholdOffset: 0.01,
    refractoryPeriodMs: 60, minOnsetEnergy: 0.02, fftSize: 512, frameSize: 1024, hopSize: 512,
    analyzeChroma: false,
  },
  // getInstrumentConfig(conga, speakerSafe:true) => speakerSafePercussion over default
  speakerSafe: {
    bandPassLow: 200, bandPassHigh: 1800, envelopeAttackMs: 3, envelopeReleaseMs: 50,
    adaptiveMedianFrames: 15, adaptiveThresholdMultiplier: 2.2, adaptiveThresholdOffset: 0.005,
    refractoryPeriodMs: 100, minOnsetEnergy: 0.015, fftSize: 512, frameSize: 1024, hopSize: 512,
    analyzeChroma: false,
  },
}

// Fixture specs. `config` names a CONFIGS entry; `signal` is the buildSignal() spec.
export const FIXTURES = [
  {
    name: 'clicks_default', config: 'default',
    signal: {
      durationSec: 1.5,
      grains: [
        { atSec: 0.20, freq: 1000, amp: 0.6, durSec: 0.02, decaySec: 0.004 },
        { atSec: 0.45, freq: 1000, amp: 0.6, durSec: 0.02, decaySec: 0.004 },
        { atSec: 0.70, freq: 1000, amp: 0.6, durSec: 0.02, decaySec: 0.004 },
        { atSec: 0.95, freq: 1000, amp: 0.6, durSec: 0.02, decaySec: 0.004 },
        { atSec: 1.20, freq: 1000, amp: 0.6, durSec: 0.02, decaySec: 0.004 },
      ],
    },
  },
  {
    name: 'double_hit_refractory', config: 'default',
    signal: {
      durationSec: 1.0,
      grains: [
        { atSec: 0.30, freq: 1000, amp: 0.6, durSec: 0.02, decaySec: 0.004 },
        { atSec: 0.33, freq: 1000, amp: 0.6, durSec: 0.02, decaySec: 0.004 }, // +30ms < 60ms refractory
        { atSec: 0.60, freq: 1000, amp: 0.6, durSec: 0.02, decaySec: 0.004 },
        { atSec: 0.72, freq: 1000, amp: 0.6, durSec: 0.02, decaySec: 0.004 }, // +120ms > 60ms
      ],
    },
  },
  {
    name: 'sine_pitch_default', config: 'default',
    signal: {
      durationSec: 0.9,
      grains: [
        { atSec: 0.20, freq: 220, amp: 0.5, durSec: 0.5, decaySec: 0 },
      ],
    },
  },
  {
    name: 'guitar_chord', config: 'guitar',
    signal: {
      durationSec: 1.2,
      grains: [
        // C major triad, plucked (decaying)
        { atSec: 0.25, freqs: [261.63, 329.63, 392.00], amp: 0.3, durSec: 0.7, decaySec: 0.5 },
      ],
    },
  },
  {
    name: 'noise_floor_noisyRoom', config: 'noisyRoom',
    signal: {
      durationSec: 1.0,
      noise: { seed: 424242, amp: 0.015 },
      grains: [
        { atSec: 0.50, freq: 900, amp: 0.8, durSec: 0.02, decaySec: 0.004 }, // one real hit above the floor
      ],
    },
  },
  {
    name: 'speakerSafe_hits', config: 'speakerSafe',
    signal: {
      durationSec: 1.0,
      noise: { seed: 99, amp: 0.01 },
      grains: [
        { atSec: 0.30, freq: 800, amp: 0.5, durSec: 0.02, decaySec: 0.004 },
        { atSec: 0.60, freq: 800, amp: 0.5, durSec: 0.02, decaySec: 0.004 },
      ],
    },
  },
  {
    name: 'conga_default', config: 'conga',
    signal: {
      durationSec: 0.9,
      grains: [
        { atSec: 0.25, freq: 300, amp: 0.5, durSec: 0.03, decaySec: 0.006 },
        { atSec: 0.55, freq: 300, amp: 0.5, durSec: 0.03, decaySec: 0.006 },
      ],
    },
  },
]
