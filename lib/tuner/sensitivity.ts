/** Engine gates per sensitivity level: RMS silence gate and NSDF clarity floor. */
export type Sensitivity = 'low' | 'med' | 'high'

export const SENSITIVITY_PRESETS: Record<Sensitivity, { rms: number; clarity: number }> = {
  low: { rms: 0.02, clarity: 0.93 },
  med: { rms: 0.01, clarity: 0.88 },
  high: { rms: 0.004, clarity: 0.8 },
}
