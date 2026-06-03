import type { Instrument } from './types'
import { getInstrumentCategory } from './types'

/** Onset detection parameters for the AudioWorklet processor */
export const ONSET_CONFIG: OnsetConfig = {
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
}

/** Noisy room mode preset - higher thresholds, narrower band */
export const NOISY_ROOM_CONFIG: OnsetConfig = {
  ...ONSET_CONFIG,
  bandPassLow: 200,
  adaptiveThresholdMultiplier: 2.5,
  adaptiveThresholdOffset: 0.01,
  minOnsetEnergy: 0.02,
}

/** Per-instrument onset detection profiles */
const INSTRUMENT_PROFILES: Partial<Record<Instrument, Partial<OnsetConfig>>> = {
  // Percussion — defaults are already tuned for these
  conga: {},
  timbale: { bandPassLow: 200, bandPassHigh: 4000 },
  bongo: { bandPassLow: 200 },
  clave: { bandPassLow: 800, bandPassHigh: 3000 },
  cowbell: { bandPassLow: 400, bandPassHigh: 4000 },
  guiro: { bandPassLow: 200, bandPassHigh: 3000, refractoryPeriodMs: 40 },

  // Pitched instruments — wider frequency range, adjusted sensitivity
  guitar: {
    bandPassLow: 80,
    bandPassHigh: 5000,
    envelopeAttackMs: 5,
    envelopeReleaseMs: 80,
    refractoryPeriodMs: 80,
    minOnsetEnergy: 0.008,
    fftSize: 2048,
    frameSize: 2048,
  },
  bass: {
    bandPassLow: 30,
    bandPassHigh: 2000,
    envelopeAttackMs: 8,
    envelopeReleaseMs: 100,
    refractoryPeriodMs: 100,
    minOnsetEnergy: 0.008,
    fftSize: 4096,
    frameSize: 4096,
  },
  piano: {
    bandPassLow: 27,
    bandPassHigh: 5000,
    envelopeAttackMs: 3,
    envelopeReleaseMs: 60,
    refractoryPeriodMs: 50,
    minOnsetEnergy: 0.006,
    fftSize: 2048,
    frameSize: 2048,
  },
  tres: {
    bandPassLow: 120,
    bandPassHigh: 5000,
    envelopeAttackMs: 4,
    envelopeReleaseMs: 70,
    refractoryPeriodMs: 70,
    minOnsetEnergy: 0.008,
    fftSize: 2048,
    frameSize: 2048,
  },
  cuatro: {
    bandPassLow: 120,
    bandPassHigh: 5000,
    envelopeAttackMs: 4,
    envelopeReleaseMs: 70,
    refractoryPeriodMs: 70,
    minOnsetEnergy: 0.008,
    fftSize: 2048,
    frameSize: 2048,
  },
  trumpet: {
    bandPassLow: 160,
    bandPassHigh: 6000,
    envelopeAttackMs: 10,
    envelopeReleaseMs: 100,
    refractoryPeriodMs: 100,
    minOnsetEnergy: 0.005,
    fftSize: 2048,
    frameSize: 2048,
  },
  saxophone: {
    bandPassLow: 100,
    bandPassHigh: 5000,
    envelopeAttackMs: 10,
    envelopeReleaseMs: 100,
    refractoryPeriodMs: 90,
    minOnsetEnergy: 0.005,
    fftSize: 2048,
    frameSize: 2048,
  },
  flute: {
    bandPassLow: 250,
    bandPassHigh: 6000,
    envelopeAttackMs: 12,
    envelopeReleaseMs: 120,
    refractoryPeriodMs: 80,
    minOnsetEnergy: 0.004,
    fftSize: 2048,
    frameSize: 2048,
  },
}

/** Get the onset detection config for a specific instrument */
export function getInstrumentConfig(instrument: Instrument, noisyRoom: boolean = false): OnsetConfig {
  const base = noisyRoom ? NOISY_ROOM_CONFIG : ONSET_CONFIG
  const profile = INSTRUMENT_PROFILES[instrument]
  if (!profile) return base
  return { ...base, ...profile }
}

/** Whether an instrument needs pitch detection in addition to onset detection */
export function instrumentNeedsPitchDetection(instrument: Instrument): boolean {
  return getInstrumentCategory(instrument) === 'pitched'
}

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
