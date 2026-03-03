/** Onset detection parameters for the AudioWorklet processor */
export const ONSET_CONFIG = {
  /** Band-pass filter lower bound (Hz) - rejects below percussion body */
  bandPassLow: 120,
  /** Band-pass filter upper bound (Hz) - rejects metronome click at 4kHz+ */
  bandPassHigh: 2000,
  /** Envelope follower attack time (ms) */
  envelopeAttackMs: 3,
  /** Envelope follower release time (ms) */
  envelopeReleaseMs: 50,
  /** Number of frames for adaptive threshold median */
  adaptiveMedianFrames: 15,
  /** Multiplier for adaptive threshold */
  adaptiveThresholdMultiplier: 1.8,
  /** Fixed offset added to adaptive threshold */
  adaptiveThresholdOffset: 0.005,
  /** Refractory period in ms (prevents double-trigger) */
  refractoryPeriodMs: 60,
  /** Minimum onset energy (RMS absolute floor, ~-40 dBFS) */
  minOnsetEnergy: 0.01,
  /** FFT size for spectral flux computation */
  fftSize: 512,
  /** Analysis frame size in samples */
  frameSize: 1024,
  /** Hop size in samples */
  hopSize: 512,
} as const

/** Noisy room mode preset - higher thresholds, narrower band */
export const NOISY_ROOM_CONFIG = {
  ...ONSET_CONFIG,
  bandPassLow: 200,
  adaptiveThresholdMultiplier: 2.5,
  adaptiveThresholdOffset: 0.01,
  minOnsetEnergy: 0.02,
} as const

export type OnsetConfig = {
  bandPassLow: number
  bandPassHigh: number
  envelopeAttackMs: number
  envelopeReleaseMs: number
  adaptiveMedianFrames: number
  adaptiveThresholdMultiplier: number
  adaptiveThresholdOffset: number
  refractoryPeriodMs: number
  minOnsetEnergy: number
  fftSize: number
  frameSize: number
  hopSize: number
}
